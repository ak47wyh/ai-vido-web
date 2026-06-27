import type { IFileStoragePort } from '../../../domain/ports/FileStoragePorts';
import type { ILoggerPort } from '../../../domain/ports/CrossCuttingPorts';
import { ConsoleLoggerAdapter } from '../infrastructure/ConsoleLoggerAdapter';
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
 * const fileStorage = await createFileStorageAdapter(logger);
 * await fileStorage.initialize();
 * ```
 *
 * @param logger 可选 logger；缺省时使用独立 ConsoleLoggerAdapter（避免循环依赖）
 */
export async function createFileStorageAdapter(
  logger?: ILoggerPort,
): Promise<IFileStoragePort> {
  const log = logger ?? new ConsoleLoggerAdapter({ service: 'fileStorage' });

  if (await isOPFSAvailable()) {
    const adapter = new OPFSFileStorageAdapter();
    await adapter.initialize();
    log.info('[FileStorage] Using OPFS (Origin Private File System)', {
      service: 'fileStorage',
      storageType: 'opfs',
    });
    return adapter;
  }

  log.warn('[FileStorage] OPFS not available, falling back to IndexedDB', {
    service: 'fileStorage',
    storageType: 'indexeddb',
  });
  const adapter = new IndexedDBFileStorageAdapter();
  await adapter.initialize();
  return adapter;
}