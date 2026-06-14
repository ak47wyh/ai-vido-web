/**
 * usePolling — 通用 Polling Hook
 *
 * 自动管理 setInterval 生命周期，避免内存泄漏。
 * 多个并发 poller 由 key 区分，自动清理之前的。
 */

import { useEffect, useRef, useState } from 'react';

export interface UsePollingOptions {
  /** 是否启用 polling */
  enabled?: boolean;
  /** 轮询间隔（ms） */
  intervalMs?: number;
  /** 最多轮询次数（达到后自动停止） */
  maxAttempts?: number;
  /** 满足条件时停止的判断函数 */
  shouldStop?: (result: unknown) => boolean;
  /** 错误回调 */
  onError?: (err: unknown) => void;
}

export interface UsePollingResult<T> {
  data: T | null;
  error: unknown | null;
  attempts: number;
  isRunning: boolean;
  stop: () => void;
  restart: () => void;
}

export function usePolling<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown> = [],
  options: UsePollingOptions = {}
): UsePollingResult<T> {
  const {
    enabled = true,
    intervalMs = 5000,
    maxAttempts = 120,
    shouldStop,
    onError,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const stopRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    stopRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  };

  const restart = () => {
    stop();
    stopRef.current = false;
    setAttempts(0);
    setData(null);
    setError(null);
  };

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    stopRef.current = false;
    setIsRunning(true);

    const tick = async () => {
      if (stopRef.current) return;
      const currentAttempt = attempts + 1;
      try {
        const result = await fetcher();
        if (stopRef.current) return;
        setData(result);
        setError(null);
        setAttempts(currentAttempt);

        if (shouldStop?.(result) || currentAttempt >= maxAttempts) {
          stop();
        }
      } catch (e) {
        if (stopRef.current) return;
        setError(e);
        onError?.(e);
        // 错误不停止（继续重试），除非 maxAttempts
        setAttempts(currentAttempt);
        if (currentAttempt >= maxAttempts) {
          stop();
        }
      }
    };

    // 立即执行一次
    tick();
    intervalRef.current = setInterval(tick, intervalMs);

    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, maxAttempts, ...deps]);

  return { data, error, attempts, isRunning, stop, restart };
}
