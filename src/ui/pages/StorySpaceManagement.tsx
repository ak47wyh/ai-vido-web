import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../adapters/outbound/repositories/DexieDatabase';
import { storySpaceService } from '../../dependencies';
import { Plus, Pencil, Trash2, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSpace } from '../contexts/SpaceContext';
import type { StorySpace } from '../../domain/entities/models';

export const StorySpaceManagement: React.FC = () => {
  const { t } = useTranslation();
  const spaces = useLiveQuery(() => db.storySpaces.toArray());
  const { currentSpaceId, setCurrentSpaceId } = useSpace();

  // Create form state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // Edit form state
  const [editingSpace, setEditingSpace] = useState<StorySpace | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Copy state
  const [copySourceId, setCopySourceId] = useState<string | null>(null);
  const [copyTargetId, setCopyTargetId] = useState<string>('');
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const resetCreateForm = () => {
    setNewName('');
    setNewDesc('');
    setIsCreateOpen(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const space = await storySpaceService.createSpace(newName.trim(), newDesc.trim());
    setCurrentSpaceId(space.id);
    resetCreateForm();
  };

  const openEdit = (space: StorySpace) => {
    setEditingSpace(space);
    setEditName(space.name);
    setEditDesc(space.description);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSpace || !editName.trim()) return;
    await storySpaceService.updateSpace({
      ...editingSpace,
      name: editName.trim(),
      description: editDesc.trim(),
    });
    setEditingSpace(null);
  };

  const handleDelete = async (spaceId: string) => {
    if (!window.confirm(t('space.confirmDelete'))) return;
    await storySpaceService.deleteSpace(spaceId);
    if (currentSpaceId === spaceId) {
      setCurrentSpaceId(null);
    }
  };

  const handleCopyAll = async () => {
    if (!copySourceId || !copyTargetId) return;
    if (copySourceId === copyTargetId) return;
    const result = await storySpaceService.copyAllToSpace(copySourceId, copyTargetId);
    setCopyMessage(t('space.copyAllSuccess', { characters: result.characters, backgrounds: result.backgrounds }));
    setCopySourceId(null);
    setCopyTargetId('');
    setTimeout(() => setCopyMessage(null), 3000);
  };

  const characterCounts = useLiveQuery(async () => {
    if (!spaces) return {};
    const counts: Record<string, number> = {};
    for (const space of spaces) {
      counts[space.id] = await db.characters.where('spaceId').equals(space.id).count();
    }
    return counts;
  }, [spaces]);

  const backgroundCounts = useLiveQuery(async () => {
    if (!spaces) return {};
    const counts: Record<string, number> = {};
    for (const space of spaces) {
      counts[space.id] = await db.backgrounds.where('spaceId').equals(space.id).count();
    }
    return counts;
  }, [spaces]);

  const storyCounts = useLiveQuery(async () => {
    if (!spaces) return {};
    const counts: Record<string, number> = {};
    for (const space of spaces) {
      counts[space.id] = await db.stories.where('spaceId').equals(space.id).count();
    }
    return counts;
  }, [spaces]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('space.title')}</h1>
          <p>{t('space.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetCreateForm(); setIsCreateOpen(true); }}>
          <Plus size={18} /> {t('space.newBtn')}
        </button>
      </div>

      {/* Create form */}
      {isCreateOpen && (
        <form className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }} onSubmit={handleCreate}>
          <h3 style={{ marginBottom: '1.5rem' }}>{t('space.createTitle')}</h3>
          <div className="form-group">
            <label className="form-label">{t('space.nameLabel')}</label>
            <input className="form-input" value={newName} onChange={e => setNewName(e.target.value)} required placeholder={t('space.namePlaceholder')} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('space.descLabel')}</label>
            <textarea className="form-textarea" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder={t('space.descPlaceholder')} />
          </div>
          <div className="flex gap-4">
            <button type="submit" className="btn btn-primary">{t('space.saveBtn')}</button>
            <button type="button" className="btn btn-secondary" onClick={resetCreateForm}>{t('space.cancelBtn')}</button>
          </div>
        </form>
      )}

      {/* Edit form */}
      {editingSpace && (
        <form className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }} onSubmit={handleEditSave}>
          <h3 style={{ marginBottom: '1.5rem' }}>{t('space.createTitle')}</h3>
          <div className="form-group">
            <label className="form-label">{t('space.nameLabel')}</label>
            <input className="form-input" value={editName} onChange={e => setEditName(e.target.value)} required placeholder={t('space.namePlaceholder')} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('space.descLabel')}</label>
            <textarea className="form-textarea" value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder={t('space.descPlaceholder')} />
          </div>
          <div className="flex gap-4">
            <button type="submit" className="btn btn-primary">{t('space.saveBtn')}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setEditingSpace(null)}>{t('space.cancelBtn')}</button>
          </div>
        </form>
      )}

      {/* Copy success message */}
      {copyMessage && (
        <div className="glass-panel" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem', color: '#34d399', fontWeight: 600 }}>
          {copyMessage}
        </div>
      )}

      {/* Copy dialog */}
      {copySourceId && (
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>{t('space.copyToSpace')}</h3>
          <div className="form-group">
            <label className="form-label">{t('space.selectTargetSpace')}</label>
            <select className="form-select" value={copyTargetId} onChange={e => setCopyTargetId(e.target.value)}>
              <option value="">--</option>
              {spaces?.filter(s => s.id !== copySourceId).map(space => (
                <option key={space.id} value={space.id}>{space.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-4">
            <button className="btn btn-primary" onClick={handleCopyAll} disabled={!copyTargetId}>
              <Copy size={18} /> {t('space.copyAllBtn')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => { setCopySourceId(null); setCopyTargetId(''); }}>
              {t('space.cancelBtn')}
            </button>
          </div>
        </div>
      )}

      {/* Space list */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {spaces?.map(space => (
          <div
            key={space.id}
            className="glass-panel"
            style={{
              padding: '1.5rem',
              position: 'relative',
              border: space.id === currentSpaceId ? '1px solid var(--primary-color)' : undefined,
            }}
          >
            <h3 style={{ marginBottom: '0.5rem' }}>{space.name}</h3>
            {space.description && (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{space.description}</p>
            )}
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              <span>{t('space.characterCount', { count: characterCounts?.[space.id] ?? 0 })}</span>
              <span>{t('space.backgroundCount', { count: backgroundCounts?.[space.id] ?? 0 })}</span>
              <span>{t('space.storyCount', { count: storyCounts?.[space.id] ?? 0 })}</span>
            </div>
            <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.4rem', border: 'none' }}
                onClick={() => { setCopySourceId(space.id); setCopyTargetId(''); }}
                title={t('space.copyAllBtn')}
              >
                <Copy size={16} />
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.4rem', border: 'none' }}
                onClick={() => openEdit(space)}
              >
                <Pencil size={16} />
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.4rem', border: 'none' }}
                onClick={() => handleDelete(space.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {spaces?.length === 0 && !isCreateOpen && (
          <p style={{ color: 'var(--text-muted)' }}>{t('space.empty')}</p>
        )}
      </div>
    </div>
  );
};
