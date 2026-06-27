/**
 * CrossCuttingPorts —— 横切关注点 Port 抽象
 *
 * 把日志、事件总线、指标、韧性、通知、确认等"基础设施级"能力
 * 从 Service 中解耦出来，使 Service 可独立测试、可替换后端。
 *
 * 与具体技术无关：
 * - ILoggerPort → Console / Sentry / Datadog 任选
 * - IEventBus → 内存 / BroadcastChannel / WebSocket 任选
 * - IResiliencePort → 简单 retry / resilience4j 任选
 */

// ==========================================
// 日志
// ==========================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  service?: string;
  method?: string;
  platform?: string;
  taskId?: string;
  spaceId?: string;
  userId?: string;
  [key: string]: unknown;
}

/**
 * 结构化日志端口。
 * 默认实现：ConsoleLoggerAdapter。
 * 后续可替换：SentryLoggerAdapter / RemoteLoggerAdapter。
 *
 * 安全约束：实现方不得在日志中输出完整 API Key / Token。
 */
export interface ILoggerPort {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: unknown, context?: LogContext): void;
  /** 创建一个带预设上下文的子 logger（链式） */
  child(context: LogContext): ILoggerPort;
}

// ==========================================
// 领域事件总线
// ==========================================

export type DomainEvent =
  | { type: 'video.task.submitted'; taskId: string; spaceId: string; platform: string }
  | { type: 'video.task.completed'; taskId: string; videoUrl: string }
  | { type: 'video.task.failed'; taskId: string; error: string }
  | { type: 'voice.cloned'; voiceId: string }
  | { type: 'platform.changed'; from: string; to: string }
  | { type: 'space.snapshot.created'; snapshotId: string; spaceId: string }
  | { type: 'space.deleted'; spaceId: string }
  | { type: 'asset.saved'; kind: 'image' | 'voice' | 'prompt'; id: string };

export type EventListener<T extends DomainEvent['type']> = (
  payload: Extract<DomainEvent, { type: T }>
) => void;

/**
 * 领域事件总线端口。
 *
 * 用途：解耦 Service 间强依赖。
 * 例：PipelineService 提交视频后 emit('video.task.submitted')，
 *     VideoTaskPoller 订阅 'video.task.completed' 后推进状态。
 *
 * 约束：
 * - emit 不阻塞（同步触发所有 handler）
 * - handler 抛错时记录日志但不中断后续 handler
 * - on 返回的函数调用后取消订阅
 */
export interface IEventBus {
  emit<T extends DomainEvent['type']>(
    type: T,
    payload: Extract<DomainEvent, { type: T }>
  ): void;
  on<T extends DomainEvent['type']>(
    type: T,
    handler: EventListener<T>
  ): () => void;
  /** 订阅所有事件（调试 / 监控用） */
  onAny(handler: (event: DomainEvent) => void): () => void;
}

// ==========================================
// 指标
// ==========================================

export interface Counter {
  inc(delta?: number, tags?: Record<string, string>): void;
}

export interface Histogram {
  observe(value: number, tags?: Record<string, string>): void;
}

/**
 * 指标端口。
 * 默认实现：NoopMetricsAdapter。
 * 后续可接入：Prometheus 推送 / 自研埋点。
 */
export interface IMetricsPort {
  counter(name: string, tags?: Record<string, string>): Counter;
  histogram(name: string, tags?: Record<string, string>): Histogram;
}

// ==========================================
// 韧性（限流 / 重试 / 熔断）
// ==========================================

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  backoff?: 'linear' | 'exponential';
  retryOn?: (err: unknown) => boolean;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  cooldownMs: number;
}

/**
 * 韧性操作端口。
 * 取代 utils/retryUtils.ts 中的散装函数。
 * 后续可在 Service 层统一加 retry/circuit-breaker。
 */
export interface IResiliencePort {
  retry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T>;
  withCircuitBreaker<T>(key: string, fn: () => Promise<T>, options: CircuitBreakerOptions): Promise<T>;
}

// ==========================================
// 通知 / 确认（Service → UI 副作用）
// ==========================================

export type ToastVariant = 'success' | 'info' | 'warn' | 'error';

export interface ToastInput {
  variant: ToastVariant;
  message: string;
  durationMs?: number;
}

export interface ConfirmInput {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

/**
 * 通知端口：让 Service 层主动弹 Toast 而不耦合 React。
 * 默认实现：ReactNotificationAdapter（包装 ToastContext）。
 */
export interface INotificationPort {
  toast(input: ToastInput): string;
  dismiss(toastId: string): void;
}

/**
 * 确认对话框端口：让 Service 层发起"是否继续"询问。
 * 默认实现：ReactConfirmAdapter（包装 ConfirmContext）。
 */
export interface IConfirmPort {
  ask(input: ConfirmInput): Promise<boolean>;
}
