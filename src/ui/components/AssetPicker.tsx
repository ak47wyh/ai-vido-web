import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Search, Trash2, Image as ImageIcon, Mic, FileText, Check } from 'lucide-react';
import { assetLibraryService } from '../../dependencies';
import { useSavedImages, useSavedVoices, useSavedPrompts } from '../hooks/useSavedAssets';
import type { SavedImage, SavedVoice, SavedPrompt, PromptCategory } from '../../domain/entities/models';
import './AssetPicker.css';

interface AssetPickerProps {
  type: 'image' | 'voice' | 'prompt';
  spaceId: string;
  category?: PromptCategory;
  onSelect: (asset: SavedImage | SavedVoice | SavedPrompt) => void;
  onClose: () => void;
  multiple?: boolean;
}

export const AssetPicker: React.FC<AssetPickerProps> = ({
  type,
  spaceId,
  category,
  onSelect,
  onClose,
  multiple = false,
}) => {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const imagesQuery = useSavedImages(spaceId, { keyword: keyword || undefined });
  const voicesQuery = useSavedVoices(spaceId, { keyword: keyword || undefined });
  const promptsQuery = useSavedPrompts(spaceId, { keyword: keyword || undefined, category });

  const typeLabel = type === 'image' ? t('assetLibrary.typeImage', '图片') : type === 'voice' ? t('assetLibrary.typeVoice', '音色') : t('assetLibrary.typePrompt', '提示词');

  const handleSelect = useCallback((id: string) => {
    if (multiple) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      setSelectedIds(new Set([id]));
    }
  }, [multiple]);

  const handleConfirm = useCallback(() => {
    const items = getSelectedItems();
    items.forEach(item => onSelect(item));
    onClose();
  }, [selectedIds, onSelect, onClose]);

  const getSelectedItems = () => {
    if (type === 'image') return (imagesQuery.images as (SavedImage | SavedVoice | SavedPrompt)[]).filter(i => selectedIds.has(i.id));
    if (type === 'voice') return (voicesQuery.voices as (SavedImage | SavedVoice | SavedPrompt)[]).filter(i => selectedIds.has(i.id));
    return (promptsQuery.prompts as (SavedImage | SavedVoice | SavedPrompt)[]).filter(i => selectedIds.has(i.id));
  };

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(t('assetLibrary.deleteConfirm', '确定删除此素材？'))) return;
    try {
      if (type === 'image') await assetLibraryService.deleteImage(id);
      else if (type === 'voice') await assetLibraryService.deleteVoice(id);
      else await assetLibraryService.deletePrompt(id);
      // Refetch
      if (type === 'image') imagesQuery.refetch();
      else if (type === 'voice') voicesQuery.refetch();
      else promptsQuery.refetch();
    } catch {
      // ignore
    }
  }, [type]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  return (
    <div className="asset-picker-overlay" onClick={handleOverlayClick}>
      <div className="asset-picker-modal">
        <div className="asset-picker-header">
          <h3>{t('assetLibrary.pickerTitle', '选择{{type}}').replace('{{type}}', typeLabel)}</h3>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '0.4rem', minWidth: 'auto' }}>
            <X size={18} />
          </button>
        </div>

        <div className="asset-picker-search">
          <input
            type="text"
            placeholder={t('assetLibrary.pickerSearch', '搜索素材...')}
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
          />
        </div>

        <div className="asset-picker-body">
          {type === 'image' && <ImageList images={imagesQuery.images} selectedIds={selectedIds} onSelect={handleSelect} onDelete={handleDelete} loading={imagesQuery.loading} t={t} />}
          {type === 'voice' && <VoiceList voices={voicesQuery.voices} selectedIds={selectedIds} onSelect={handleSelect} onDelete={handleDelete} loading={voicesQuery.loading} t={t} />}
          {type === 'prompt' && <PromptList prompts={promptsQuery.prompts} selectedIds={selectedIds} onSelect={handleSelect} onDelete={handleDelete} loading={promptsQuery.loading} t={t} />}
        </div>

        <div className="asset-picker-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            {t('assetLibrary.pickerCancel', '取消')}
          </button>
          <button className="btn btn-primary" disabled={selectedIds.size === 0} onClick={handleConfirm}>
            <Check size={16} /> {t('assetLibrary.pickerConfirm', '确认选择')}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Image List ---
