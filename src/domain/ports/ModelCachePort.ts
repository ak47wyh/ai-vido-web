/**
 * ModelCachePort —— 模型元数据缓存端口
 *
 * 取代 ModelManagementService 中直接 localStorage.setItem 的反模式。
 * 实现可选择：localStorage（小数据）、IndexedDB（大数据）、内存（测试）。
 */

export interface CachedModels<T = unknown> {
  models: T[];
  cachedAt: number;
}

export interface IModelCachePort<T = unknown> {
  /** 读取缓存（不存在返回 null） */
  read(): Promise<CachedModels<T> | null>;
  /** 写入缓存 */
  write(data: CachedModels<T>): Promise<void>;
  /** 清空缓存 */
  clear(): Promise<void>;
  /** 缓存有效期（ms），实现可在 read 时自动判断 */
  readonly ttlMs: number;
  /** 缓存 key（用于多类型缓存区分） */
  readonly cacheKey: string;
}
