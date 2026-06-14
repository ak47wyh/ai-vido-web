/**
 * cacheMonitor — 文本生成缓存命中率监控
 *
 * 记录每次调用的缓存使用情况，提供：
 * - 实时统计（命中率、节省 tokens、节省比例）
 * - 持久化到 localStorage
 * - 订阅器模式供 UI 实时显示
 */

const STORAGE_KEY = 'minimax_cache_stats';
const MAX_HISTORY = 100;

export interface CacheStat {
  timestamp: number;
  scene: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  cacheCreationTokens: number;
  hit: boolean;
  savedPercent: number;
}

export interface CacheStatsSummary {
  totalCalls: number;
  totalCachedTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  hitRate: number;          // 0-1
  avgSavedPercent: number;  // 0-100
  recentStats: CacheStat[];
}

class CacheMonitorService {
  private stats: CacheStat[] = [];
  private subscribers: Set<() => void> = new Set();

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.stats = JSON.parse(raw);
    } catch {
      this.stats = [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats.slice(-MAX_HISTORY)));
    } catch {
      // ignore quota errors
    }
  }

  private notify(): void {
    this.subscribers.forEach(cb => cb());
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  record(stat: Omit<CacheStat, 'hit' | 'savedPercent' | 'timestamp'>): void {
    const totalInputTokens = stat.promptTokens + stat.cachedTokens + stat.cacheCreationTokens;
    const savedPercent = totalInputTokens > 0
      ? Math.round((stat.cachedTokens / totalInputTokens) * 100)
      : 0;

    const entry: CacheStat = {
      ...stat,
      timestamp: Date.now(),
      hit: stat.cachedTokens > 0,
      savedPercent
    };

    this.stats.push(entry);
    if (this.stats.length > MAX_HISTORY) {
      this.stats = this.stats.slice(-MAX_HISTORY);
    }
    this.save();
    this.notify();
  }

  getStats(): CacheStatsSummary {
    const total = this.stats.length;
    if (total === 0) {
      return {
        totalCalls: 0,
        totalCachedTokens: 0,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        hitRate: 0,
        avgSavedPercent: 0,
        recentStats: []
      };
    }

    const totalCachedTokens = this.stats.reduce((sum, s) => sum + s.cachedTokens, 0);
    const totalPromptTokens = this.stats.reduce((sum, s) => sum + s.promptTokens, 0);
    const totalCompletionTokens = this.stats.reduce((sum, s) => sum + s.completionTokens, 0);
    const hits = this.stats.filter(s => s.hit).length;
    const avgSavedPercent = Math.round(
      this.stats.reduce((sum, s) => sum + s.savedPercent, 0) / total
    );

    return {
      totalCalls: total,
      totalCachedTokens,
      totalPromptTokens,
      totalCompletionTokens,
      hitRate: hits / total,
      avgSavedPercent,
      recentStats: this.stats.slice(-20).reverse()
    };
  }

  reset(): void {
    this.stats = [];
    this.save();
    this.notify();
  }
}

export const cacheMonitor = new CacheMonitorService();

/** Helper: extract usage and record */
export function recordTextGenUsage(
  scene: string,
  usage: {
    promptTokens?: number;
    completionTokens?: number;
    cachedTokens?: number;
    cacheCreationTokens?: number;
  } | undefined
): void {
  if (!usage) return;
  cacheMonitor.record({
    scene,
    promptTokens: usage.promptTokens ?? 0,
    completionTokens: usage.completionTokens ?? 0,
    cachedTokens: usage.cachedTokens ?? 0,
    cacheCreationTokens: usage.cacheCreationTokens ?? 0
  });
}
