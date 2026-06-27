/**
 * DefaultResilienceAdapter —— IResiliencePort 的默认实现
 *
 * 提供：retry（含指数退避）、circuit breaker。
 * 内部使用内存 Map 记录每个 key 的失败次数与上次打开时间。
 */

import type { IResiliencePort, RetryOptions, CircuitBreakerOptions } from '../../../domain/ports/CrossCuttingPorts';

interface BreakerState {
  failures: number;
  openedAt: number;
}

export class DefaultResilienceAdapter implements IResiliencePort {
  private breakers = new Map<string, BreakerState>();

  async retry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
    const { maxAttempts, baseDelayMs, maxDelayMs, backoff = 'exponential' } = options;
    const retryOn = options.retryOn ?? (() => true);
    let lastErr: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (attempt === maxAttempts - 1 || !retryOn(err)) break;
        const delay = this.computeDelay(attempt, baseDelayMs, maxDelayMs ?? 30000, backoff);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastErr;
  }

  async withCircuitBreaker<T>(
    key: string,
    fn: () => Promise<T>,
    options: CircuitBreakerOptions
  ): Promise<T> {
    const state = this.breakers.get(key);
    const now = Date.now();
    if (state && now - state.openedAt < options.cooldownMs) {
      throw new Error(`Circuit breaker open for key="${key}"`);
    }
    try {
      const result = await fn();
      // 成功则重置
      if (state) this.breakers.delete(key);
      return result;
    } catch (err) {
      const next: BreakerState = state
        ? { failures: state.failures + 1, openedAt: state.openedAt }
        : { failures: 1, openedAt: now };
      if (next.failures >= options.failureThreshold) {
        next.openedAt = now;
      }
      this.breakers.set(key, next);
      throw err;
    }
  }

  private computeDelay(attempt: number, base: number, max: number, backoff: 'linear' | 'exponential'): number {
    const raw = backoff === 'exponential' ? base * 2 ** attempt : base * (attempt + 1);
    return Math.min(raw, max);
  }
}

export const defaultResilience: IResiliencePort = new DefaultResilienceAdapter();
