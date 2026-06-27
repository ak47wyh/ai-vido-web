import type { IFileStoragePort, FileStorageStats } from '../../../domain/ports/FileStoragePorts';
import type { GeneratedFileType } from '../../../domain/entities/models';

/**
 * IndexedDB 文件存储适配器 — OPFS 不可用时的降级方案。
 *
 * 使用独立的 IndexedDB 数据库存储 Blob，按文件类型分目录。
 * 功能与 OPFSFileStorageAdapter 完全对等，但性能略低。
 */

const DB_NAME = 'app-file-storage';
const DB_VERSION = 1;
const BLOB_STORE = 'blobs';
const META_STORE = 'meta';

interface FileMeta {
  path: string;
  size: number;
  mimeType: string;
  fileType: GeneratedFileType;
  lastAccessed: number;
  createdAt: number;
}

export class IndexedDBFileStorageAdapter implements IFileStoragePort {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private activeObjectUrls = new Set<string>();
  private static readonly DEFAULT_MAX_CAPACITY = 500 * 1024 * 1024;

  async initialize(): Promise<void> {
    await this.getDB();
  }

  async storeBlob(path: string, blob: Blob): Promise<void> {
    const db = await this.getDB();
    const fileType = this.pathToFileType(path);
    const meta: FileMeta = {
      path,
      size: blob.size,
      mimeType: blob.type,
      fileType,
      lastAccessed: Date.now(),
      createdAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction([BLOB_STORE, META_STORE], 'readwrite');
      tx.objectStore(BLOB_STORE).put(blob, path);
      tx.objectStore(META_STORE).put(meta, path);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getBlob(path: string): Promise<Blob | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([BLOB_STORE, META_STORE], 'readwrite');
      const getReq = tx.objectStore(BLOB_STORE).get(path);
      getReq.onsuccess = () => {
        const blob = getReq.result as Blob | undefined;
        if (blob) {
          // 更新 lastAccessed
          const metaReq = tx.objectStore(META_STORE).get(path);
          metaReq.onsuccess = () => {
            const meta = metaReq.result as FileMeta | undefined;
            if (meta) {
              meta.lastAccessed = Date.now();
              tx.objectStore(META_STORE).put(meta, path);
            }
          };
        }
        resolve(blob || null);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async deleteBlob(path: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([BLOB_STORE, META_STORE], 'readwrite');
      tx.objectStore(BLOB_STORE).delete(path);
      tx.objectStore(META_STORE).delete(path);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async blobExists(path: string): Promise<boolean> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BLOB_STORE, 'readonly');
      const req = tx.objectStore(BLOB_STORE).getKey(path);
      req.onsuccess = () => resolve(req.result !== undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async getObjectUrl(path: string): Promise<string> {
    const blob = await this.getBlob(path);
    if (!blob) throw new Error(`[IndexedDBFileStorage] File not found: ${path}`);
    const url = URL.createObjectURL(blob);
    this.activeObjectUrls.add(url);
    return url;
  }

  revokeObjectUrl(url: string): void {
    if (this.activeObjectUrls.has(url)) {
      URL.revokeObjectURL(url);
      this.activeObjectUrls.delete(url);
    }
  }

  async getStats(): Promise<FileStorageStats> {
    const db = await this.getDB();
    const metas = await this.getAllMeta(db);

    const stats: FileStorageStats = {
      totalSize: 0,
      totalFiles: metas.length,
      byType: {
        image: { count: 0, size: 0 },
        audio: { count: 0, size: 0 },
        video: { count: 0, size: 0 },
        other: { count: 0, size: 0 },
      },
      maxCapacity: IndexedDBFileStorageAdapter.DEFAULT_MAX_CAPACITY,
    };

    for (const meta of metas) {
      stats.byType[meta.fileType].count++;
      stats.byType[meta.fileType].size += meta.size;
      stats.totalSize += meta.size;
    }

    return stats;
  }

  async evictLRU(maxSizeBytes: number): Promise<number> {
    const db = await this.getDB();
    const metas = await this.getAllMeta(db);
    metas.sort((a, b) => a.lastAccessed - b.lastAccessed);

    let totalSize = metas.reduce((sum, m) => sum + m.size, 0);
    let evictedBytes = 0;
    let i = 0;

    while (totalSize > maxSizeBytes && i < metas.length) {
      await this.deleteBlob(metas[i].path);
      totalSize -= metas[i].size;
      evictedBytes += metas[i].size;
      i++;
    }

    return evictedBytes;
  }

  async clearAll(): Promise<void> {
    const db = await this.getDB();

    // 释放所有活跃 Object URL
    for (const url of this.activeObjectUrls) {
      URL.revokeObjectURL(url);
    }
    this.activeObjectUrls.clear();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([BLOB_STORE, META_STORE], 'readwrite');
      tx.objectStore(BLOB_STORE).clear();
      tx.objectStore(META_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  isAvailable(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  getStorageType(): 'indexeddb' {
    return 'indexeddb';
  }

  // ===== Private helpers =====

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const idb = req.result;
        if (!idb.objectStoreNames.contains(BLOB_STORE)) {
          idb.createObjectStore(BLOB_STORE);
        }
        if (!idb.objectStoreNames.contains(META_STORE)) {
          idb.createObjectStore(META_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    return this.dbPromise;
  }

  private async getAllMeta(db: IDBDatabase): Promise<FileMeta[]> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readonly');
      const req = tx.objectStore(META_STORE).getAll();
      req.onsuccess = () => resolve((req.result as FileMeta[]) || []);
      req.onerror = () => reject(req.error);
    });
  }

  private pathToFileType(path: string): GeneratedFileType {
    if (path.startsWith('images/')) return 'image';
    if (path.startsWith('audio/')) return 'audio';
    if (path.startsWith('video/')) return 'video';
    return 'other';
  }
}
