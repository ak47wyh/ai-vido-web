import React from 'react';
import { AlertCircle, RefreshCw, Inbox } from 'lucide-react';

interface AsyncStateProps {
  /** 加载中 */
  loading?: boolean;
  /** 错误信息（Error 对象或字符串） */
  error?: Error | string | null;
  /** 空状态 */
  empty?: boolean;
  /** 空状态文案 */
  emptyText?: string;
  /** 重试回调（错误状态展示重试按钮） */
  onRetry?: () => void;
  /** 子内容（非 loading/error/empty 状态时展示） */
  children?: React.ReactNode;
  /** 自定义加载文案 */
  loadingText?: string;
  /** 最小高度（默认 200px） */
  minHeight?: number;
}

/**
 * 统一的异步状态组件。
 *
 * 用于 Lab 页面和列表页面，统一处理 loading / error / empty 三种非正常状态，
 * 避免各页面各自实现导致体验割裂。
 *
 * 用法：
 * ```tsx
 * <AsyncState loading={isLoading} error={error} empty={items.length === 0} onRetry={refetch}>
 *   {items.map(...)}
 * </AsyncState>
 * ```
 */
export const AsyncState: React.FC<AsyncStateProps> = ({
  loading,
  error,
  empty,
  emptyText = '暂无数据',
  onRetry,
  children,
  loadingText = '加载中...',
  minHeight = 200,
}) => {
  // 加载状态
  if (loading) {
    return (
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          minHeight,
          padding: '2rem',
        }}
      >
        <RefreshCw size={28} className="spin" style={{ color: 'var(--primary-color)' }} />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{loadingText}</span>
      </div>
    );
  }

  // 错误状态
  if (error) {
    const message = typeof error === 'string' ? error : error.message || '发生未知错误';
    return (
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          minHeight,
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <AlertCircle size={32} style={{ color: 'var(--error-color, #ef4444)' }} />
        <div style={{ maxWidth: 400 }}>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
            操作失败
          </p>
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', wordBreak: 'break-word' }}>
            {message}
          </p>
        </div>
        {onRetry && (
          <button
            className="btn btn-secondary"
            onClick={onRetry}
            style={{ fontSize: '0.82rem', padding: '0.45rem 1rem', marginTop: '0.3rem' }}
          >
            <RefreshCw size={14} />
            重试
          </button>
        )}
      </div>
    );
  }

  // 空状态
  if (empty) {
    return (
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.6rem',
          minHeight,
          padding: '2rem',
        }}
      >
        <Inbox size={36} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{emptyText}</span>
      </div>
    );
  }

  // 正常内容
  return <>{children}</>;
};
