/**
 * CompositeLoggerAdapter —— ILoggerPort 的组合实现
 *
 * 用途：把多个 ILoggerPort 适配器（如 ConsoleLoggerAdapter + 任何实现
 * write(entry) 的 sink）合并成一个，对业务侧完全透明。
 *
 * 与 ILogSinkPort 的关系：
 * - ConsoleLoggerAdapter 实现 ILoggerPort，自身就写控制台
 * - RingBufferLogSinkAdapter 实现 ILogSinkPort，自身只缓冲
 * - 本类把两者"装在一起"，业务侧 logger.info() 同时进控制台和 RingBuffer
 *
 * 兼容性：完全兼容 ILoggerPort 契约（含 child），业务代码零改动。
 */

import type { ILoggerPort, LogContext, LogLevel } from '../../../domain/ports/CrossCuttingPorts';
import type { LogEntry } from '../../../domain/ports/LoggingPorts';

type LoggerLike = Pick<ILoggerPort, 'debug' | 'info' | 'warn' | 'error'>;

interface SinkLike {
  write(entry: LogEntry): void;
}

/**
 * 最小 ILoggerPort 接口：可作为子 logger 传入组合器，
 * 而非依赖具体类（便于单元测试）。
 */
export class CompositeLoggerAdapter implements ILoggerPort {
  private baseContext: LogContext;
  private sinks: SinkLike[];
  private idGenerator: () => string;
  private clock: () => number;

  constructor(
    sinks: SinkLike[],
    baseContext: LogContext = {},
    idGenerator: () => string = defaultIdGenerator,
    clock: () => number = Date.now,
  ) {
    this.baseContext = baseContext;
    this.sinks = sinks;
    this.idGenerator = idGenerator;
    this.clock = clock;
  }

  debug(message: string, context?: LogContext): void {
    this.emit('debug', message, undefined, context);
  }
  info(message: string, context?: LogContext): void {
    this.emit('info', message, undefined, context);
  }
  warn(message: string, context?: LogContext): void {
    this.emit('warn', message, undefined, context);
  }
  error(message: string, error?: unknown, context?: LogContext): void {
    this.emit('error', message, error, context);
  }

  child(context: LogContext): ILoggerPort {
    return new CompositeLoggerAdapter(
      this.sinks,
      { ...this.baseContext, ...context },
      this.idGenerator,
      this.clock,
    );
  }

  private emit(level: LogLevel, message: string, error?: unknown, context?: LogContext): void {
    const merged: LogContext = { ...this.baseContext, ...context };
    const entry: LogEntry = {
      id: this.idGenerator(),
      timestamp: this.clock(),
      level,
      message,
      context: Object.keys(merged).length > 0 ? merged : undefined,
      error: error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error !== undefined
          ? { name: typeof error, message: String(error) }
          : undefined,
    };
    for (const sink of this.sinks) {
      try {
        sink.write(entry);
      } catch {
        // 隔离单个 sink 错误，避免影响其他 sink
      }
    }
  }
}

/**
 * 将 ConsoleLoggerAdapter 包装为 ILogSinkPort 接口，
 * 避免在组合器中直接依赖控制台实现。
 */
export class ConsoleSinkAdapter implements SinkLike {
  private logger: LoggerLike;
  private baseContext: LogContext;

  constructor(logger: LoggerLike, baseContext: LogContext = {}) {
    this.logger = logger;
    this.baseContext = baseContext;
  }

  write(entry: LogEntry): void {
    const ctx: LogContext = entry.context ?? {};
    switch (entry.level) {
      case 'debug':
        this.logger.debug(entry.message, { ...this.baseContext, ...ctx });
        break;
      case 'info':
        this.logger.info(entry.message, { ...this.baseContext, ...ctx });
        break;
      case 'warn':
        this.logger.warn(entry.message, { ...this.baseContext, ...ctx });
        break;
      case 'error':
        this.logger.error(entry.message, reconstructError(entry.error), { ...this.baseContext, ...ctx });
        break;
    }
  }
}

function reconstructError(serialized: LogEntry['error']): unknown {
  if (!serialized) return undefined;
  const err = new Error(serialized.message);
  err.name = serialized.name;
  if (serialized.stack) err.stack = serialized.stack;
  return err;
}

function defaultIdGenerator(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}