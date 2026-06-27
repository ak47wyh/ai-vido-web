/**
 * LocalStorageLogViewerConfigAdapter —— ILogViewerConfigPort 的 LocalStorage 实现
 *
 * 持久化键：ai_video_studio_log_viewer_config
 * 默认值：enabled=true（开发模式）/ false（生产模式），maxEntries=1000，
 *         defaultOpen=false，defaultLevel=info
 */

import type {
  ILogViewerConfig,
  ILogViewerConfigPort,
} from '../../../domain/ports/LoggingPorts';
import type { LogLevel } from '../../../domain/ports/CrossCuttingPorts';

const STORAGE_KEY = 'ai_video_studio_log_viewer_config';

const DEFAULT_CONFIG: ILogViewerConfig = {
  enabled: import.meta.env.DEV,
  maxEntries: 1000,
  defaultOpen: false,
  defaultLevel: 'info',
};

function isLogLevel(v: unknown): v is LogLevel {
  return v === 'debug' || v === 'info' || v === 'warn' || v === 'error';
}

export class LocalStorageLogViewerConfigAdapter implements ILogViewerConfigPort {
  private listeners = new Set<(cfg: ILogViewerConfig) => void>();
  private cache: ILogViewerConfig | null = null;

  get(): ILogViewerConfig {
    if (this.cache) return this.cache;
    try {
      const raw = typeof localStorage !== 'undefined'
        ? localStorage.getItem(STORAGE_KEY)
        : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        this.cache = merge(DEFAULT_CONFIG, parsed);
        return this.cache;
      }
    } catch {
      // 解析失败时使用默认值
    }
    this.cache = { ...DEFAULT_CONFIG };
    return this.cache;
  }

  set(patch: Partial<ILogViewerConfig>): ILogViewerConfig {
    const current = this.get();
    const next = merge(current, patch);
    this.cache = next;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
    } catch {
      // 存储失败时静默（隐私模式 / 容量满）
    }
    for (const l of this.listeners) {
      try { l(next); } catch { /* 隔离订阅者错误 */ }
    }
    return next;
  }

  subscribe(listener: (cfg: ILogViewerConfig) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

function merge(base: ILogViewerConfig, patch: Partial<ILogViewerConfig>): ILogViewerConfig {
  const out: ILogViewerConfig = { ...base, ...patch };
  if (patch.defaultLevel !== undefined && !isLogLevel(patch.defaultLevel)) {
    out.defaultLevel = base.defaultLevel;
  }
  if (typeof out.maxEntries !== 'number' || out.maxEntries < 1) {
    out.maxEntries = 1000;
  }
  return out;
}

export const logViewerConfig: ILogViewerConfigPort = new LocalStorageLogViewerConfigAdapter();