import React from 'react';
import { Zap, Database } from 'lucide-react';

interface TokenUsageBarProps {
  usage?: {
    promptTokens: number;
    completionTokens: number;
    cachedTokens?: number;
    cacheCreationTokens?: number;
  };
  style?: React.CSSProperties;
}

/** Token 用量展示条 */
export const TokenUsageBar: React.FC<TokenUsageBarProps> = ({ usage, style }) => {
  if (!usage) return null;

  const total = usage.promptTokens + usage.completionTokens;
  const cachePercent = usage.cachedTokens ? Math.round((usage.cachedTokens / usage.promptTokens) * 100) : 0;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.4rem 0.6rem', background: 'rgba(0,0,0,0.1)',
      borderRadius: 'var(--radius-sm)', fontSize: '0.7rem',
      color: 'var(--text-muted)', flexWrap: 'wrap',
      ...style,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <Zap size={10} /> {usage.promptTokens.toLocaleString()} 输入
      </span>
      <span>→</span>
      <span>{usage.completionTokens.toLocaleString()} 输出</span>
      <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
      <span>共 {total.toLocaleString()} tokens</span>
      {usage.cachedTokens != null && usage.cachedTokens > 0 && (
        <>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#34d399' }}>
            <Database size={10} /> 缓存命中 {cachePercent}%
          </span>
        </>
      )}
    </div>
  );
};
