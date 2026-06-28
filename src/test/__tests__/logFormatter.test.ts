/**
 * logFormatter 单元测试
 *
 * 验证：
 * - 标准格式：[ISO] [LEVEL] [service.method] message {context}
 * - service/method 缺失时省略 []
 * - 敏感字段（Key/Token/Secret）脱敏
 * - error 信息可选
 * - includeStack 时附加 stack
 */

import { describe, it, expect } from 'vitest';
import { formatLogEntry, formatEntries } from '../../ui/components/LogViewer/logFormatter';
import type { LogEntry } from '../../domain/ports/LoggingPorts';

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 'e1',
    timestamp: Date.UTC(2026, 5, 27, 12, 34, 56, 789),
    level: 'info',
    message: 'hello',
    ...overrides,
  };
}

describe('logFormatter', () => {
  it('formats basic entry with level and message', () => {
    const line = formatLogEntry(makeEntry());
    expect(line).toContain('[INFO ]');
    expect(line).toContain('hello');
  });

  it('includes service and method when present', () => {
    const line = formatLogEntry(makeEntry({
      context: { service: 'VideoService', method: 'submit' },
    }));
    expect(line).toContain('[VideoService.submit]');
  });

  it('service alone without method', () => {
    const line = formatLogEntry(makeEntry({
      context: { service: 'App' },
    }));
    expect(line).toContain('[App]');
    expect(line).not.toContain('[App.]');
  });

  it('redacts sensitive keys in context', () => {
    const line = formatLogEntry(makeEntry({
      context: { apiKey: 'sk-1234-unique', password: 'pwd-unique', safe: 'visible' },
    }));
    expect(line).toContain('[REDACTED]');
    expect(line).not.toContain('sk-1234-unique');
    expect(line).not.toContain('pwd-unique');
    expect(line).toContain('safe');
  });

  it('appends error info without stack by default', () => {
    const line = formatLogEntry(makeEntry({
      level: 'error',
      error: { name: 'TypeError', message: 'bad', stack: 'stack-trace' },
    }));
    expect(line).toContain('TypeError: bad');
    expect(line).not.toContain('stack-trace');
  });

  it('appends stack when includeStack is true', () => {
    const line = formatLogEntry(
      makeEntry({ error: { name: 'X', message: 'y', stack: 'S' } }),
      { includeStack: true },
    );
    expect(line).toContain('S');
  });

  it('formatEntries joins with newlines', () => {
    const text = formatEntries([
      makeEntry({ message: 'a' }),
      makeEntry({ message: 'b' }),
    ]);
    const lines = text.split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(text).toContain('a');
    expect(text).toContain('b');
  });
});