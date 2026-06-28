/**
 * RingBufferLogSinkAdapter —— ILogSinkPort 的内存循环缓冲实现
 *
 * 设计要点：
 * - 容量固定（默认 1000），超出后丢弃最旧条目（FIFO）。
 * - subscribe 返回的 listener 通过 queueMicrotask 异步触发，
 *   避免同步调用链中的异常污染上游 logger。
 * - listener 抛错被 try/catch 隔离，互不影响。
 * - JS 单线程，无需锁；批量写入时由微任务合并触发。
 */

import type { ILogSinkPort, LogEntry } from '../../../domain/ports/LoggingPorts';

export class RingBufferLogSinkAdapter implements ILogSinkPort {
  private buffer: LogEntry[] = [];
  private listeners = new Set<(e: LogEntry) => void>();

  constructor(private capacity: number = 1000) {
    if (capacity < 1) {
      throw new Error('RingBufferLogSinkAdapter: capacity must be >= 1');
    }
  }

  write(entry: LogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length > this.capacity) {
      this.buffer.splice(0, this.buffer.length - this.capacity);
    }
    if (this.listeners.size > 0) {
      const snapshot = Array.from(this.listeners);
      queueMicrotask(() => {
        for (const l of snapshot) {
          try {
            l(entry);
          } catch {
            // 隔离订阅者错误，避免影响其他订阅者
          }
        }
      });
    }
  }

  subscribe(listener: (entry: LogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  snapshot(limit?: number): LogEntry[] {
    if (limit === undefined || limit >= this.buffer.length) {
      return this.buffer.slice();
    }
    return this.buffer.slice(this.buffer.length - limit);
  }

  clear(): void {
    this.buffer = [];
  }

  size(): number {
    return this.buffer.length;
  }
}

/** 单例：整个应用共享一份 RingBuffer */
export const logSink: ILogSinkPort = new RingBufferLogSinkAdapter();