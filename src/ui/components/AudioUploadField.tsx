import React, { useState } from 'react';
import { Upload, Link, X } from 'lucide-react';

const MAX_AUDIO_SIZE_MB = 50;
const VALID_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/flac', 'audio/x-flac'];

let audioUploadCounter = 0;

// 文件转 Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// 校验音频文件
const validateAudioFile = (file: File): string | null => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const validExts = ['mp3', 'wav', 'flac'];
  if (!VALID_AUDIO_TYPES.includes(file.type) && !validExts.includes(ext || '')) {
    return '仅支持 MP3/WAV/FLAC 格式';
  }
  if (file.size > MAX_AUDIO_SIZE_MB * 1024 * 1024) {
    return `文件大小不能超过 ${MAX_AUDIO_SIZE_MB}MB`;
  }
  return null;
};

export interface AudioUploadFieldProps {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  borderColor?: string;
  bgColor?: string;
  placeholder?: string;
}

/** 音频上传组件：支持本地上传（Base64）和 URL 输入 */
export const AudioUploadField: React.FC<AudioUploadFieldProps> = ({
  label, value, onChange, borderColor, bgColor, placeholder,
}) => {
  const [mode, setMode] = useState<'file' | 'url'>('file');
  const [urlInput, setUrlInput] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileInputId] = useState(() => `audio-upload-${++audioUploadCounter}`);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateAudioFile(file);
    if (err) { alert(err); return; }
    const base64 = await fileToBase64(file);
    setFileName(file.name);
    onChange(base64);
  };

  const handleUrlConfirm = () => {
    const trimmed = urlInput.trim();
    if (trimmed) {
      setFileName(trimmed.substring(0, 50));
      onChange(trimmed);
    }
  };

  const borderStyle = borderColor || 'var(--border-color)';
  const bgStyle = bgColor || 'rgba(0,0,0,0.1)';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label className="form-label" style={{ marginBottom: 0 }}>{label}</label>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button
            className={`btn ${mode === 'file' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}
            onClick={() => setMode('file')}
          >本地上传</button>
          <button
            className={`btn ${mode === 'url' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}
            onClick={() => setMode('url')}
          ><Link size={10} /> URL</button>
        </div>
      </div>

      {mode === 'file' ? (
        <div
          style={{
            border: `2px dashed ${borderStyle}`, borderRadius: 'var(--radius-md)',
            padding: value ? '1rem' : '2rem', textAlign: 'center', cursor: 'pointer',
            background: bgStyle, marginTop: '0.5rem',
          }}
          onClick={() => document.getElementById(fileInputId)?.click()}
        >
          {value ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                🎵 {fileName || '已上传音频'}
              </span>
              <button
                onClick={e => { e.stopPropagation(); onChange(null); setFileName(''); }}
                style={{
                  background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%',
                  color: '#fff', cursor: 'pointer', padding: '0.2rem', lineHeight: 1, flexShrink: 0,
                }}
              ><X size={14} /></button>
            </div>
          ) : (
            <>
              <Upload size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
              <p style={{ margin: 0, color: 'var(--text-color)', fontSize: '0.85rem' }}>
                {placeholder || `点击上传音频 (MP3/WAV/FLAC, <${MAX_AUDIO_SIZE_MB}MB, 6s-6min)`}
              </p>
            </>
          )}
          <input id={fileInputId} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleFileChange} />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <input
            className="form-input"
            placeholder="粘贴音频 URL (https://...)"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUrlConfirm()}
            style={{ flex: 1, fontSize: '0.85rem' }}
          />
          <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={handleUrlConfirm} disabled={!urlInput.trim()}>确认</button>
        </div>
      )}
    </div>
  );
};
