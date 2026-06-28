// Service Worker — AI Vido Web 离线缓存 + 跨域媒体加速
//
// 职责：
//   1. 同源资源（HTML / JS / CSS / 图片）：cache-first，提升二次加载速度
//   2. 跨域媒体 URL（OSS 签名链接 等）：拦截后用 no-cors fetch 拿字节，
//      重新包装成带 CORS 头的 Response 写入 CacheStorage。主线程通过
//      getCachedMediaBlob() 读取，**二次保存 0 网络请求**。
//
// 关键原理：
//   - 浏览器对 `<img>` 渲染跨域图片时不强制 CORS（用户能看到图）
//   - 但 JS 读 `<img>` 字节（canvas.toBlob）或 fetch() 时被 CORS 拦截
//   - Service Worker 上下文里 fetch() 不受页面 CORS 策略限制
//   - SW 拿到的 opaque Response 字节可读，但 status=0、headers=[]
//   - 解包成 Blob 后用 new Response() 重新构造，加上
//     'Access-Control-Allow-Origin: *' 头，主线程就能正常读 .blob()

const STATIC_CACHE_NAME = 'minimax-video-studio-v1';
const MEDIA_CACHE_NAME = 'ai-vido-media-v1';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];
const MAX_MEDIA_ENTRIES = 200;

// 跨域媒体 URL 匹配：常见图片 / 视频 / 音频扩展名
const MEDIA_EXT_RE = /\.(png|jpe?g|webp|gif|bmp|svg|mp4|webm|mov|m4v|mp3|wav|ogg|m4a)(\?|$)/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // ignore static asset failures
      });
    })
  );
  // 新 SW 立即激活，避免用户看到旧 SW 行为
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // 清理过期缓存桶
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE_NAME && name !== MEDIA_CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      ),
      // 立即接管所有未受控页面
      self.clients.claim(),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 跨域媒体 URL：拦截 + 缓存 + 包装 CORS 头
  if (url.origin !== self.location.origin && MEDIA_EXT_RE.test(url.pathname)) {
    event.respondWith(handleCrossOriginMedia(request));
    return;
  }

  // 跳过 API（避免缓存动态数据）
  if (url.pathname.startsWith('/api/')) return;

  // 同源资源：cache-first
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(handleSameOriginStatic(request));
    return;
  }

  // HTML：network-first with cache fallback
  event.respondWith(handleNavigation(request));
});

// ===== Handlers =====

async function handleCrossOriginMedia(request) {
  const cache = await caches.open(MEDIA_CACHE_NAME);

  // 1) 缓存命中：直接返回（带 CORS 头）
  const cached = await cache.match(request);
  if (cached) {
    // 后台异步 LRU 清理（不阻塞响应）
    scheduleTrimMediaCache(cache);
    return cached;
  }

  // 2) 缓存未命中：用 no-cors fetch 拿字节（SW 不受 CORS 限制）
  try {
    const response = await fetch(request, {
      mode: 'no-cors',
      credentials: 'omit',
      cache: 'no-store',
    });

    // opaque Response 字节可读，但 status=0 headers=[]
    // 解包成 Blob，重新构造带 CORS 头 + 正确 MIME 的 Response
    const blob = await response.clone().blob();
    if (blob.size === 0) {
      return new Response('Empty response from origin', { status: 502 });
    }

    const wrapped = new Response(blob, {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': blob.type || guessMime(request.url),
        'Content-Length': String(blob.size),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD',
        'Cache-Control': 'public, max-age=86400',
        'X-Cached-By': 'ai-vido-sw',
        'X-Cache-Date': String(Date.now()),
      },
    });

    // 写入缓存（用 request 作 key；主线程按 URL match）
    try {
      await cache.put(request, wrapped.clone());
      scheduleTrimMediaCache(cache);
    } catch {
      // 缓存写入失败（quota 等）不影响返回
    }

    return wrapped;
  } catch (e) {
    // SW 内 fetch 也失败（罕见，可能是网络断开）
    return new Response(
      JSON.stringify({ code: 'OFFLINE', error: 'Service Worker fetch failed' }),
      {
        status: 504,
        statusText: 'Gateway Timeout',
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function handleSameOriginStatic(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      cache.put(request, clone).catch(() => undefined);
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok && request.mode === 'navigate') {
      const clone = response.clone();
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        cache.put(request, clone).catch(() => undefined);
      });
    }
    return response;
  } catch {
    return caches.match(request).then((cached) => cached || caches.match('/'));
  }
}

// ===== LRU =====

let trimScheduled = false;
function scheduleTrimMediaCache(cache) {
  if (trimScheduled) return;
  trimScheduled = true;
  // 用 setTimeout 避免在响应路径上阻塞
  setTimeout(() => {
    trimScheduled = false;
    trimMediaCache(cache).catch(() => undefined);
  }, 1000);
}

async function trimMediaCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_MEDIA_ENTRIES) return;
  // 按 cache.keys() 顺序删除最旧的（CacheStorage 按插入顺序）
  // 注意：cache.match() 后不会改变顺序，所以这近似 FIFO/LRU 混合
  const toDelete = keys.slice(0, keys.length - MAX_MEDIA_ENTRIES);
  await Promise.all(toDelete.map((k) => cache.delete(k)));
}

// ===== MIME 推断 =====

function guessMime(url) {
  try {
    const path = url.split('?')[0];
    const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
    const map = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
      bmp: 'image/bmp',
      svg: 'image/svg+xml',
      mp4: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
      m4v: 'video/mp4',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      m4a: 'audio/mp4',
    };
    return map[ext] || 'application/octet-stream';
  } catch {
    return 'application/octet-stream';
  }
}

// ===== 主线程消息接口 =====

self.addEventListener('message', (event) => {
  const data = event.data || {};
  const source = event.source;

  if (data.type === 'CLEAR_MEDIA_CACHE') {
    event.waitUntil(
      caches
        .delete(MEDIA_CACHE_NAME)
        .then((deleted) => {
          if (source && source.postMessage) {
            source.postMessage({ type: 'CLEARED', deleted });
          }
        })
        .catch((err) => {
          if (source && source.postMessage) {
            source.postMessage({ type: 'ERROR', error: String(err) });
          }
        })
    );
  } else if (data.type === 'MEDIA_CACHE_STATS') {
    event.waitUntil(getMediaCacheStats().then((stats) => {
      if (source && source.postMessage) {
        source.postMessage({ type: 'MEDIA_CACHE_STATS_RESULT', ...stats });
      }
    }));
  } else if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function getMediaCacheStats() {
  try {
    const cache = await caches.open(MEDIA_CACHE_NAME);
    const keys = await cache.keys();
    let totalBytes = 0;
    let oldestTimestamp = 0;
    for (const req of keys) {
      const res = await cache.match(req);
      if (!res) continue;
      try {
        const blob = await res.clone().blob();
        totalBytes += blob.size;
        const cachedAt = res.headers.get('X-Cache-Date');
        if (cachedAt) {
          const t = parseInt(cachedAt, 10);
          if (!oldestTimestamp || t < oldestTimestamp) oldestTimestamp = t;
        }
      } catch {
        // 跳过无法读取的项
      }
    }
    return {
      count: keys.length,
      totalBytes,
      oldestTimestamp,
      maxEntries: MAX_MEDIA_ENTRIES,
    };
  } catch (e) {
    return { count: 0, totalBytes: 0, oldestTimestamp: 0, maxEntries: MAX_MEDIA_ENTRIES, error: String(e) };
  }
}