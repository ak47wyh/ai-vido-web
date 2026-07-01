/**
 * imageCache —— 主线程直接访问 CacheStorage 媒体缓存的工具集
 *
 * 核心功能：
 * - getCachedMediaBlob(url) → Blob | null：从 CacheStorage 读取已缓存的跨域图片
 * - warmCacheFromElement(img) → void：把 <img> 当前 src 主动写入缓存（防御性）
 * - clearAllMediaCache() → boolean：清空媒体缓存（直接调用 CacheStorage）
 * - getMediaCacheStats() → 统计
 * - isSWActive() → Promise<boolean>：始终返回 false（SW 已按设计约束移除）
 *
 * 全部操作走主线程 CacheStorage，不依赖 Service Worker。
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

/**
 * 检查 Service Worker 是否已注册并激活。
 *
 * 注意：本项目已按设计约束移除 Service Worker（不再注册、不再保留 sw.js），
 * 因此本函数始终返回 false。保留函数签名仅为向后兼容（其他文件可能 import）。
 */
export async function isSWActive(): Promise<boolean> {
  return false;
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
 * 清空媒体缓存（直接调用 CacheStorage）。
 * 返回是否成功清空。
 */
export async function clearAllMediaCache(): Promise<boolean> {
  if (!isCacheStorageAvailable()) return false;
  try {
    return await caches.delete(MEDIA_CACHE_NAME);
  } catch {
    return false;
  }
}

/**
 * 获取媒体缓存统计（主线程遍历 CacheStorage）。
 */
export async function getMediaCacheStats(): Promise<MediaCacheStats> {
  if (!isCacheStorageAvailable()) {
    return { count: 0, totalBytes: 0, oldestTimestamp: 0, maxEntries: 200 };
  }
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