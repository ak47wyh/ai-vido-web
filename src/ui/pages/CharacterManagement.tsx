import React, { useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../adapters/outbound/repositories/DexieDatabase';
import { characterRepo, storyService, storySpaceService, imageGenerationService, imageAdapter, voiceService } from '../../dependencies';
import { v4 as uuidv4 } from 'uuid';
import { Pencil, Plus, Trash2, Copy, Users, ChevronDown, ChevronUp, Sparkles, RefreshCw, Mic, Upload, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Character } from '../../domain/entities/models';
import { useSpace } from '../contexts/SpaceContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useImageUpload, useCopyToSpace } from '../hooks/useSharedForm';
import { SYSTEM_VOICES, VOICES_BY_LANGUAGE, LANGUAGE_LABELS } from '../../domain/data/systemVoices';
import { getErrorMessage } from '../utils/errorUtils';

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
  const [generatingCharId, setGeneratingCharId] = useState<string | null>(null);
  const [generateAspectRatio, setGenerateAspectRatio] = useState('1:1');
  const [selectedVoiceId, setSelectedVoiceId] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [cloneAudioFile, setCloneAudioFile] = useState<File | null>(null);
  const [promptAudioFile, setPromptAudioFile] = useState<File | null>(null);
  const [promptText, setPromptText] = useState('');
  const { imageInputMode, imageUrl, imageUploadError, isGenerating, setImageUrl, handleImageUpload, switchImageMode, resetImageState } = useImageUpload('character');
  const { copyingId, copyTargetSpaceId, setCopyTargetSpaceId, startCopy, finishCopy } = useCopyToSpace();
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((key: string) => {
    setExpandedFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const resetForm = () => {
    setEditingCharacterId(null);
    setName('');
    setAppearance('');
    setPersonality('');
    setCharacterBackground('');
    setSelectedVoiceId('');
    setCloneAudioFile(null);
    setPromptAudioFile(null);
    setPromptText('');
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
    setSelectedVoiceId(character.voiceId || '');
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
      voiceId: selectedVoiceId || undefined,
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

  const handleGenerateCharacterImage = async (characterId: string) => {
    setGeneratingCharId(characterId);
    try {
      await imageGenerationService.generateCharacterImage(characterId, generateAspectRatio);
      showToast('success', t('character.generateImageSuccess'));
    } catch (e: unknown) {
      const message = getErrorMessage(e, t('character.generateImageFailed'));
      showToast('error', message);
    } finally {
      setGeneratingCharId(null);
    }
  };

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

          {/* Voice Selection */}
          <div className="form-group">
            <label className="form-label">
              <Mic size={14} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
              {t('character.voiceLabel')}
            </label>
            <select className="form-select" value={selectedVoiceId} onChange={e => setSelectedVoiceId(e.target.value)}>
              <option value="">{t('character.noVoice')}</option>
              {Object.entries(VOICES_BY_LANGUAGE).map(([lang, voices]) => (
                <optgroup key={lang} label={LANGUAGE_LABELS[lang] || lang}>
                  {voices.map(v => (
                    <option key={v.voiceId} value={v.voiceId}>{v.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Voice Clone */}
          <div className="form-group" style={{ border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius-md)', padding: '0.75rem' }}>
            <label className="form-label" style={{ fontSize: '0.8rem', color: '#818cf8' }}>
              <Upload size={14} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
              {t('character.cloneVoice')}
            </label>
            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>{t('character.cloneAudioLabel')}</label>
              <input className="form-input" type="file" accept="audio/mp3,audio/m4a,audio/wav,audio/mpeg" onChange={e => setCloneAudioFile(e.target.files?.[0] || null)} />
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{t('character.cloneAudioHint')}</p>
            </div>
            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>{t('character.promptAudioLabel')}</label>
              <input className="form-input" type="file" accept="audio/mp3,audio/m4a,audio/wav,audio/mpeg" onChange={e => setPromptAudioFile(e.target.files?.[0] || null)} />
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{t('character.promptAudioHint')}</p>
            </div>
            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>{t('character.promptTextLabel')}</label>
              <input className="form-input" value={promptText} onChange={e => setPromptText(e.target.value)} />
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              disabled={isCloning || !cloneAudioFile}
              onClick={async () => {
                if (!cloneAudioFile) return;
                setIsCloning(true);
                try {
                  const customVoiceId = `clone_${Date.now()}`;
                  const text = personality.trim() || appearance.trim() || '你好，我是' + (name.trim() || '角色');
                  const clonedVoiceId = await voiceService.cloneVoice(
                    cloneAudioFile,
                    customVoiceId,
                    text,
                    promptAudioFile || undefined,
                    promptText || undefined
                  );
                  setSelectedVoiceId(clonedVoiceId);
                  showToast('success', t('character.cloneVoiceSuccess'));
                } catch (e: unknown) {
                  showToast('error', getErrorMessage(e, t('character.cloneVoiceFailed')));
                } finally {
                  setIsCloning(false);
                }
              }}
            >
              {isCloning ? <RefreshCw size={14} className="spin" /> : <Upload size={14} />}
              {isCloning ? t('character.cloneVoiceCloning') : t('character.cloneVoiceBtn')}
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">{t('character.imageSourceLabel')}</label>
            <select
              className="form-select"
              value={imageInputMode}
              onChange={e => switchImageMode(e.target.value as 'url' | 'upload' | 'generate')}
            >
              <option value="url">{t('character.imageSourceUrl')}</option>
              <option value="upload">{t('character.imageSourceUpload')}</option>
              <option value="generate">{t('character.imageSourceGenerate')}</option>
            </select>
          </div>
          {imageInputMode === 'url' ? (
            <div className="form-group">
              <label className="form-label">{t('character.imageLabel')}</label>
              <input className="form-input" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder={t('character.imagePlaceholder')} />
            </div>
          ) : imageInputMode === 'upload' ? (
            <div className="form-group">
              <label className="form-label">{t('character.uploadLabel')}</label>
              <input className="form-input" type="file" accept="image/*" onChange={handleImageUpload} />
              {imageUploadError && (
                <p style={{ marginTop: '0.5rem', color: 'lightcoral', fontSize: '0.875rem' }}>{imageUploadError}</p>
              )}
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">{t('character.aspectRatioLabel')}</label>
              <select className="form-select" value={generateAspectRatio} onChange={e => setGenerateAspectRatio(e.target.value)}>
                <option value="1:1">{t('character.aspectRatio1_1')}</option>
                <option value="16:9">{t('character.aspectRatio16_9')}</option>
                <option value="4:3">{t('character.aspectRatio4_3')}</option>
                <option value="3:4">{t('character.aspectRatio3_4')}</option>
                <option value="9:16">{t('character.aspectRatio9_16')}</option>
              </select>
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                disabled={isGenerating || (!appearance.trim() && !personality.trim())}
                onClick={async () => {
                  if (!appearance.trim() && !personality.trim()) {
                    showToast('warning', t('character.noPromptForImage'));
                    return;
                  }
                  const prompt = [appearance.trim(), personality.trim()].filter(Boolean).join(', ');
                  try {
                    const result = await imageAdapter.generateImage({ prompt, aspectRatio: generateAspectRatio });
                    setImageUrl(result.imageDataUri);
                  } catch (err: unknown) {
                    const msg = getErrorMessage(err, 'Image generation failed');
                    showToast('error', msg);
                  }
                }}
              >
                <Sparkles size={14} />
                {isGenerating ? t('character.generatingImage') : t('character.generateBtn')}
              </button>
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
            {char.appearancePrompt && (
              <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem', opacity: 0.8 }}>
                <strong>{t('character.appearance')}</strong>
                <span style={expandedFields.has(`${char.id}-appearance`) ? undefined : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{char.appearancePrompt}</span>
                {char.appearancePrompt.length > 80 && (
                  <button onClick={() => toggleExpand(`${char.id}-appearance`)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', padding: '0 0.25rem', verticalAlign: 'middle' }}>
                    {expandedFields.has(`${char.id}-appearance`) ? <><ChevronUp size={12} /> {t('common.collapse')}</> : <><ChevronDown size={12} /> {t('common.expand')}</>}
                  </button>
                )}
              </div>
            )}
            {char.personalityPrompt && (
              <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem', opacity: 0.8 }}>
                <strong>{t('character.personality')}</strong>
                <span style={expandedFields.has(`${char.id}-personality`) ? undefined : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{char.personalityPrompt}</span>
                {char.personalityPrompt.length > 80 && (
                  <button onClick={() => toggleExpand(`${char.id}-personality`)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', padding: '0 0.25rem', verticalAlign: 'middle' }}>
                    {expandedFields.has(`${char.id}-personality`) ? <><ChevronUp size={12} /> {t('common.collapse')}</> : <><ChevronDown size={12} /> {t('common.expand')}</>}
                  </button>
                )}
              </div>
            )}
            {char.characterBackground && (
              <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem', opacity: 0.8 }}>
                <strong>{t('character.background')}</strong>
                <span style={expandedFields.has(`${char.id}-bg`) ? undefined : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{char.characterBackground}</span>
                {char.characterBackground.length > 80 && (
                  <button onClick={() => toggleExpand(`${char.id}-bg`)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', padding: '0 0.25rem', verticalAlign: 'middle' }}>
                    {expandedFields.has(`${char.id}-bg`) ? <><ChevronUp size={12} /> {t('common.collapse')}</> : <><ChevronDown size={12} /> {t('common.expand')}</>}
                  </button>
                )}
              </div>
            )}
            {char.voiceId && (
              <div style={{ fontSize: '0.8rem', marginBottom: '0.5rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Volume2 size={12} style={{ color: '#818cf8' }} />
                <span>{SYSTEM_VOICES.find(v => v.voiceId === char.voiceId)?.name || char.voiceId}</span>
              </div>
            )}
            <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.4rem', border: 'none', color: '#a78bfa' }}
                onClick={() => handleGenerateCharacterImage(char.id)}
                disabled={generatingCharId === char.id}
                title={t('character.generateImage')}
              >
                {generatingCharId === char.id ? <RefreshCw size={16} className="spin" /> : <Sparkles size={16} />}
              </button>
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
