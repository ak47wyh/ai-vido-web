import type { GeneratedFile } from '../../../domain/entities/models';

/**
 * OfflineCache → OPFS 数据迁移工具。
 *
 * 在应用首次启动时运行，将旧 `minimax-offline-cache` IndexedDB 中的
 * Blob 数据迁移到新的 OPFS / IndexedDB 文件存储层。
 *
 * 迁移完成后在 localStorage 中标记 `file_storage_migrated=true`，
 * 后续启动不再重复迁移。
 */

const OLD_DB_NAME = 'minimax-offline-cache';
const OLD_DB_VERSION = 1;
const OLD_BLOB_STORE = 'blobs';
const OLD_META_STORE = 'meta';
const MIGRATION_FLAG_KEY = 'file_storage_migrated';

interface OldCacheMeta {
  key: string;
  size: number;
  contentType: string;
  lastAccessed: number;
  createdAt: number;
}

/**
 * 检查是否需要迁移。
 */
export function needsMigration(): boolean {
  try {
    return !localStorage.getItem(MIGRATION_FLAG_KEY);
  } catch {
    return true; // localStorage 不可用时默认执行迁移
  }
}

/**
 * 标记迁移完成。
 */
function markMigrated(): void {
  try {
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
  } catch {
    // 忽略
  }
}

/**
 * 打开旧的 OfflineCache IndexedDB。
 */
function openOldDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OLD_DB_NAME, OLD_DB_VERSION);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 读取旧库中所有 Blob 和元数据。
 */
async function readOldEntries(db: IDBDatabase): Promise<{ key: string; blob: Blob; meta: OldCacheMeta }[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([OLD_BLOB_STORE, OLD_META_STORE], 'readonly');
    const blobStore = tx.objectStore(OLD_BLOB_STORE);
    const metaStore = tx.objectStore(OLD_META_STORE);

    const results: { key: string; blob: Blob; meta: OldCacheMeta }[] = [];

    const metaReq = metaStore.getAll();
    metaReq.onsuccess = () => {
      const metas = (metaReq.result as OldCacheMeta[]) || [];

      let completed = 0;
      if (metas.length === 0) {
        resolve([]);
        return;
      }

      for (const meta of metas) {
        const blobReq = blobStore.get(meta.key);
        blobReq.onsuccess = () => {
          const blob = blobReq.result as Blob | undefined;
          if (blob) {
            results.push({ key: meta.key, blob, meta });
          }
          completed++;
          if (completed === metas.length) {
            resolve(results);
          }
        };
        blobReq.onerror = () => {
          completed++;
          if (completed === metas.length) {
            resolve(results);
          }
        };
      }
    };
    metaReq.onerror = () => reject(metaReq.error);
  });
}

/**
 * 将旧 key 映射到新的 OPFS 路径。
 *
 * 旧 key 格式：`asset:image:{id}` / `asset:voice:{id}`
 * 新路径格式：`images/{id}` / `audio/{id}`
 */
function mapKeyToPath(key: string, contentType: string): string {
  // 尝试从旧 key 中提取 ID
  const parts = key.split(':');
  const id = parts.length >= 3 ? parts.slice(2).join(':') : key;

  if (key.startsWith('asset:image:') || contentType.startsWith('image/')) {
    return `images/${id}`;
  }
  if (key.startsWith('asset:voice:') || contentType.startsWith('audio/')) {
    return `audio/${id}`;
  }
  if (contentType.startsWith('video/')) {
    return `video/${id}`;
  }
  return `other/${id}`;
}

/** 从 contentType 推断文件类型 */
function inferFileType(contentType: string): 'image' | 'audio' | 'video' | 'other' {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType.startsWith('video/')) return 'video';
  return 'other';
}

/** 从 contentType 推断文件扩展名 */
function inferExtension(contentType: string): string {
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
    'audio/webm': '.webm',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
  };
  return map[contentType] || '';
}

/**
 * 执行迁移。
 *
 * @param fileStorage 新的文件存储适配器
 * @param fileRepo    新的文件元数据仓储
 * @param defaultSpaceId 默认工作空间 ID
 * @returns 迁移的文件数量
 */
export async function migrateOfflineCache(
  fileStorage: { storeBlob(path: string, blob: Blob): Promise<void> },
  fileRepo: { save(file: GeneratedFile): Promise<void> },
  defaultSpaceId: string = '__default__',
): Promise<number> {
  if (!needsMigration()) {
    console.log('[FileStorage Migration] Already migrated, skipping.');
    return 0;
  }

  console.log('[FileStorage Migration] Starting migration from OfflineCache...');

  let oldDB: IDBDatabase | null = null;
  let migratedCount = 0;

  try {
    oldDB = await openOldDB();
    const entries = await readOldEntries(oldDB);

    for (const { key, blob, meta } of entries) {
      try {
        const newPath = mapKeyToPath(key, meta.contentType);
        const fileType = inferFileType(meta.contentType);
        const ext = inferExtension(meta.contentType);

        // 生成唯一 ID（使用旧 key 的 hash 或原始 ID）
        const id = `migrated_${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

        // 写入新存储
        await fileStorage.storeBlob(newPath, blob);

        // 写入元数据
        const generatedFile: GeneratedFile = {
          id,
          spaceId: defaultSpaceId,
          fileType,
          mimeType: meta.contentType || 'application/octet-stream',
          fileName: `${id}${ext}`,
          fileSize: meta.size,
          storagePath: newPath,
          tags: ['migrated'],
          lastAccessedAt: meta.lastAccessed,
          createdAt: meta.createdAt,
        };

        await fileRepo.save(generatedFile);
        migratedCount++;
      } catch (err) {
        console.warn(`[FileStorage Migration] Failed to migrate key "${key}":`, err);
        // 继续迁移其他文件
      }
    }

    markMigrated();
    console.log(`[FileStorage Migration] Completed. Migrated ${migratedCount}/${entries.length} files.`);
  } catch (err) {
    console.error('[FileStorage Migration] Failed:', err);
    // 不标记为已迁移，下次启动时重试
  } finally {
    if (oldDB) {
      oldDB.close();
    }
  }

  return migratedCount;
}
