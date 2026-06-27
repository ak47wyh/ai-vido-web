/**
 * ConsoleLoggerAdapter —— ILoggerPort 的控制台实现
 *
 * 输出格式：`[ISO时间] [LEVEL] [service.method] message {context}`
 * 安全：error 字段只输出 message + name，不输出 stack 中的变量值。
 */

import type { ILoggerPort, LogContext, LogLevel } from '../../../domain/ports/CrossCuttingPorts';

const LEVEL_PREFIX: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
};

export class ConsoleLoggerAdapter implements ILoggerPort {
  private baseContext: LogContext;

  constructor(baseContext: LogContext = {}) {
    this.baseContext = baseContext;
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, undefined, context);
  }
  info(message: string, context?: LogContext): void {
    this.log('info', message, undefined, context);
  }
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, undefined, context);
  }
  error(message: string, error?: unknown, context?: LogContext): void {
    this.log('error', message, error, context);
  }
  child(context: LogContext): ILoggerPort {
    return new ConsoleLoggerAdapter({ ...this.baseContext, ...context });
  }

  private log(level: LogLevel, message: string, error?: unknown, context?: LogContext): void {
    const merged: LogContext = { ...this.baseContext, ...context };
    const parts: string[] = [];
    parts.push(`[${new Date().toISOString()}]`);
    parts.push(`[${LEVEL_PREFIX[level]}]`);
    if (merged.service) {
      const method = merged.method ? `.${merged.method}` : '';
      parts.push(`[${merged.service}${method}]`);
    }
    parts.push(message);

    // 构造 context 字符串（脱敏：自动隐藏包含 Key/Token/Secret 的字段）
    const safeContext: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(merged)) {
      if (k === 'service' || k === 'method') continue;
      if (/key|token|secret|password/i.test(k)) {
        safeContext[k] = '[REDACTED]';
      } else {
        safeContext[k] = v;
      }
    }
    if (Object.keys(safeContext).length > 0) {
      parts.push(JSON.stringify(safeContext));
    }

    const line = parts.join(' ');

    if (level === 'error') {
      const errInfo = error instanceof Error
        ? { name: error.name, message: error.message }
        : { value: String(error) };
      console.error(line, errInfo);
      return;
    }
    if (level === 'warn') {
      console.warn(line);
      return;
    }
    if (level === 'debug') {
      console.debug(line);
      return;
    }
    console.log(line);
  }
}

export const defaultLogger: ILoggerPort = new ConsoleLoggerAdapter();
