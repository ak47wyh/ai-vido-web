/**
 * offlineCache — 离线缓存工具
 *
 * 提供：
 * - Service Worker 注册（占位实现，实际 SW 需在 public/sw.js 注册）
 * - OPFS (Origin Private File System) Blob 缓存
 * - 缓存配额管理 + LRU 淘汰
 * - 离线状态检测
 *
 * 使用：
 *   const cached = await offlineCache.getCachedBlob(url);
 *   if (cached) { return URL.createObjectURL(cached); }
 *   const fresh = await fetch(url).then(r => r.blob());
 *   await offlineCache.setCachedBlob(url, fresh);
 */

const CACHE_VERSION = '1.0.0';
const DB_NAME = 'minimax-offline-cache';
const DB_VERSION = 1;
const STORE_NAME = 'blobs';
const META_STORE = 'meta';
const MAX_TOTAL_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_ENTRIES = 200;

export interface CacheEntry {
  key: string;
  size: number;
  contentType: string;
  lastAccessed: number;
  createdAt: number;
}

export class OfflineCache {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private totalSize = 0;

  constructor() {
    this.openDB();
  }

  private async openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  }

  async setCachedBlob(key: string, blob: Blob): Promise<void> {
    const db = await this.openDB();
    const meta: CacheEntry = {
      key,
      size: blob.size,
      contentType: blob.type,
      lastAccessed: Date.now(),
      createdAt: Date.now(),
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
      tx.objectStore(STORE_NAME).put(blob, key);
      tx.objectStore(META_STORE).put(meta, key);
      tx.oncomplete = async () => {
        this.totalSize += blob.size;
        await this.evictIfNeeded();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCachedBlob(key: string): Promise<Blob | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
      const getReq = tx.objectStore(STORE_NAME).get(key);
      getReq.onsuccess = () => {
        const blob = getReq.result as Blob | undefined;
        if (blob) {
          // Update lastAccessed
          const metaReq = tx.objectStore(META_STORE).get(key);
          metaReq.onsuccess = () => {
            const meta = metaReq.result as CacheEntry | undefined;
            if (meta) {
              meta.lastAccessed = Date.now();
              tx.objectStore(META_STORE).put(meta, key);
            }
          };
        }
        resolve(blob || null);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async removeCached(key: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.objectStore(META_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllEntries(): Promise<CacheEntry[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readonly');
      const getAll = tx.objectStore(META_STORE).getAll();
      getAll.onsuccess = () => resolve((getAll.result as CacheEntry[]) || []);
      getAll.onerror = () => reject(getAll.error);
    });
  }

  async getTotalSize(): Promise<number> {
    const entries = await this.getAllEntries();
    return entries.reduce((sum, e) => sum + e.size, 0);
  }

  async clearAll(): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.objectStore(META_STORE).clear();
      tx.oncomplete = () => { this.totalSize = 0; resolve(); };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * LRU eviction: if total size exceeds MAX_TOTAL_SIZE or entry count exceeds MAX_ENTRIES,
   * remove least recently accessed entries.
   */
  private async evictIfNeeded(): Promise<void> {
    const entries = await this.getAllEntries();
    entries.sort((a, b) => a.lastAccessed - b.lastAccessed);

    let totalSize = entries.reduce((sum, e) => sum + e.size, 0);
    let i = 0;
    while ((totalSize > MAX_TOTAL_SIZE || entries.length - i > MAX_ENTRIES) && i < entries.length) {
      totalSize -= entries[i].size;
      await this.removeCached(entries[i].key);
      i++;
    }
  }

  /**
   * Try to load from cache, otherwise fetch and cache.
   * Returns Blob URL.
   */
  async getOrFetch(key: string, fetcher: () => Promise<Blob>): Promise<{ blob: Blob; fromCache: boolean; objectUrl: string }> {
    let blob = await this.getCachedBlob(key);
    let fromCache = true;
    if (!blob) {
      blob = await fetcher();
      fromCache = false;
      try {
        await this.setCachedBlob(key, blob);
      } catch {
        // ignore cache write failures
      }
    }
    const objectUrl = URL.createObjectURL(blob);
    return { blob, fromCache, objectUrl };
  }
}

export const offlineCache = new OfflineCache();

/**
 * Service Worker registration helper.
 * Returns null if SW API is not available.
 */
const BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
const resolvedScope = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`;

export async function registerServiceWorker(
  swPath = `${resolvedScope}sw.js`,
): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported');
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register(swPath, {
      scope: resolvedScope,
      updateViaCache: 'none',
    });
    // 检查是否有新版本等待激活，有则立即触发
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      }
    });
    console.log('[SW] Registered with scope:', registration.scope);
    return registration;
  } catch (e) {
    console.error('[SW] Registration failed:', e);
    return null;
  }
}

/**
 * Detect online/offline state.
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Subscribe to online/offline events.
 */
export function subscribeNetworkStatus(onChange: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handleOnline = () => onChange(true);
  const handleOffline = () => onChange(false);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

export { CACHE_VERSION, MAX_TOTAL_SIZE, MAX_ENTRIES };
