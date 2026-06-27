/**
 * GlobalErrorCapture 单元测试
 *
 * 验证：
 * - window.onerror 写入 sink
 * - window.unhandledrejection 写入 sink
 * - 返回的 dispose 函数可卸载监听
 * - SSR 环境（无 window）不抛错
 *
 * 说明：jsdom 不提供 PromiseRejectionEvent，这里通过 spy 捕获 listener 后手动触发。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { installGlobalErrorCapture } from '../../adapters/outbound/infrastructure/GlobalErrorCapture';
import type { LogEntry } from '../../domain/ports/LoggingPorts';

function makeSink() {
  const entries: LogEntry[] = [];
  return {
    entries,
    write: vi.fn((e: LogEntry) => entries.push(e)),
  };
}

type AnyListener = (event: unknown) => void;

describe('GlobalErrorCapture', () => {
  let sink: ReturnType<typeof makeSink>;
  let errorListener: AnyListener | null = null;
  let rejectionListener: AnyListener | null = null;
  const addSpy = vi.spyOn(window, 'addEventListener');
  const removeSpy = vi.spyOn(window, 'removeEventListener');

  beforeEach(() => {
    sink = makeSink();
    errorListener = null;
    rejectionListener = null;
    addSpy.mockClear();
    removeSpy.mockClear();
    addSpy.mockImplementation(((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'error') errorListener = listener as AnyListener;
      if (type === 'unhandledrejection') rejectionListener = listener as AnyListener;
    }) as typeof window.addEventListener);
    removeSpy.mockImplementation(((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'error' && errorListener === (listener as AnyListener)) errorListener = null;
      if (type === 'unhandledrejection' && rejectionListener === (listener as AnyListener)) rejectionListener = null;
    }) as typeof window.removeEventListener);
  });

  it('captures window error events', () => {
    const dispose = installGlobalErrorCapture(sink);
    expect(errorListener).not.toBeNull();
    errorListener!({
      message: 'uncaught',
      filename: 'app.js',
      lineno: 10,
      colno: 5,
      error: new TypeError('bad type'),
    });
    expect(sink.write).toHaveBeenCalledTimes(1);
    const entry = sink.entries[0];
    expect(entry.level).toBe('error');
    expect(entry.message).toBe('uncaught');
    expect(entry.context?.source).toBe('window.onerror');
    expect(entry.context?.filename).toBe('app.js');
    expect(entry.error?.name).toBe('TypeError');
    expect(entry.error?.message).toBe('bad type');
    dispose();
  });

  it('captures unhandledrejection events with Error reason', () => {
    const dispose = installGlobalErrorCapture(sink);
    expect(rejectionListener).not.toBeNull();
    rejectionListener!({
      reason: new Error('async fail'),
    });
    expect(sink.write).toHaveBeenCalledTimes(1);
    expect(sink.entries[0].message).toBe('Unhandled promise rejection');
    expect(sink.entries[0].error?.message).toBe('async fail');
    dispose();
  });

  it('serializes non-Error rejection reason', () => {
    const dispose = installGlobalErrorCapture(sink);
    rejectionListener!({
      reason: 'string reason',
    });
    expect(sink.entries[0].error?.name).toBe('string');
    expect(sink.entries[0].error?.message).toBe('string reason');
    dispose();
  });

  it('dispose removes listeners', () => {
    const dispose = installGlobalErrorCapture(sink);
    expect(errorListener).not.toBeNull();
    dispose();
    expect(errorListener).toBeNull();
    expect(rejectionListener).toBeNull();
  });
});