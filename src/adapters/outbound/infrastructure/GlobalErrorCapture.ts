/**
 * GlobalErrorCapture —— 浏览器全局错误捕获
 *
 * 用途：把 window.onerror 和 unhandledrejection 写入 ILogSinkPort，
 * 让 React ErrorBoundary 之外的运行时异常也能被 UI 日志面板看到。
 *
 * 约束：
 * - 返回的 dispose 函数应在应用卸载时调用，避免热重载导致监听器堆积
 * - 仅在浏览器环境生效（typeof window !== 'undefined'）
 */

import type { ILogSinkPort } from '../../../domain/ports/LoggingPorts';

const SENSITIVE_KEY_RE = /key|token|secret|password/i;

function redactContext(ctx: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (SENSITIVE_KEY_RE.test(k)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function installGlobalErrorCapture(sink: ILogSinkPort): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const onError = (event: ErrorEvent) => {
    sink.write({
      id: generateId(),
      timestamp: Date.now(),
      level: 'error',
      message: event.message || 'Uncaught error',
      context: redactContext({
        source: 'window.onerror',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      }),
      error: event.error instanceof Error
        ? { name: event.error.name, message: event.error.message, stack: event.error.stack }
        : { name: 'ErrorEvent', message: String(event.error) },
    });
  };

  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    sink.write({
      id: generateId(),
      timestamp: Date.now(),
      level: 'error',
      message: 'Unhandled promise rejection',
      context: { source: 'unhandledrejection' },
      error: reason instanceof Error
        ? { name: reason.name, message: reason.message, stack: reason.stack }
        : { name: typeof reason, message: String(reason) },
    });
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}