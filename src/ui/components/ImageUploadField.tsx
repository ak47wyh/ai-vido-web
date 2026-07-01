import React, { useState } from 'react';
import { Upload, Link, X } from 'lucide-react';
import { fileToBase64, validateImageFile, IMAGE_MAX_SIZE_MB } from '../utils/imageUtils';
import { TEXT_LIMITS } from '../../domain/constants/textLimits';

// 递增 ID 用于图片上传 input
let imageUploadCounter = 0;

export interface ImageUploadFieldProps {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  borderColor?: string;
  bgColor?: string;
  placeholder?: string;
  maxHeight?: string;
}

/** 图片上传组件：支持本地上传（Base64）和 URL 输入 */
export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  label, value, onChange, borderColor, bgColor, placeholder, maxHeight = '200px',
}) => {
  const [mode, setMode] = useState<'file' | 'url'>('file');
  const [urlInput, setUrlInput] = useState('');
  const [fileInputId] = useState(() => `img-upload-${++imageUploadCounter}`);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) { alert(err); return; }
    const base64 = await fileToBase64(file);
    onChange(base64);
  };

  const handleUrlConfirm = () => {
    const trimmed = urlInput.trim();
    if (trimmed) onChange(trimmed);
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
          style={{ border: `2px dashed ${borderStyle}`, borderRadius: 'var(--radius-md)', padding: value ? '0.5rem' : '2rem', textAlign: 'center', cursor: 'pointer', background: bgStyle, marginTop: '0.5rem', overflow: 'hidden' }}
          onClick={() => document.getElementById(fileInputId)?.click()}
        >
          {value ? (
            <div style={{ position: 'relative' }}>
              <img src={value} alt={label} style={{ maxWidth: '100%', maxHeight, borderRadius: 'var(--radius-md)' }} />
              <button
                onClick={e => { e.stopPropagation(); onChange(null); }}
                style={{ position: 'absolute', top: '0.25rem', right: '0.25rem', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', color: '#fff', cursor: 'pointer', padding: '0.2rem', lineHeight: 1 }}
              ><X size={14} /></button>
            </div>
          ) : (
            <>
              <Upload size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
              <p style={{ margin: 0, color: 'var(--text-color)', fontSize: '0.85rem' }}>{placeholder || `点击上传图片 (JPG/PNG/WebP, <${IMAGE_MAX_SIZE_MB}MB)`}</p>
            </>
          )}
          <input id={fileInputId} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <input
            className="form-input"
            placeholder="粘贴图片 URL (https://...)"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUrlConfirm()}
            style={{ flex: 1, fontSize: '0.85rem' }}
            maxLength={TEXT_LIMITS.URL_MAX}
          />
          <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={handleUrlConfirm} disabled={!urlInput.trim()}>确认</button>
        </div>
      )}
    </div>
  );
};
