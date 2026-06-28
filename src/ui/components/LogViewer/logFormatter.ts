/**
 * logFormatter —— 日志格式化工具
 *
 * formatLogEntry: 单条格式化（用于复制 / 导出）
 * formatEntries: 多条批量格式化（每行一条）
 *
 * 格式与 ConsoleLoggerAdapter 保持一致：
 *   [ISO时间] [LEVEL] [service.method] message {context}
 */

import type { LogEntry } from '../../../domain/ports/LoggingPorts';
import type { LogContext } from '../../../domain/ports/CrossCuttingPorts';

const LEVEL_PREFIX = {
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
} as const;

const SENSITIVE_KEY_RE = /key|token|secret|password/i;

interface FormatOptions {
  includeStack?: boolean;
}

export function formatLogEntry(entry: LogEntry, options: FormatOptions = {}): string {
  const parts: string[] = [];
  parts.push(`[${new Date(entry.timestamp).toISOString()}]`);
  parts.push(`[${LEVEL_PREFIX[entry.level]}]`);

  const ctx = entry.context ?? {};
  if (ctx.service) {
    const method = ctx.method ? `.${String(ctx.method)}` : '';
    parts.push(`[${String(ctx.service)}${method}]`);
  }
  parts.push(entry.message);

  const safeContext = redactContext(ctx);
  if (Object.keys(safeContext).length > 0) {
    parts.push(JSON.stringify(safeContext));
  }

  let line = parts.join(' ');
  if (entry.error) {
    line += `\n  ${entry.error.name}: ${entry.error.message}`;
    if (options.includeStack && entry.error.stack) {
      line += `\n${entry.error.stack}`;
    }
  }
  return line;
}

export function formatEntries(entries: LogEntry[], options: FormatOptions = {}): string {
  return entries.map(e => formatLogEntry(e, options)).join('\n');
}

function redactContext(ctx: LogContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (k === 'service' || k === 'method') continue;
    if (SENSITIVE_KEY_RE.test(k)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = v;
    }
  }
  return out;
}