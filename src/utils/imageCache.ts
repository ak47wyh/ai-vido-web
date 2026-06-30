/**
 * imageCache —— 主线程访问 Service Worker 媒体缓存的工具集
 *
 * 核心功能：
 * - getCachedMediaBlob(url) → Blob | null：从 CacheStorage 读取已缓存的跨域图片
 * - warmCacheFromElement(img) → void：把 <img> 当前 src 主动写入缓存（防御性）
 * - clearAllMediaCache() → boolean：清空媒体缓存（通过 SW 消息）
 * - getMediaCacheStats() → 统计
 * - isSWActive() → Promise<boolean>：SW 是否已激活
 *
 * 与 Plan D 协同：
 *   SW 命中 → getCachedMediaBlob → Blob → saveImageFromBlob → FilesLocalAdapter → 磁盘
 *   全程 0 网络请求。
 *
 * 与 Plan A（路径 A）对应。
 */

const MEDIA_CACHE_NAME = 'ai-vido-media-v1';

/** 缓存统计 */
export interface MediaCacheStats {
  count: number;
  totalBytes: number;
  oldestTimestamp: number;
  maxEntries: number;
  error?: string;
}

/** 检查浏览器是否支持 CacheStorage */
export function isCacheStorageAvailable(): boolean {
  return typeof globalThis !== 'undefined' && 'caches' in globalThis;
}

/** 检查浏览器是否支持 Service Worker */
export function isServiceWorkerAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

/** 检查 Service Worker 是否已注册并激活 */
export async function isSWActive(): Promise<boolean> {
  if (!isServiceWorkerAvailable()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    return !!reg && !!reg.active;
  } catch {
    return false;
  }
}

/**
 * 从 CacheStorage 读取 URL 对应的 Blob。
 *
 * 命中时返回 Blob（已带 CORS 头，主线程可正常读取 .blob()）；
 * 未命中、SW 不可用或异常时返回 null（调用方应回退到下载/兜底）。
 *
 * 注意：必须在 Service Worker 已注册并接管页面的前提下才能命中。
 */
export async function getCachedMediaBlob(url: string): Promise<Blob | null> {
  if (!isCacheStorageAvailable() || !url) return null;
  try {
    const cache = await caches.open(MEDIA_CACHE_NAME);
    const res = await cache.match(url);
    if (!res) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

/**
 * 主动把 <img> 的 src URL 写入缓存。
 *
 * 实际上 SW 在首次 <img> 加载时已经写过缓存了；本方法是防御性兜底：
 * - 用户可能从缓存（disk cache）渲染图片，SW 未触发
 * - 某些场景下 SW 未拦截到（如首次 SW 注册前已渲染完）
 *
 * 注意：内部 fetch 用 no-cors 模式拿 opaque Response，bytes 可读但 headers=[]。
 */
export async function warmCacheFromElement(img: HTMLImageElement): Promise<boolean> {
  if (!isCacheStorageAvailable() || !img?.src) return false;
  try {
    const res = await fetch(img.src, { mode: 'no-cors', credentials: 'omit' });
    const blob = await res.blob();
    if (blob.size === 0) return false;
    const cache = await caches.open(MEDIA_CACHE_NAME);
    await cache.put(
      img.src,
      new Response(blob, {
        headers: {
          'Content-Type': blob.type || guessMimeFromUrl(img.src),
          'Access-Control-Allow-Origin': '*',
          'X-Cache-Date': String(Date.now()),
        },
      })
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * 清空媒体缓存（通过 Service Worker 消息接口）。
 * 返回是否成功清空。
 */
export async function clearAllMediaCache(): Promise<boolean> {
  if (!isCacheStorageAvailable()) return false;
  // 优先通过 SW 消息清空（异步、可观测）
  if (isServiceWorkerAvailable()) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const activeSW = reg?.active;
      if (activeSW) {
        const cleared = await new Promise<boolean>((resolve) => {
          const channel = new MessageChannel();
          const timer = setTimeout(() => resolve(false), 3000);
          channel.port1.onmessage = (e) => {
            clearTimeout(timer);
            resolve(e.data?.type === 'CLEARED' ? !!e.data.deleted : false);
          };
          activeSW.postMessage({ type: 'CLEAR_MEDIA_CACHE' }, [channel.port2]);
        });
        return cleared;
      }
    } catch {
      // 退化：直接调用 caches.delete
    }
  }
  // 主线程直接删除（SW 未注册/未激活）
  try {
    return await caches.delete(MEDIA_CACHE_NAME);
  } catch {
    return false;
  }
}

/**
 * 获取媒体缓存统计（通过 SW 消息）。
 * SW 未激活时退化为主线程统计。
 */
export async function getMediaCacheStats(): Promise<MediaCacheStats> {
  if (!isCacheStorageAvailable()) {
    return { count: 0, totalBytes: 0, oldestTimestamp: 0, maxEntries: 200 };
  }

  // 优先通过 SW 获取（更准确，避免主线程读全部 blob）
  if (isServiceWorkerAvailable()) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const activeSW = reg?.active;
      if (activeSW) {
        const stats = await new Promise<MediaCacheStats | null>((resolve) => {
          const channel = new MessageChannel();
          const timer = setTimeout(() => resolve(null), 3000);
          channel.port1.onmessage = (e) => {
            clearTimeout(timer);
            if (e.data?.type === 'MEDIA_CACHE_STATS_RESULT') {
              resolve({
                count: e.data.count ?? 0,
                totalBytes: e.data.totalBytes ?? 0,
                oldestTimestamp: e.data.oldestTimestamp ?? 0,
                maxEntries: e.data.maxEntries ?? 200,
              });
            } else {
              resolve(null);
            }
          };
          activeSW.postMessage({ type: 'MEDIA_CACHE_STATS' }, [channel.port2]);
        });
        if (stats) return stats;
      }
    } catch {
      // 退化到主线程统计
    }
  }

  // 主线程统计（退化路径）
  return await computeStatsInMainThread();
}

/** 主线程统计：遍历所有 keys 累加 bytes */
async function computeStatsInMainThread(): Promise<MediaCacheStats> {
  try {
    const cache = await caches.open(MEDIA_CACHE_NAME);
    const keys = await cache.keys();
    let totalBytes = 0;
    let oldestTimestamp = 0;
    for (const req of keys) {
      try {
        const res = await cache.match(req);
        if (!res) continue;
        const blob = await res.clone().blob();
        totalBytes += blob.size;
        const cachedAt = res.headers.get('X-Cache-Date');
        if (cachedAt) {
          const t = parseInt(cachedAt, 10);
          if (!isNaN(t) && (!oldestTimestamp || t < oldestTimestamp)) {
            oldestTimestamp = t;
          }
        }
      } catch {
        // 跳过无法读取的项
      }
    }
    return { count: keys.length, totalBytes, oldestTimestamp, maxEntries: 200 };
  } catch {
    return { count: 0, totalBytes: 0, oldestTimestamp: 0, maxEntries: 200 };
  }
}

/** MIME 推断辅助 */
function guessMimeFromUrl(url: string): string {
  try {
    const path = url.split('?')[0];
    const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
    const map: Record<string, string> = {
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

/** 触发浏览器原生下载（兜底方案：用户手动另存为） */
export function triggerNativeDownload(url: string, suggestedName: string): boolean {
  if (typeof document === 'undefined' || !url) return false;
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch {
    return false;
  }
}