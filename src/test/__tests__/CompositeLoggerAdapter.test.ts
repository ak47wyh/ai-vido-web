/**
 * CompositeLoggerAdapter 单元测试
 *
 * 验证：
 * - fanout 到多个 sink
 * - level/error 序列化
 * - child() 继承 + 覆盖上下文
 * - 单个 sink 抛错不影响其他 sink
 */

import { describe, it, expect, vi } from 'vitest';
import { CompositeLoggerAdapter, ConsoleSinkAdapter } from '../../adapters/outbound/infrastructure/CompositeLoggerAdapter';
import { ConsoleLoggerAdapter } from '../../adapters/outbound/infrastructure/ConsoleLoggerAdapter';
import type { LogEntry } from '../../domain/ports/LoggingPorts';

function makeSink() {
  const entries: LogEntry[] = [];
  return {
    entries,
    write: (e: LogEntry) => entries.push(e),
  };
}

describe('CompositeLoggerAdapter', () => {
  it('fans out to all sinks', () => {
    const a = makeSink();
    const b = makeSink();
    const logger = new CompositeLoggerAdapter([a, b]);
    logger.info('hi');
    expect(a.entries).toHaveLength(1);
    expect(b.entries).toHaveLength(1);
    expect(a.entries[0].message).toBe('hi');
    expect(a.entries[0].level).toBe('info');
  });

  it('serializes Error in entry.error', () => {
    const sink = makeSink();
    const logger = new CompositeLoggerAdapter([sink]);
    logger.error('boom', new Error('failed'));
    expect(sink.entries[0].error?.message).toBe('failed');
    expect(sink.entries[0].error?.name).toBe('Error');
  });

  it('serializes non-Error as { name: typeof, message: String(value) }', () => {
    const sink = makeSink();
    const logger = new CompositeLoggerAdapter([sink]);
    logger.error('boom', 'oops');
    expect(sink.entries[0].error?.message).toBe('oops');
  });

  it('merges baseContext and per-call context', () => {
    const sink = makeSink();
    const logger = new CompositeLoggerAdapter([sink], { service: 'App' });
    logger.info('msg', { method: 'go' });
    expect(sink.entries[0].context).toEqual({ service: 'App', method: 'go' });
  });

  it('child logger inherits and overrides context', () => {
    const sink = makeSink();
    const parent = new CompositeLoggerAdapter([sink], { service: 'Parent' });
    const child = parent.child({ service: 'Child', method: 'run' });
    child.info('msg');
    expect(sink.entries[0].context).toEqual({ service: 'Child', method: 'run' });
  });

  it('one failing sink does not break others', () => {
    const bad = { write: () => { throw new Error('sink broken'); } };
    const good = makeSink();
    const logger = new CompositeLoggerAdapter([bad, good]);
    logger.info('still works');
    expect(good.entries).toHaveLength(1);
  });

  it('ConsoleSinkAdapter forwards entries to inner ConsoleLoggerAdapter', () => {
    const inner = new ConsoleLoggerAdapter();
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const sink = new ConsoleSinkAdapter(inner);
    sink.write({
      id: 'x', timestamp: 0, level: 'debug', message: 'd',
    });
    expect(debugSpy).toHaveBeenCalledTimes(1);
    debugSpy.mockRestore();
  });

  it('uses injected id generator and clock', () => {
    const sink = makeSink();
    let counter = 0;
    const logger = new CompositeLoggerAdapter(
      [sink],
      {},
      () => `id-${++counter}`,
      () => 1234567890,
    );
    logger.info('first');
    logger.info('second');
    expect(sink.entries[0].id).toBe('id-1');
    expect(sink.entries[1].id).toBe('id-2');
    expect(sink.entries[0].timestamp).toBe(1234567890);
  });
});