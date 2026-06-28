/**
 * ConsoleLoggerAdapter —— ILoggerPort 的控制台实现
 *
 * 输出格式：`[ISO时间] [LEVEL] [service.method] message {context}`
 *
 * 安全策略（redaction）：
 * - 自动隐藏 context 中含 key/token/secret/password/authorization/api-key 的字段
 * - 递归处理嵌套对象（headers / body / params 等）
 * - 自动隐藏 Bearer / sk- / ghp_ 等长字符串字面量
 * - error 字段只输出 message + name，不输出 stack 中的变量值
 */

import type { ILoggerPort, LogContext, LogLevel } from '../../../domain/ports/CrossCuttingPorts';

const LEVEL_PREFIX: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
};

/** 敏感字段名（不区分大小写） */
const SENSITIVE_KEY_RE = /key|token|secret|password|authorization|auth|cookie|credential|jwt/i;

/** 长字符串凭证模式（Bearer / sk- / ghp_ 等） */
const SENSITIVE_VALUE_RE = /(Bearer\s+)?[A-Za-z0-9_\-]{20,}/g;

/** 递归脱敏对象：按 key 名识别 + 嵌套处理 */
function redactObject(value: unknown, skipKeys: readonly string[] = [], depth = 0): unknown {
  if (depth > 5) return '[DEEP]';
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.map(v => redactObject(v, skipKeys, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (skipKeys.includes(k)) continue;
      if (SENSITIVE_KEY_RE.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactObject(v, skipKeys, depth + 1);
      }
    }
    return out;
  }
  return redactValue(value);
}

/** 单值脱敏：处理字符串中的 Bearer / 长凭证模式 */
function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(SENSITIVE_VALUE_RE, match =>
      /^Bearer\s+/i.test(match) ? 'Bearer [REDACTED]' : '[REDACTED]'
    );
  }
  return value;
}

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

    // 构造 context 字符串：跳过 service/method 标识字段，对剩余递归脱敏
    const safeContext = redactObject(merged, ['service', 'method']);
    if (Object.keys(safeContext).length > 0) {
      try {
        parts.push(JSON.stringify(safeContext));
      } catch {
        parts.push('[unserializable context]');
      }
    }

    const line = parts.join(' ');

    if (level === 'error') {
      const errInfo = error instanceof Error
        ? { name: error.name, message: redactValue(error.message) }
        : { value: redactValue(error) };
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