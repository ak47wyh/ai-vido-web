import React, { useState, useRef } from 'react';
import { GitCompare, Columns2 } from 'lucide-react';

interface EnhanceCompareProps {
  /** 原图 URL */
  originalUrl: string;
  /** 结果图 URL */
  resultUrl: string;
  /** 显示宽度 */
  displayWidth: number;
  /** 显示高度 */
  displayHeight: number;
  /** 结果标签文案（如「增强后」「放大后」） */
  resultLabel?: string;
}

type PreviewMode = 'slider' | 'sidebyside';

/**
 * 清晰度提升结果对比预览
 * - 滑块模式：拖动分割线对比
 * - 左右对比：并排展示
 *
 * 与 InpaintPreview 交互完全一致，仅文案标签不同。
 */
export const EnhanceCompare: React.FC<EnhanceCompareProps> = ({
  originalUrl,
  resultUrl,
  displayWidth,
  displayHeight,
  resultLabel = '增强后',
}) => {
  const [mode, setMode] = useState<PreviewMode>('slider');
  const [sliderPos, setSliderPos] = useState(50); // 0-100
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleSliderMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, pct)));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* 模式切换 */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          className={`btn ${mode === 'slider' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
          onClick={() => setMode('slider')}
        >
          <GitCompare size={14} /> 滑块对比
        </button>
        <button
          className={`btn ${mode === 'sidebyside' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
          onClick={() => setMode('sidebyside')}
        >
          <Columns2 size={14} /> 左右对比
        </button>
      </div>

      {mode === 'slider' ? (
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            width: displayWidth,
            height: displayHeight,
            overflow: 'hidden',
            borderRadius: 'var(--radius-md)',
            cursor: 'ew-resize',
            userSelect: 'none',
          }}
          onMouseMove={handleSliderMove}
          onMouseDown={() => { isDragging.current = true; }}
          onMouseUp={() => { isDragging.current = false; }}
          onMouseLeave={() => { isDragging.current = false; }}
          onTouchMove={handleSliderMove}
        >
          {/* 结果图（底层） */}
          <img
            src={resultUrl}
            alt="result"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }}
          />
          {/* 原图（上层，按滑块位置裁剪） */}
          <div
            style={{
              position: 'absolute',
              top: 0, left: 0, width: '100%', height: '100%',
              clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
            }}
          >
            <img
              src={originalUrl}
              alt="original"
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          {/* 分割线 */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: `${sliderPos}%`,
              width: 2,
              height: '100%',
              background: 'var(--primary-color)',
              boxShadow: '0 0 8px rgba(99,102,241,0.6)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--primary-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.7rem',
                color: '#fff',
              }}
            >
              ⇆
            </div>
          </div>
          {/* 标签 */}
          <span style={{ position: 'absolute', top: '0.3rem', left: '0.3rem', fontSize: '0.7rem', color: '#fff', background: 'rgba(0,0,0,0.5)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
            原图
          </span>
          <span style={{ position: 'absolute', top: '0.3rem', right: '0.3rem', fontSize: '0.7rem', color: '#fff', background: 'rgba(0,0,0,0.5)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
            {resultLabel}
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>原图</div>
            <img
              src={originalUrl}
              alt="original"
              style={{ width: '100%', maxHeight: displayHeight, objectFit: 'contain', borderRadius: 'var(--radius-md)' }}
            />
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{resultLabel}</div>
            <img
              src={resultUrl}
              alt="result"
              style={{ width: '100%', maxHeight: displayHeight, objectFit: 'contain', borderRadius: 'var(--radius-md)' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
