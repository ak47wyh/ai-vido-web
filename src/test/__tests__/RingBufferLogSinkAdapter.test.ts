/**
 * RingBufferLogSinkAdapter 单元测试
 *
 * 验证：
 * - FIFO 容量限制
 * - subscribe 异步触发
 * - listener 抛错被隔离
 * - snapshot 返回拷贝（不污染内部缓冲）
 * - unsubscribe 生效
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RingBufferLogSinkAdapter } from '../../adapters/outbound/infrastructure/RingBufferLogSinkAdapter';
import type { LogEntry } from '../../domain/ports/LoggingPorts';

function makeEntry(id: string, message = 'msg'): LogEntry {
  return {
    id,
    timestamp: Date.now(),
    level: 'info',
    message,
  };
}

describe('RingBufferLogSinkAdapter', () => {
  let sink: RingBufferLogSinkAdapter;

  beforeEach(() => {
    sink = new RingBufferLogSinkAdapter(3);
  });

  it('stores entries up to capacity', () => {
    sink.write(makeEntry('a'));
    sink.write(makeEntry('b'));
    sink.write(makeEntry('c'));
    expect(sink.size()).toBe(3);
    expect(sink.snapshot().map(e => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('drops oldest entries when exceeding capacity (FIFO)', () => {
    sink.write(makeEntry('a'));
    sink.write(makeEntry('b'));
    sink.write(makeEntry('c'));
    sink.write(makeEntry('d'));
    expect(sink.size()).toBe(3);
    expect(sink.snapshot().map(e => e.id)).toEqual(['b', 'c', 'd']);
  });

  it('snapshot returns a copy', () => {
    sink.write(makeEntry('a'));
    const snap = sink.snapshot();
    snap.push(makeEntry('b'));
    expect(sink.size()).toBe(1);
  });

  it('snapshot(limit) returns last N entries', () => {
    sink = new RingBufferLogSinkAdapter(10);
    for (let i = 0; i < 10; i++) sink.write(makeEntry(`e${i}`));
    const last3 = sink.snapshot(3);
    expect(last3.map(e => e.id)).toEqual(['e7', 'e8', 'e9']);
  });

  it('clear empties the buffer', () => {
    sink.write(makeEntry('a'));
    sink.clear();
    expect(sink.size()).toBe(0);
    expect(sink.snapshot()).toEqual([]);
  });

  it('subscribe receives new entries asynchronously', async () => {
    const listener = vi.fn();
    sink.subscribe(listener);
    sink.write(makeEntry('a'));
    expect(listener).not.toHaveBeenCalled();
    await new Promise(resolve => queueMicrotask(resolve));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].id).toBe('a');
  });

  it('unsubscribe stops further notifications', async () => {
    const listener = vi.fn();
    const unsub = sink.subscribe(listener);
    sink.write(makeEntry('a'));
    await new Promise(resolve => queueMicrotask(resolve));
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    sink.write(makeEntry('b'));
    await new Promise(resolve => queueMicrotask(resolve));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('isolates listener errors so other listeners still fire', async () => {
    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    sink.subscribe(bad);
    sink.subscribe(good);
    sink.write(makeEntry('a'));
    await new Promise(resolve => queueMicrotask(resolve));
    expect(bad).toHaveBeenCalled();
    expect(good).toHaveBeenCalled();
  });

  it('rejects capacity < 1', () => {
    expect(() => new RingBufferLogSinkAdapter(0)).toThrow();
    expect(() => new RingBufferLogSinkAdapter(-1)).toThrow();
  });
});