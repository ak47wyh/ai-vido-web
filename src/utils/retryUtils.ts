/**
 * retryUtils — 智能重试工具（指数退避 + jitter）
 *
 * 特性：
 * - 指数退避（exponential backoff）
 * - 随机抖动（jitter）防止雪崩
 * - 可配置最大重试次数和初始延迟
 * - 支持 AbortSignal 中止
 * - 自动判断可重试错误（5xx、超时、429、网络）
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
  signal?: AbortSignal;
  onRetry?: (attempt: number, error: unknown, nextDelayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'signal' | 'onRetry'>> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

/** Errors that should NOT be retried (auth, validation, content policy) */
const NON_RETRYABLE_PATTERNS = [
  /authentication/i,
  /api[_\s]?key/i,
  /unauthorized/i,
  /forbidden/i,
  /invalid[_\s]?param/i,
  /content[_\s]?(policy|violation|sensitive|blocked)/i,
  /safety[_\s]?check/i,
  /insufficient[_\s]?balance/i,
];

export function isRetryableError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);

  for (const pattern of NON_RETRYABLE_PATTERNS) {
    if (pattern.test(message)) return false;
  }

  // Retry on timeout, network, 5xx, 429
  if (/timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENETUNREACH/i.test(message)) return true;
  if (/5\d\d/.test(message)) return true;
  if (/429/.test(message)) return true;
  if (/rate[_\s]?limit/i.test(message)) return true;
  if (/server[_\s]?error/i.test(message)) return true;
  if (/network/i.test(message)) return true;

  return false;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timeout);
      reject(new Error('Aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function computeDelay(
  attempt: number,
  options: Required<Omit<RetryOptions, 'signal' | 'onRetry'>>
): number {
  const baseDelay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt);
  const cappedDelay = Math.min(baseDelay, options.maxDelayMs);

  if (!options.jitter) return cappedDelay;

  // Full jitter: random between 0 and cappedDelay
  return Math.floor(Math.random() * cappedDelay);
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { maxRetries, signal, onRetry } = opts;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (signal?.aborted) {
        throw new Error('Aborted');
      }
      return await fn();
    } catch (error) {
      lastError = error;

      if (signal?.aborted) throw error;

      const isLastAttempt = attempt === maxRetries;
      const retryable = isRetryableError(error);

      if (isLastAttempt || !retryable) {
        throw error;
      }

      const delay = computeDelay(attempt, opts);
      onRetry?.(attempt + 1, error, delay);
      await sleep(delay, signal);
    }
  }

  throw lastError;
}

/** Decorator version: wraps a function with retry logic */
export function withRetry<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TReturn> {
  return (...args: TArgs) => retryWithBackoff(() => fn(...args), options);
}
