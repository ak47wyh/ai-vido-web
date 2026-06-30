import React from 'react';
import { Upload, Loader2, Wand2, Download, Save, Trash2, X } from 'lucide-react';
import { AsyncState } from '../AsyncState';

// ==================== 上传区 ====================
interface UploadZoneProps {
  icon?: React.ReactNode;
  hint: string;
  hint2: string;
  accept: string;
  onFile: (file: File) => void;
}

export const EnhanceUploadZone: React.FC<UploadZoneProps> = ({
  icon, hint, hint2, accept, onFile,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };
  return (
    <div
      className="enhance-upload-zone"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => fileInputRef.current?.click()}
    >
      {icon ?? <Upload size={40} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />}
      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{hint}</p>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', opacity: 0.7 }}>{hint2}</p>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
    </div>
  );
};

// ==================== 参数滑块 ====================
interface ParamSliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  tooltip?: string;
  onChange: (v: number) => void;
}

export const EnhanceParamSlider: React.FC<ParamSliderProps> = ({
  label, value, min = 0, max = 100, step = 1, disabled, tooltip, onChange,
}) => (
  <div className="form-group">
    <label className="form-label" title={tooltip}>
      {label} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.3rem' }}>{value}</span>
    </label>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width: '100%' }}
    />
  </div>
);

// ==================== 进度条 ====================
export const EnhanceProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="enhance-progress">
    <div className="enhance-progress-bar" style={{ width: `${progress * 100}%` }} />
  </div>
);

// ==================== 重试提示 ====================
export const EnhanceRetryHint: React.FC<{ retryCount: number; isFallbackRetry: boolean; isProcessing: boolean }> = ({
  retryCount, isFallbackRetry, isProcessing,
}) => {
  if (retryCount === 0 || !isProcessing) return null;
  return (
    <div className="enhance-retry-hint">
      {isFallbackRetry
        ? '主算法失败，正在尝试备选算法'
        : `正在重试 · 第 ${retryCount + 1} 次尝试`}
    </div>
  );
};

// ==================== 操作按钮组 ====================
interface ActionButtonsProps {
  isProcessing: boolean;
  hasResult: boolean;
  canProcess: boolean;
  onProcess: () => void;
  onCancel: () => void;
  onDownload: () => void;
  onSaveToLibrary?: () => void;
  onReset: () => void;
}

export const EnhanceActionButtons: React.FC<ActionButtonsProps> = ({
  isProcessing, hasResult, canProcess, onProcess, onCancel, onDownload, onSaveToLibrary, onReset,
}) => (
  <>
    {!hasResult ? (
      <>
        <button
          className="btn btn-primary btn-generate"
          disabled={!canProcess || isProcessing}
          onClick={onProcess}
        >
          {isProcessing ? <Loader2 size={18} className="spin" /> : <Wand2 size={18} />}
          {isProcessing ? '处理中...' : '开始增强'}
        </button>
        {isProcessing && (
          <button className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={onCancel}>
            <X size={14} /> 取消
          </button>
        )}
      </>
    ) : (
      <>
        <button className="btn btn-primary btn-generate" onClick={onDownload}>
          <Download size={18} /> 下载
        </button>
        {onSaveToLibrary && (
          <button className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={onSaveToLibrary}>
            <Save size={16} /> 保存到素材库
          </button>
        )}
        <button className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={onReset}>
          <Trash2 size={16} /> 重新处理
        </button>
      </>
    )}
  </>
);

// ==================== 通用 AsyncState 包装 ====================
export const EnhanceAsyncWrapper: React.FC<{
  isProcessing: boolean;
  progress: number;
  error: string | null;
  onRetry: () => void;
  hasResult: boolean;
  children: React.ReactNode;
}> = ({ isProcessing, progress, error, onRetry, hasResult, children }) => (
  <AsyncState
    loading={isProcessing}
    loadingText={`处理中... ${Math.round(progress * 100)}%`}
    error={error}
    onRetry={onRetry}
    minHeight={80}
  >
    {hasResult ? null : children}
  </AsyncState>
);
