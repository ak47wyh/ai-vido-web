import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Trash2, Image as ImageIcon, Mic, Check } from 'lucide-react';
import { assetLibraryService } from '../../dependencies';
import { useConfirm } from '../contexts/ConfirmContext';
import { useSavedImages, useSavedVoices, useSavedPrompts } from '../hooks/useSavedAssets';
import type { SavedImage, SavedVoice, SavedPrompt, PromptCategory } from '../../domain/entities/models';
import { InputWithCounter } from './InputWithCounter';
import { TEXT_LIMITS } from '../../domain/constants/textLimits';
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
  const { confirm } = useConfirm();
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

  const getSelectedItems = useCallback(() => {
    if (type === 'image') return (imagesQuery.images as (SavedImage | SavedVoice | SavedPrompt)[]).filter(i => selectedIds.has(i.id));
    if (type === 'voice') return (voicesQuery.voices as (SavedImage | SavedVoice | SavedPrompt)[]).filter(i => selectedIds.has(i.id));
    return (promptsQuery.prompts as (SavedImage | SavedVoice | SavedPrompt)[]).filter(i => selectedIds.has(i.id));
  }, [type, imagesQuery.images, voicesQuery.voices, promptsQuery.prompts, selectedIds]);

  const handleConfirm = useCallback(() => {
    const items = getSelectedItems();
    items.forEach(item => onSelect(item));
    onClose();
  }, [getSelectedItems, onSelect, onClose]);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: t('assetLibrary.deleteConfirm', '确定删除此素材？'),
      message: t('assetLibrary.deleteConfirm', '确定删除此素材？'),
      danger: true,
    });
    if (!ok) return;
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
  }, [type, t, confirm, imagesQuery, voicesQuery, promptsQuery]);

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
  // url 状态：string=正常URL；''=加载中；null=图源缺失
  const [imageUrls, setImageUrls] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancelled = false;
    const urls: Record<string, string | null> = {};
    const loadUrls = async () => {
      for (const img of images) {
        try {
          const url = await assetLibraryService.getImageBlobUrl(img);
          urls[img.id] = url;
        } catch {
          // 图源缺失：标记为 null，UI 显示"图源缺失·点击修复"
          urls[img.id] = null;
        }
      }
      if (!cancelled) setImageUrls(urls);
    };
    if (images.length > 0) loadUrls();
    return () => {
      cancelled = true;
      // 撤销本次 effect 内创建的 URL（用局部变量跟踪，避免依赖 imageUrls state）
      Object.values(urls).forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [images]);

  if (loading) return <div className="asset-picker-empty">加载中...</div>;
  if (images.length === 0) return <div className="asset-picker-empty">{t('assetLibrary.pickerEmpty', '暂无素材，去实验室生成吧')}</div>;

  return (
    <div className="asset-image-grid">
      {images.map(img => {
        const urlState = imageUrls[img.id];
        const isMissing = urlState === null;
        const isLoading = urlState === undefined;
        return (
          <div
            key={img.id}
            className={`asset-image-card ${selectedIds.has(img.id) ? 'selected' : ''}`}
            onClick={() => onSelect(img.id)}
          >
            {urlState && !isMissing ? (
              <img src={urlState} alt={img.name} />
            ) : isMissing ? (
              <div
                style={{
                  aspectRatio: '16/9',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(220, 38, 38, 0.15)',
                  color: '#fca5a5',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  textAlign: 'center',
                }}
                title={t('assetLibrary.missingHint', '图源文件缺失，可能存储目录已切换。点击尝试修复或删除后重新保存。')}
                onClick={e => {
                  e.stopPropagation();
                  // 点击缺失提示：重新尝试加载一次（删除 key 触发 loading 态）
                  setImageUrls(prev => {
                    const next = { ...prev };
                    delete next[img.id];
                    return next;
                  });
                  assetLibraryService.getImageBlobUrl(img)
                    .then(u => setImageUrls(prev => ({ ...prev, [img.id]: u })))
                    .catch(() => setImageUrls(prev => ({ ...prev, [img.id]: null })));
                }}
              >
                <ImageIcon size={20} style={{ marginBottom: '0.25rem' }} />
                <span style={{ fontSize: '0.7rem' }}>
                  {t('assetLibrary.missingLabel', '图源缺失·点击修复')}
                </span>
              </div>
            ) : isLoading ? (
              <div style={{ aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                <ImageIcon size={24} style={{ color: 'var(--text-muted)' }} />
              </div>
            ) : null}
            <div className="asset-card-info">
              <div className="asset-card-name">{img.name}</div>
              <div className="asset-card-tags">{img.tags.join(', ')}</div>
            </div>
            <button className="asset-card-delete" onClick={e => onDelete(img.id, e)}>x</button>
          </div>
        );
      })}
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
    let cancelled = false;
    const urls: Record<string, string> = {};
    const loadUrls = async () => {
      for (const v of voices) {
        try {
          urls[v.id] = await assetLibraryService.getVoiceBlobUrl(v);
        } catch {
          urls[v.id] = '';
        }
      }
      if (!cancelled) setAudioUrls(urls);
    };
    if (voices.length > 0) loadUrls();
    return () => {
      cancelled = true;
      // 撤销本次 effect 内创建的 URL（用局部变量跟踪，避免依赖 audioUrls state）
      Object.values(urls).forEach(url => {
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
function PromptList({ prompts, selectedIds, onSelect, loading, t }: {
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
          <InputWithCounter
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="输入素材名称"
            maxLength={TEXT_LIMITS.ASSET_NAME_MAX}
          />
        </div>
        <div className="form-group">
          <label>{t('assetLibrary.tagsLabel', '标签（逗号分隔）')}</label>
          <InputWithCounter
            type="text"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="例如: 背景, 夜景, 赛博朋克"
            maxLength={TEXT_LIMITS.ASSET_TAGS_MAX}
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
