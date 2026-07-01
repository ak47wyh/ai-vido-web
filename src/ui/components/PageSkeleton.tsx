import React from 'react';

/**
 * 路由级骨架屏（V3 §6.2）—— 替代纯文本"加载中…"fallback。
 *
 * 复用页面布局的灰块占位（header + subtitle + 卡片网格），
 * 保持视觉连续性，避免白屏闪烁。shimmer 动效在 index.css `.skeleton`。
 */
export const PageSkeleton: React.FC<{ role?: string }> = ({ role = 'status' }) => (
  <div
    className="route-skeleton"
    role={role}
    aria-live="polite"
    aria-label="页面加载中"
  >
    <div className="route-skeleton-header">
      <span className="skeleton skeleton-circle" style={{ width: 36, height: 36 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="skeleton route-skeleton-title" />
        <span className="skeleton route-skeleton-subtitle" />
      </div>
    </div>
    <div className="route-skeleton-grid">
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className="skeleton route-skeleton-card" />
      ))}
    </div>
  </div>
);
