import type { IFileStoragePort } from '../../../domain/ports/FileStoragePorts';
import type { ILoggerPort } from '../../../domain/ports/CrossCuttingPorts';
import { ConsoleLoggerAdapter } from '../infrastructure/ConsoleLoggerAdapter';
import { OPFSFileStorageAdapter } from './OPFSFileStorageAdapter';
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
function getPreferredStorageType(): 'local' | 'opfs' | 'auto' {
  if (typeof window === 'undefined') return 'local';
  const pref = window.localStorage.getItem('ai_vido_storage_preference');
  if (pref === 'local' || pref === 'opfs' || pref === 'auto') {
    return pref;
  }
  // 默认 local：强制优先走配置中心配置的目录
  return 'local';
}

/**
 * 创建文件存储适配器。
 *
 * 优先级（可在 Settings 面板里用 localStorage key `ai_vido_storage_preference` 覆盖）：
 *   1. 偏好 = 'local'（默认）：直接用 FilesLocalAdapter（落盘到配置中心配置的目录）
 *   2. 偏好 = 'opfs'：用 OPFS（浏览器 Origin Private File System）
 *   3. 偏好 = 'auto'：依次探测 FilesLocal → OPFS
 *
 * **降级链为 2 级：FilesLocal → OPFS**。
 * 文件以文件格式存储到配置目录或 OPFS，**不存入 IndexedDB**（IndexedDB 仅存元数据）。
 * OPFS 不可用且 FilesLocal 不可用时直接抛错，不再降级到 IndexedDBFileStorageAdapter。
 *
 * @param logger 可选 logger；缺省时使用独立 ConsoleLoggerAdapter（避免循环依赖）
 */
export async function createFileStorageAdapter(
  logger?: ILoggerPort,
): Promise<IFileStoragePort> {
  const log = logger ?? new ConsoleLoggerAdapter({ service: 'fileStorage' });
  const preference = getPreferredStorageType();

  // 1) 用户明确选择 local（默认）
  if (preference === 'local') {
    const adapter = new FilesLocalAdapter();
    await adapter.initialize();
    log.info('[FileStorage] Using FilesLocal (Vite plugin, local disk)', {
      service: 'fileStorage',
      storageType: 'local',
    });
    return adapter;
  }

  // 2) 用户明确选择 opfs
  if (preference === 'opfs') {
    if (await isOPFSAvailable()) {
      const adapter = new OPFSFileStorageAdapter();
      await adapter.initialize();
      log.info('[FileStorage] Using OPFS (Origin Private File System)', {
        service: 'fileStorage',
        storageType: 'opfs',
      });
      return adapter;
    }
    throw new Error('[FileStorage] 用户选择了 OPFS 但浏览器不支持，且已移除 IndexedDB 兜底。请在配置中心改用 local。');
  }

  // 3) 自动模式：先探测 local（最稳定、不依赖浏览器私有文件系统）
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
    log.warn('[FileStorage] FilesLocal 不可用（Vite 插件未挂载），回退到 OPFS', {
      service: 'fileStorage',
    });

    // OPFS 兜底
    if (await isOPFSAvailable()) {
      const adapter = new OPFSFileStorageAdapter();
      await adapter.initialize();
      log.info('[FileStorage] Using OPFS (Origin Private File System)', {
        service: 'fileStorage',
        storageType: 'opfs',
      });
      return adapter;
    }

    // 不再降级到 IndexedDB——文件不存入 IndexedDB
    throw new Error(
      '[FileStorage] FilesLocal 和 OPFS 均不可用。已移除 IndexedDB 文件存储兜底——' +
      'IndexedDB 仅存元数据，文件必须存到配置目录或 OPFS。' +
      '请启动 Vite dev server（启用 FilesLocalAdapter）或使用支持 OPFS 的浏览器。'
    );
  }

  // 理论不可达
  throw new Error(`[FileStorage] 未知的存储偏好：${preference}`);
}
