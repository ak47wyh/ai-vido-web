/**
 * ConsoleLoggerAdapter 单元测试
 *
 * 验证：
 * - 各 level 输出到对应 console 方法
 * - context 中的敏感字段（Key/Token/Secret）自动脱敏
 * - child() 创建带预设上下文的子 logger
 * - error() 接收 unknown 类型错误对象
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConsoleLoggerAdapter } from '../../adapters/outbound/infrastructure/ConsoleLoggerAdapter';

describe('ConsoleLoggerAdapter', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    debugSpy.mockRestore();
  });

  it('info uses console.log', () => {
    const logger = new ConsoleLoggerAdapter();
    logger.info('hello');
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toContain('INFO');
    expect(logSpy.mock.calls[0][0]).toContain('hello');
  });

  it('warn uses console.warn', () => {
    const logger = new ConsoleLoggerAdapter();
    logger.warn('careful');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('WARN');
  });

  it('error uses console.error with serialized error info', () => {
    const logger = new ConsoleLoggerAdapter();
    const err = new Error('boom');
    logger.error('something failed', err);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const args = errorSpy.mock.calls[0];
    expect(args[0]).toContain('ERROR');
    expect(args[1]).toEqual({ name: 'Error', message: 'boom' });
  });

  it('error handles non-Error values', () => {
    const logger = new ConsoleLoggerAdapter();
    logger.error('failed', 'string error');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][1]).toEqual({ value: 'string error' });
  });

  it('debug uses console.debug', () => {
    const logger = new ConsoleLoggerAdapter();
    logger.debug('details');
    expect(debugSpy).toHaveBeenCalledTimes(1);
  });

  it('redacts sensitive fields (Key/Token/Secret) in context', () => {
    const logger = new ConsoleLoggerAdapter();
    logger.info('test', {
      apiKey: 'sk-test-12345',
      accessToken: 'token-abc',
      password: 'secret',
      safeField: 'visible',
    });
    const line = logSpy.mock.calls[0][0];
    expect(line).toContain('[REDACTED]');
    expect(line).toContain('safeField');
    expect(line).not.toContain('sk-test-12345');
    expect(line).not.toContain('token-abc');
    expect(line).not.toContain('secret');
  });

  it('child logger inherits parent context', () => {
    const parent = new ConsoleLoggerAdapter({ service: 'Test' });
    const child = parent.child({ method: 'doStuff' });
    child.info('msg');
    const line = logSpy.mock.calls[0][0];
    expect(line).toContain('[Test.doStuff]');
    expect(line).toContain('msg');
  });

  it('child context overrides parent context on key conflict', () => {
    const parent = new ConsoleLoggerAdapter({ service: 'Parent' });
    const child = parent.child({ service: 'Child' });
    child.info('msg');
    const line = logSpy.mock.calls[0][0];
    expect(line).toContain('[Child]');
    expect(line).not.toContain('[Parent]');
  });
});