function ImageList({ images, selectedIds, onSelect, onDelete, loading, t }: {
  images: SavedImage[];
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  loading: boolean;
  t: (key: string, fallback: string) => string;
}) {
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadUrls = async () => {
      const urls: Record<string, string> = {};
      for (const img of images) {
        try {
          urls[img.id] = await assetLibraryService.getImageBlobUrl(img);
        } catch {
          urls[img.id] = '';
        }
      }
      setImageUrls(urls);
    };
    if (images.length > 0) loadUrls();
    return () => {
      Object.values(imageUrls).forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [images]);

  if (loading) return <div className="asset-picker-empty">加载中...</div>;
  if (images.length === 0) return <div className="asset-picker-empty">{t('assetLibrary.pickerEmpty', '暂无素材，去实验室生成吧')}</div>;

  return (
    <div className="asset-image-grid">
      {images.map(img => (
        <div
          key={img.id}
          className={`asset-image-card ${selectedIds.has(img.id) ? 'selected' : ''}`}
          onClick={() => onSelect(img.id)}
        >
          {imageUrls[img.id] ? (
            <img src={imageUrls[img.id]} alt={img.name} />
          ) : (
            <div style={{ aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
              <ImageIcon size={24} style={{ color: 'var(--text-muted)' }} />
            </div>
          )}
          <div className="asset-card-info">
            <div className="asset-card-name">{img.name}</div>
            <div className="asset-card-tags">{img.tags.join(', ')}</div>
          </div>
          <button className="asset-card-delete" onClick={e => onDelete(img.id, e)}>x</button>
        </div>
      ))}
    </div>
  );
}

// --- Voice List ---
function VoiceList({ voices, selectedIds, onSelect, onDelete, loading, t }: {
  voices: SavedVoice[];
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  loading: boolean;
  t: (key: string, fallback: string) => string;
}) {
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadUrls = async () => {
      const urls: Record<string, string> = {};
      for (const v of voices) {
        try {
          urls[v.id] = await assetLibraryService.getVoiceBlobUrl(v);
        } catch {
          urls[v.id] = '';
        }
      }
      setAudioUrls(urls);
    };
    if (voices.length > 0) loadUrls();
    return () => {
      Object.values(audioUrls).forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [voices]);

  if (loading) return <div className="asset-picker-empty">加载中...</div>;
  if (voices.length === 0) return <div className="asset-picker-empty">{t('assetLibrary.pickerEmpty', '暂无素材，去实验室生成吧')}</div>;

  return (
    <div className="asset-voice-list">
      {voices.map(v => (
        <div
          key={v.id}
          className={`asset-voice-item ${selectedIds.has(v.id) ? 'selected' : ''}`}
          onClick={() => onSelect(v.id)}
        >
          <Mic size={20} style={{ color: '#ec4899', flexShrink: 0 }} />
          <div className="voice-info">
            <div className="voice-name">{v.name}</div>
            <div className="voice-meta">{v.voiceId} | {v.model} | {v.speed}x</div>
          </div>
          {audioUrls[v.id] && (
            <audio src={audioUrls[v.id]} controls style={{ height: '32px', width: '120px' }} onClick={e => e.stopPropagation()} />
          )}
          <button className="btn btn-secondary" style={{ padding: '0.3rem', minWidth: 'auto' }} onClick={e => onDelete(v.id, e)}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// --- Prompt List ---
function PromptList({ prompts, selectedIds, onSelect, onDelete, loading, t }: {
  prompts: SavedPrompt[];
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  loading: boolean;
  t: (key: string, fallback: string) => string;
}) {
  if (loading) return <div className="asset-picker-empty">加载中...</div>;
  if (prompts.length === 0) return <div className="asset-picker-empty">{t('assetLibrary.pickerEmpty', '暂无素材，去实验室生成吧')}</div>;

  return (
    <div className="asset-prompt-list">
      {prompts.map(p => (
        <div
          key={p.id}
          className={`asset-prompt-card ${selectedIds.has(p.id) ? 'selected' : ''}`}
          onClick={() => onSelect(p.id)}
        >
          <div className="prompt-name">{p.name}</div>
          <div className="prompt-content">{p.content}</div>
          <div className="prompt-meta">
            <span className="prompt-tag">{p.category}</span>
            {p.tags.map(tag => (
              <span key={tag} className="prompt-tag">{tag}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Save Dialog ---
interface SaveDialogProps {
  title: string;
  defaultName: string;
  onSave: (name: string, tags: string) => void;
  onCancel: () => void;
}

export const AssetSaveDialog: React.FC<SaveDialogProps> = ({ title, defaultName, onSave, onCancel }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(defaultName);
  const [tags, setTags] = useState('');

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div className="asset-save-dialog" onClick={handleOverlayClick}>
      <div className="asset-save-dialog-content">
        <h3>{title}</h3>
        <div className="form-group">
          <label>{t('assetLibrary.nameLabel', '素材名称')}</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="输入素材名称"
          />
        </div>
        <div className="form-group">
          <label>{t('assetLibrary.tagsLabel', '标签（逗号分隔）')}</label>
          <input
            type="text"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="例如: 背景, 夜景, 赛博朋克"
          />
        </div>
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onCancel}>{t('assetLibrary.pickerCancel', '取消')}</button>
          <button className="btn btn-primary" disabled={!name.trim()} onClick={() => onSave(name.trim(), tags)}>
            {t('assetLibrary.saveBtn', '保存到素材库')}
          </button>
        </div>
      </div>
    </div>
  );
};
