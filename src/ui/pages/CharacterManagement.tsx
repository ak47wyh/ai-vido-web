import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../adapters/outbound/repositories/DexieDatabase';
import { characterRepo, storyService, storySpaceService } from '../../dependencies';
import { v4 as uuidv4 } from 'uuid';
import { Pencil, Plus, Trash2, Copy, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Character } from '../../domain/entities/models';
import { useSpace } from '../contexts/SpaceContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useImageUpload, useCopyToSpace } from '../hooks/useSharedForm';

export const CharacterManagement: React.FC = () => {
  const { t } = useTranslation();
  const { currentSpaceId } = useSpace();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const characters = useLiveQuery(() => currentSpaceId ? db.characters.where('spaceId').equals(currentSpaceId).toArray() : [], [currentSpaceId]);
  const allSpaces = useLiveQuery(() => db.storySpaces.toArray());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [appearance, setAppearance] = useState('');
  const [personality, setPersonality] = useState('');
  const [characterBackground, setCharacterBackground] = useState('');
  const { imageInputMode, imageUrl, imageUploadError, setImageUrl, handleImageUpload, switchImageMode, resetImageState } = useImageUpload('character');
  const { copyingId, copyTargetSpaceId, setCopyTargetSpaceId, startCopy, finishCopy } = useCopyToSpace();

  const resetForm = () => {
    setEditingCharacterId(null);
    setName('');
    setAppearance('');
    setPersonality('');
    setCharacterBackground('');
    resetImageState();
    setIsFormOpen(false);
  };

  const openCreateForm = () => {
    if (isFormOpen && !editingCharacterId) {
      resetForm();
      return;
    }
    resetForm();
    setIsFormOpen(true);
  };

  const handleEdit = (characterId: string) => {
    const character = characters?.find(item => item.id === characterId);
    if (!character) return;
    setEditingCharacterId(character.id);
    setName(character.name);
    setAppearance(character.appearancePrompt);
    setPersonality(character.personalityPrompt);
    setCharacterBackground(character.characterBackground || '');
    setImageUrl(character.referenceImageUrl || '');
    switchImageMode(character.referenceImageUrl?.startsWith('data:image/') ? 'upload' : 'url');
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !currentSpaceId) return;
    const createdAt = editingCharacterId
      ? (characters?.find(item => item.id === editingCharacterId)?.createdAt ?? Date.now())
      : Date.now();

    const character: Character = {
      id: editingCharacterId ?? uuidv4(),
      spaceId: currentSpaceId,
      name: name.trim(),
      appearancePrompt: appearance.trim(),
      personalityPrompt: personality.trim(),
      characterBackground: characterBackground.trim(),
      referenceImageUrl: imageUrl.trim() || undefined,
      createdAt
    };
    await characterRepo.save(character);
    showToast('success', t(editingCharacterId ? 'character.updateSuccess' : 'character.saveSuccess'));
    resetForm();
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: t('character.confirmDeleteTitle'),
      message: t('character.confirmDelete'),
      confirmLabel: t('character.deleteConfirmBtn'),
      danger: true
    });
    if (!ok) return;
    await storyService.removeCharacterFromSegments(id);
    await characterRepo.delete(id);
    showToast('success', t('character.deleteSuccess'));
  };

  const handleCopyToSpace = async (charId: string, targetSpaceId: string) => {
    if (!targetSpaceId) return;
    await storySpaceService.copyCharacterToSpace(charId, targetSpaceId);
    finishCopy();
    showToast('success', t('character.copySuccess'));
  };

  const otherSpaces = allSpaces?.filter(s => s.id !== currentSpaceId) ?? [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('character.title')}</h1>
          <p>{t('character.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateForm}>
          <Plus size={18} /> {t('character.newBtn')}
        </button>
      </div>

      {isFormOpen && (
        <form className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }} onSubmit={handleSave}>
          <h3 style={{ marginBottom: '1.5rem' }}>
            {editingCharacterId ? t('character.editTitle') : t('character.createTitle')}
          </h3>
          <div className="form-group">
            <label className="form-label">{t('character.nameLabel')}</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} required placeholder={t('character.namePlaceholder')} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('character.appearanceLabel')}</label>
            <textarea className="form-textarea" value={appearance} onChange={e => setAppearance(e.target.value)} placeholder={t('character.appearancePlaceholder')} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('character.personalityLabel')}</label>
            <textarea className="form-textarea" value={personality} onChange={e => setPersonality(e.target.value)} placeholder={t('character.personalityPlaceholder')} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('character.backgroundLabel')}</label>
            <textarea className="form-textarea" value={characterBackground} onChange={e => setCharacterBackground(e.target.value)} placeholder={t('character.backgroundPlaceholder')} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('character.imageSourceLabel')}</label>
            <select
              className="form-select"
              value={imageInputMode}
              onChange={e => switchImageMode(e.target.value as 'url' | 'upload')}
            >
              <option value="url">{t('character.imageSourceUrl')}</option>
              <option value="upload">{t('character.imageSourceUpload')}</option>
            </select>
          </div>
          {imageInputMode === 'url' ? (
            <div className="form-group">
              <label className="form-label">{t('character.imageLabel')}</label>
              <input className="form-input" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder={t('character.imagePlaceholder')} />
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">{t('character.uploadLabel')}</label>
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
                alt={t('character.previewAlt')}
                style={{ width: '180px', height: '180px', objectFit: 'cover', borderRadius: 'var(--radius-md)' }}
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            </div>
          )}
          <div className="flex gap-4">
            <button type="submit" className="btn btn-primary">
              {editingCharacterId ? t('character.updateBtn') : t('character.saveBtn')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={resetForm}>{t('character.cancelBtn')}</button>
          </div>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {characters?.map(char => (
          <div key={char.id} className="glass-panel" style={{ padding: '1.5rem', position: 'relative' }}>
            {char.referenceImageUrl && (
              <img
                src={char.referenceImageUrl}
                alt={char.name}
                style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            )}
            <h3 style={{ marginBottom: '0.5rem' }}>{char.name}</h3>
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', opacity: 0.8 }}><strong>{t('character.appearance')}</strong> {char.appearancePrompt || 'N/A'}</p>
            {char.personalityPrompt && (
              <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', opacity: 0.8 }}><strong>{t('character.personality')}</strong> {char.personalityPrompt.length > 60 ? char.personalityPrompt.substring(0, 60) + '...' : char.personalityPrompt}</p>
            )}
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', opacity: 0.8 }}><strong>{t('character.background')}</strong> {char.characterBackground || 'N/A'}</p>
            <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.4rem', border: 'none' }}
                onClick={() => handleEdit(char.id)}
              >
                <Pencil size={16} />
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.4rem', border: 'none' }}
                onClick={() => handleDelete(char.id)}
              >
                <Trash2 size={16} />
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.4rem', border: 'none' }}
                title={t('character.copyToSpace')}
                onClick={() => startCopy(char.id)}
              >
                <Copy size={16} />
              </button>
            </div>
            {copyingId === char.id && otherSpaces.length > 0 && (
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
                  onClick={() => handleCopyToSpace(char.id, copyTargetSpaceId)}
                >
                  ✓
                </button>
              </div>
            )}
          </div>
        ))}
        {characters?.length === 0 && !isFormOpen && (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', gridColumn: '1 / -1' }}>
            <Users size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{t('character.empty')}</p>
            <button className="btn btn-primary" onClick={openCreateForm}>
              <Plus size={18} /> {t('character.newBtn')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
