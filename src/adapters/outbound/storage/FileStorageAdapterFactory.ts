import type { IFileStoragePort } from '../../../domain/ports/FileStoragePorts';
import { OPFSFileStorageAdapter } from './OPFSFileStorageAdapter';
import { IndexedDBFileStorageAdapter } from './IndexedDBFileStorageAdapter';

/**
 * 检测 OPFS 是否可用。
 * 实际尝试获取 OPFS 根目录来验证（某些浏览器声明支持但实际不可用）。
 */
async function isOPFSAvailable(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) {
      return false;
    }
    // 实际测试访问
    const root = await navigator.storage.getDirectory();
    return root !== null;
  } catch {
    return false;
  }
}

/**
 * 创建文件存储适配器。
 *
 * 优先使用 OPFS（性能更好、文件系统语义），
 * 不支持时降级到 IndexedDB。
 *
 * 使用示例：
 * ```ts
 * const fileStorage = await createFileStorageAdapter();
 * await fileStorage.initialize();
 * ```
 */
export async function createFileStorageAdapter(): Promise<IFileStoragePort> {
  if (await isOPFSAvailable()) {
    const adapter = new OPFSFileStorageAdapter();
    await adapter.initialize();
    console.log('[FileStorage] Using OPFS (Origin Private File System)');
    return adapter;
  }

  console.warn('[FileStorage] OPFS not available, falling back to IndexedDB');
  const adapter = new IndexedDBFileStorageAdapter();
  await adapter.initialize();
  return adapter;
}
