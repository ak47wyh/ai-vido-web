import React from 'react';
import { AlertCircle, RefreshCw, Inbox } from 'lucide-react';

/** 加载子态（V3 §6.2）：骨架屏(首次) / 内联 spinner(刷新) / 进度条(批量) */
export type LoadingVariant = 'spinner' | 'skeleton' | 'progress';

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
  /** 加载子态：spinner(默认) / skeleton(首次加载) / progress(批量任务) */
  loadingVariant?: LoadingVariant;
  /** 进度条模式下的当前进度（0-100），仅 loadingVariant='progress' 时生效 */
  progress?: number;
}

/**
 * 统一的异步状态组件。
 *
 * 用于 Lab 页面和列表页面，统一处理 loading / error / empty 三种非正常状态，
 * 避免各页面各自实现导致体验割裂。
 *
 * V3 §6.2：loading 增加 spinner / skeleton / progress 三种子态，
 * 适配首次加载、刷新、批量任务等不同场景。
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
  loadingVariant = 'spinner',
  progress,
}) => {
  // 加载状态
  if (loading) {
    // 骨架子态：用 shimmer 灰块占位，适合首次加载
    if (loadingVariant === 'skeleton') {
      return (
        <div className="glass-panel" style={{ padding: '1rem', minHeight }} role="status" aria-live="polite">
          <span className="skeleton skeleton-text" style={{ width: '40%' }} />
          <span className="skeleton skeleton-text" style={{ width: '85%' }} />
          <span className="skeleton skeleton-block" style={{ marginTop: '0.5rem' }} />
          <span className="skeleton skeleton-text" style={{ width: '70%', marginTop: '0.75rem' }} />
        </div>
      );
    }

    // 进度条子态：适合批量任务
    if (loadingVariant === 'progress') {
      const pct = Math.max(0, Math.min(100, progress ?? 0));
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
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{loadingText}</span>
          <div
            style={{
              width: '100%',
              maxWidth: 360,
              height: 6,
              borderRadius: 3,
              background: 'var(--border-color)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                borderRadius: 3,
                background: 'linear-gradient(90deg, var(--primary-color), var(--accent-color))',
                transition: `width var(--motion-normal) var(--ease-standard)`,
              }}
            />
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{pct}%</span>
        </div>
      );
    }

    // 默认 spinner 子态：适合刷新
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
        role="status"
        aria-live="polite"
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
