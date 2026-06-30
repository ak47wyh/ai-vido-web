/**
 * VideoUploadField —— 视频上传组件（点击选择 + 拖拽上传）
 *
 * PRD F-01 / F-02：支持点击弹出文件选择对话框与拖拽文件到区域两种入口。
 * 不处理上传逻辑（由父组件通过 onFile 回调委托 useVideoImport hook）。
 * 仅负责 UI 交互：文件输入、拖拽高亮、disabled 态。
 */

import React, { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ACCEPT = 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov';

export interface VideoUploadFieldProps {
  /** 文件选择/拖拽后的回调 */
  onFile: (file: File) => void;
  /** 禁用态（上传进行中） */
  disabled?: boolean;
}

export const VideoUploadField: React.FC<VideoUploadFieldProps> = ({ onFile, disabled }) => {
  const { t } = useTranslation();
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleOpen = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    // 清空 value 允许重复选择同一文件
    e.target.value = '';
  }, [onFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setDragActive(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }, [disabled, onFile]);

  return (
    <div
      onClick={handleOpen}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={t('editor.media.import.button', '导入视频')}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpen();
        }
      }}
      style={{
        border: `2px dashed ${dragActive ? 'var(--primary-color)' : 'var(--border-color)'}`,
        borderRadius: 'var(--radius-sm)',
        padding: '0.6rem 0.5rem',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: dragActive ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.15)',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.4rem',
        marginBottom: '0.5rem',
      }}
    >
      <Upload size={14} style={{ color: 'var(--primary-color)' }} />
      <span style={{ fontSize: '0.75rem', color: 'var(--text-color)' }}>
        {dragActive
          ? t('editor.media.import.dropActive', '松开以上传')
          : t('editor.media.import.button', '导入视频')}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
};
