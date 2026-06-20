import React from 'react';

const LYRIC_TAGS = [
  '[Intro]', '[Verse]', '[Pre-Chorus]', '[Chorus]', '[Hook]',
  '[Drop]', '[Bridge]', '[Solo]', '[Build-up]', '[Build Up]',
  '[Instrumental]', '[Breakdown]', '[Break]', '[Interlude]', '[Outro]',
  '[Post-Chorus]', '[Transition]', '[Inst]',
];

const TAG_COLORS: Record<string, string> = {
  '[Intro]': '#8b5cf6',
  '[Verse]': '#3b82f6',
  '[Pre-Chorus]': '#06b6d4',
  '[Chorus]': '#ef4444',
  '[Hook]': '#f59e0b',
  '[Bridge]': '#10b981',
  '[Outro]': '#8b5cf6',
  '[Solo]': '#ec4899',
  '[Instrumental]': '#6366f1',
  '[Inst]': '#6366f1',
};

interface LyricsDisplayProps {
  lyrics: string;
  style?: React.CSSProperties;
}

/** 歌词展示组件：结构标签高亮渲染 */
export const LyricsDisplay: React.FC<LyricsDisplayProps> = ({ lyrics, style }) => {
  const lines = lyrics.split('\n');

  return (
    <div style={{
      padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)',
      maxHeight: '400px', overflowY: 'auto', ...style,
    }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        const isTag = LYRIC_TAGS.some(tag => trimmed.startsWith(tag));

        if (isTag) {
          // 找到匹配的标签
          const matchedTag = LYRIC_TAGS.find(tag => trimmed.startsWith(tag)) || '';
          const color = TAG_COLORS[matchedTag] || '#6366f1';
          return (
            <div key={idx} style={{ margin: '0.75rem 0 0.25rem' }}>
              <span style={{
                display: 'inline-block', padding: '0.15rem 0.5rem',
                background: `${color}20`, color, borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem', fontWeight: 600,
              }}>
                {trimmed}
              </span>
            </div>
          );
        }

        return (
          <div key={idx} style={{
            fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-color)',
            padding: '0.1rem 0',
          }}>
            {line || '\u00A0'}
          </div>
        );
      })}
    </div>
  );
};
