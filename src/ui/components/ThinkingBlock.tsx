import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Brain } from 'lucide-react';

interface ThinkingBlockProps {
  thinking: string;
  style?: React.CSSProperties;
}

/** Thinking 折叠面板组件 — 展示 M3 思维链 */
export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ thinking, style }) => {
  const [expanded, setExpanded] = useState(false);

  if (!thinking.trim()) return null;

  return (
    <div style={{
      marginTop: '0.75rem',
      border: '1px solid rgba(139,92,246,0.2)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      ...style,
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', padding: '0.5rem 0.75rem',
          background: 'rgba(139,92,246,0.08)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          color: '#a78bfa', fontSize: '0.8rem', fontWeight: 500,
          textAlign: 'left',
        }}
      >
        <Brain size={14} />
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        思考过程
        <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.25rem' }}>
          ({thinking.length} 字)
        </span>
      </button>
      {expanded && (
        <div style={{
          padding: '0.75rem', background: 'rgba(139,92,246,0.04)',
          fontSize: '0.8rem', lineHeight: 1.6, color: 'var(--text-muted)',
          maxHeight: '300px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {thinking}
        </div>
      )}
    </div>
  );
};
