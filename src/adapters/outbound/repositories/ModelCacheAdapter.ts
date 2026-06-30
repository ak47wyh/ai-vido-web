/**
 * ModelCacheAdapter —— IModelCachePort 的 localStorage 实现
 *
 * 用于 ModelManagementService 的模型元数据缓存。
 * 之所以使用 localStorage 而非 IndexedDB：缓存数据量小、读多写少、需同步访问。
 */

import type { IModelCachePort, CachedModels } from '../../../domain/ports/ModelCachePort';

export class ModelCacheAdapter<T = unknown> implements IModelCachePort<T> {
  public readonly cacheKey: string;
  public readonly ttlMs: number;

  constructor(
    cacheKey: string,
    ttlMs: number = 30 * 60 * 1000 // 默认 30 分钟
  ) {
    this.cacheKey = cacheKey;
    this.ttlMs = ttlMs;
  }

  async read(): Promise<CachedModels<T> | null> {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(this.cacheKey);
      if (!raw) return null;
      const cached = JSON.parse(raw) as CachedModels<T>;
      if (Date.now() - cached.cachedAt > this.ttlMs) return null;
      return cached;
    } catch {
      return null;
    }
  }

  async write(data: CachedModels<T>): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(this.cacheKey, JSON.stringify(data));
  }

  async clear(): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(this.cacheKey);
  }
}
