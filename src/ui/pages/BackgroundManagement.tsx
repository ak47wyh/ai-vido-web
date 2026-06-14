import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../adapters/outbound/repositories/DexieDatabase';
import { backgroundRepo, storySpaceService } from '../../dependencies';
import { v4 as uuidv4 } from 'uuid';
import { Pencil, Plus, Trash2, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Background } from '../../domain/entities/models';
import { useSpace } from '../contexts/SpaceContext';

type ImageInputMode = 'url' | 'upload';
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

export const BackgroundManagement: React.FC = () => {
  const { t } = useTranslation();
  const { currentSpaceId } = useSpace();
  const backgrounds = useLiveQuery(() => currentSpaceId ? db.backgrounds.where('spaceId').equals(currentSpaceId).toArray() : [], [currentSpaceId]);
  const allSpaces = useLiveQuery(() => db.storySpaces.toArray());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBackgroundId, setEditingBackgroundId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [environmentPrompt, setEnvironmentPrompt] = useState('');
  const [imageInputMode, setImageInputMode] = useState<ImageInputMode>('url');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUploadError, setImageUploadError] = useState('');
  const [copyingBgId, setCopyingBgId] = useState<string | null>(null);
  const [copyTargetSpaceId, setCopyTargetSpaceId] = useState('');

  const resetForm = () => {
    setEditingBackgroundId(null);
    setName('');
    setEnvironmentPrompt('');
    setImageInputMode('url');
    setImageUrl('');
    setImageUploadError('');
    setIsFormOpen(false);
  };

  const openCreateForm = () => {
    if (isFormOpen && !editingBackgroundId) {
      resetForm();
      return;
    }
    resetForm();
    setIsFormOpen(true);
  };

  const handleEdit = (bgId: string) => {
    const bg = backgrounds?.find(item => item.id === bgId);
    if (!bg) return;
    setEditingBackgroundId(bg.id);
    setName(bg.name);
    setEnvironmentPrompt(bg.environmentPrompt);
    setImageUrl(bg.referenceImageUrl || '');
    setImageInputMode(bg.referenceImageUrl?.startsWith('data:image/') ? 'upload' : 'url');
    setImageUploadError('');
    setIsFormOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageUploadError(t('background.uploadInvalidType'));
      e.currentTarget.value = '';
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setImageUploadError(t('background.uploadTooLarge'));
      e.currentTarget.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
        setImageUploadError('');
      } else {
        setImageUploadError(t('background.uploadReadFailed'));
      }
    };
    reader.onerror = () => {
      setImageUploadError(t('background.uploadReadFailed'));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !currentSpaceId) return;

    const createdAt = editingBackgroundId
      ? (backgrounds?.find(item => item.id === editingBackgroundId)?.createdAt ?? Date.now())
      : Date.now();

    const background: Background = {
      id: editingBackgroundId ?? uuidv4(),
      spaceId: currentSpaceId,
      name: name.trim(),
      environmentPrompt: environmentPrompt.trim(),
      referenceImageUrl: imageUrl.trim() || undefined,
      createdAt
    };
    await backgroundRepo.save(background);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('background.confirmDelete'))) return;
    await backgroundRepo.delete(id);
  };

  const handleCopyToSpace = async (bgId: string, targetSpaceId: string) => {
    if (!targetSpaceId) return;
    await storySpaceService.copyBackgroundToSpace(bgId, targetSpaceId);
    setCopyingBgId(null);
    setCopyTargetSpaceId('');
    alert(t('background.copySuccess'));
  };

  const otherSpaces = allSpaces?.filter(s => s.id !== currentSpaceId) ?? [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('background.title')}</h1>
          <p>{t('background.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateForm}>
          <Plus size={18} /> {t('background.newBtn')}
        </button>
      </div>

      {isFormOpen && (
        <form className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }} onSubmit={handleSave}>
          <h3 style={{ marginBottom: '1.5rem' }}>
            {editingBackgroundId ? t('background.editTitle') : t('background.createTitle')}
          </h3>
          <div className="form-group">
            <label className="form-label">{t('background.nameLabel')}</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} required placeholder={t('background.namePlaceholder')} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('background.envLabel')}</label>
            <textarea className="form-textarea" value={environmentPrompt} onChange={e => setEnvironmentPrompt(e.target.value)} placeholder={t('background.envPlaceholder')} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('background.imageSourceLabel')}</label>
            <select
              className="form-select"
              value={imageInputMode}
              onChange={e => {
                const nextMode = e.target.value as ImageInputMode;
                setImageInputMode(nextMode);
                setImageUploadError('');
                setImageUrl('');
              }}
            >
              <option value="url">{t('background.imageSourceUrl')}</option>
              <option value="upload">{t('background.imageSourceUpload')}</option>
            </select>
          </div>
          {imageInputMode === 'url' ? (
            <div className="form-group">
              <label className="form-label">{t('background.imageLabel')}</label>
              <input className="form-input" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder={t('background.imagePlaceholder')} />
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">{t('background.uploadLabel')}</label>
              <input className="form-input" type="file" accept="image/*" onChange={handleImageUpload} />
              {imageUploadError && (
                <p style={{ marginTop: '0.5rem', color: 'lightcoral', fontSize: '0.875rem' }}>{imageUploadError}</p>
              )}
            </div>
          )}
          {imageUrl && (
            <div style={{ marginBottom: '1rem' }}>
              <img
                src={imageUrl}
                alt={name || t('background.previewAlt')}
                style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: 'var(--radius-md)' }}
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            </div>
          )}
          <div className="flex gap-4">
            <button type="submit" className="btn btn-primary">
              {editingBackgroundId ? t('background.updateBtn') : t('background.saveBtn')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={resetForm}>{t('background.cancelBtn')}</button>
          </div>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {backgrounds?.map(bg => (
          <div key={bg.id} className="glass-panel" style={{ padding: '1.5rem', position: 'relative' }}>
            {bg.referenceImageUrl && (
              <img
                src={bg.referenceImageUrl}
                alt={bg.name}
                style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            )}
            <h3 style={{ marginBottom: '0.5rem' }}>{bg.name}</h3>
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', opacity: 0.8 }}><strong>{t('background.environment')}</strong> {bg.environmentPrompt || 'N/A'}</p>
            <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.4rem', border: 'none' }}
                onClick={() => handleEdit(bg.id)}
              >
                <Pencil size={16} />
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.4rem', border: 'none' }}
                onClick={() => handleDelete(bg.id)}
              >
                <Trash2 size={16} />
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.4rem', border: 'none' }}
                title={t('background.copyToSpace')}
                onClick={() => {
                  setCopyingBgId(copyingBgId === bg.id ? null : bg.id);
                  setCopyTargetSpaceId('');
                }}
              >
                <Copy size={16} />
              </button>
            </div>
            {copyingBgId === bg.id && otherSpaces.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', alignItems: 'center' }}>
                <select
                  className="form-select"
                  style={{ flex: 1, fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}
                  value={copyTargetSpaceId}
                  onChange={e => setCopyTargetSpaceId(e.target.value)}
                >
                  <option value="">{t('space.selectTarget')}</option>
                  {otherSpaces.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <button
                  className="btn btn-primary"
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                  disabled={!copyTargetSpaceId}
                  onClick={() => handleCopyToSpace(bg.id, copyTargetSpaceId)}
                >
                  ✓
                </button>
              </div>
            )}
          </div>
        ))}
        {backgrounds?.length === 0 && !isFormOpen && (
          <p style={{ color: 'var(--text-muted)' }}>{t('background.empty')}</p>
        )}
      </div>
    </div>
  );
};
