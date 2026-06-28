import type { IFileStoragePort } from '../../../domain/ports/FileStoragePorts';
import type { ILoggerPort } from '../../../domain/ports/CrossCuttingPorts';
import { ConsoleLoggerAdapter } from '../infrastructure/ConsoleLoggerAdapter';
import { OPFSFileStorageAdapter } from './OPFSFileStorageAdapter';
import { IndexedDBFileStorageAdapter } from './IndexedDBFileStorageAdapter';
import { FilesLocalAdapter } from './FilesLocalAdapter';

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
 * 检测本地文件存储后端是否可用（Vite 插件 /__files/list 路由响应）。
 */
async function isFilesLocalAvailable(): Promise<boolean> {
  try {
    const apiBase = typeof window !== 'undefined'
      ? (window.localStorage.getItem('ai_vido_files_api_base') || '/__files')
      : '/__files';
    const res = await fetch(`${apiBase}/list?dir=images`);
    return res.ok;
  } catch {
    return false;
  }
}

/** 读取用户在 Settings 面板配置的存储偏好 */
function getPreferredStorageType(): 'local' | 'opfs' | 'indexeddb' | 'auto' {
  if (typeof window === 'undefined') return 'auto';
  const pref = window.localStorage.getItem('ai_vido_storage_preference');
  if (pref === 'local' || pref === 'opfs' || pref === 'indexeddb' || pref === 'auto') {
    return pref;
  }
  return 'auto';
}

/**
 * 创建文件存储适配器。
 *
 * 优先级（可在 Settings 面板里用 localStorage key `ai_vido_storage_preference` 覆盖）：
 *   1. 偏好 = 'local'：直接用 FilesLocalAdapter（无需 fetch 外部 URL，避免 CORS）
 *   2. 偏好 = 'opfs' / 'indexeddb'：按指定类型创建
 *   3. 偏好 = 'auto'（默认）：依次探测
 *      a. FilesLocalAdapter —— Vite dev server 自带，开箱即用
 *      b. OPFS —— 浏览器 OPFS（写入需要 fetch 外部 URL 时会失败）
 *      c. IndexedDB —— 兜底
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
  const preference = getPreferredStorageType();

  // 1) 用户明确选择 local
  if (preference === 'local') {
    const adapter = new FilesLocalAdapter();
    await adapter.initialize();
    log.info('[FileStorage] Using FilesLocal (Vite plugin, local disk)', {
      service: 'fileStorage',
      storageType: 'local',
    });
    return adapter;
  }

  // 2) 自动模式：先探测 local（最稳定、不依赖浏览器私有文件系统）
  if (preference === 'auto') {
    if (await isFilesLocalAvailable()) {
      const adapter = new FilesLocalAdapter();
      await adapter.initialize();
      log.info('[FileStorage] Using FilesLocal (Vite plugin, local disk)', {
        service: 'fileStorage',
        storageType: 'local',
      });
      return adapter;
    }
    log.warn('[FileStorage] FilesLocal 不可用（Vite 插件未挂载），回退到 OPFS/IndexedDB', {
      service: 'fileStorage',
    });
  }

  // 3) OPFS
  if (await isOPFSAvailable()) {
    const adapter = new OPFSFileStorageAdapter();
    await adapter.initialize();
    log.info('[FileStorage] Using OPFS (Origin Private File System)', {
      service: 'fileStorage',
      storageType: 'opfs',
    });
    return adapter;
  }

  // 4) IndexedDB 兜底
  log.warn('[FileStorage] OPFS not available, falling back to IndexedDB', {
    service: 'fileStorage',
    storageType: 'indexeddb',
  });
  const adapter = new IndexedDBFileStorageAdapter();
  await adapter.initialize();
  return adapter;
}