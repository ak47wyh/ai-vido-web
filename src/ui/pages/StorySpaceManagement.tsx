import React, { useState } from 'react';
import { storySpaceService } from '../../dependencies';
import { Plus, Pencil, Trash2, Copy, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSpace } from '../contexts/SpaceContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useAllSpaces } from '../hooks/useSpaceScopedQuery';
import type { StorySpace } from '../../domain/entities/models';

export const StorySpaceManagement: React.FC = () => {
  const { t } = useTranslation();
  const spaces = useAllSpaces();
  const { currentSpaceId, setCurrentSpaceId } = useSpace();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

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
    showToast('success', t('space.createSuccess'));
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
    showToast('success', t('space.updateSuccess'));
    setEditingSpace(null);
  };

  const handleDelete = async (spaceId: string) => {
    const ok = await confirm({
      title: t('space.confirmDeleteTitle'),
      message: t('space.confirmDelete'),
      confirmLabel: t('space.deleteConfirmBtn'),
      danger: true
    });
    if (!ok) return;
    await storySpaceService.deleteSpace(spaceId);
    showToast('success', t('space.deleteSuccess'));
    if (currentSpaceId === spaceId) {
      setCurrentSpaceId(null);
    }
  };

  const handleCopyAll = async () => {
    if (!copySourceId || !copyTargetId) return;
    if (copySourceId === copyTargetId) return;
    const result = await storySpaceService.copyAllToSpace(copySourceId, copyTargetId);
    showToast('success', t('space.copyAllSuccess', { characters: result.characters, backgrounds: result.backgrounds, stories: result.stories }));
    setCopySourceId(null);
    setCopyTargetId('');
  };

  const [counts, setCounts] = useState<Record<string, { characters: number; backgrounds: number; stories: number }>>({});

  React.useEffect(() => {
    if (!spaces || spaces.length === 0) return;
    let cancelled = false;
    const loadCounts = async () => {
      const result: Record<string, { characters: number; backgrounds: number; stories: number }> = {};
      for (const space of spaces) {
        try {
          const stats = await storySpaceService.getSpaceStats(space.id);
          result[space.id] = stats;
        } catch {
          result[space.id] = { characters: 0, backgrounds: 0, stories: 0 };
        }
      }
      if (!cancelled) setCounts(result);
    };
    loadCounts();
    return () => { cancelled = true; };
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
        <form className="glass-panel" style={{ padding: '0.75rem', marginBottom: '0.75rem' }} onSubmit={handleCreate}>
          <h3 style={{ marginBottom: '0.75rem' }}>{t('space.createTitle')}</h3>
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
        <form className="glass-panel" style={{ padding: '0.75rem', marginBottom: '0.75rem' }} onSubmit={handleEditSave}>
          <h3 style={{ marginBottom: '0.75rem' }}>{t('space.editTitle')}</h3>
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

      {/* Copy dialog */}
      {copySourceId && (
        <div className="glass-panel" style={{ padding: '0.75rem', marginBottom: '0.75rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>{t('space.copyToSpace')}</h3>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
        {spaces?.map(space => (
          <div
            key={space.id}
            className="glass-panel"
            style={{
              padding: '0.75rem',
              position: 'relative',
              border: space.id === currentSpaceId ? '1px solid var(--primary-color)' : undefined,
            }}
          >
            <h3 style={{ marginBottom: '0.25rem', fontSize: '0.9rem' }}>{space.name}</h3>
            {space.description && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{space.description}</p>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              <span>{t('space.characterCount', { count: counts[space.id]?.characters ?? 0 })}</span>
              <span>{t('space.backgroundCount', { count: counts[space.id]?.backgrounds ?? 0 })}</span>
              <span>{t('space.storyCount', { count: counts[space.id]?.stories ?? 0 })}</span>
            </div>
            <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', display: 'flex', gap: '0.3rem' }}>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.3rem', border: 'none' }}
                onClick={() => { setCopySourceId(space.id); setCopyTargetId(''); }}
                title={t('space.copyAllBtn')}
              >
                <Copy size={16} />
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.3rem', border: 'none' }}
                onClick={() => openEdit(space)}
              >
                <Pencil size={16} />
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.3rem', border: 'none' }}
                onClick={() => handleDelete(space.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {spaces?.length === 0 && !isCreateOpen && (
          <div className="glass-panel" style={{
            padding: '2rem', textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem'
          }}>
            <Layers size={48} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>{t('space.empty')}</p>
            <button className="btn btn-primary" onClick={() => { resetCreateForm(); setIsCreateOpen(true); }}>
              <Plus size={16} /> {t('space.newBtn')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
