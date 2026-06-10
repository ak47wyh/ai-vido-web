import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../adapters/outbound/repositories/DexieDatabase';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const BackgroundManagement: React.FC = () => {
  const { t } = useTranslation();
  const backgrounds = useLiveQuery(() => db.backgrounds.toArray());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [environmentPrompt, setEnvironmentPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await db.backgrounds.put({
      id: uuidv4(),
      name,
      environmentPrompt,
      referenceImageUrl: imageUrl,
      createdAt: Date.now()
    });

    setName('');
    setEnvironmentPrompt('');
    setImageUrl('');
    setIsFormOpen(false);
  };

  const handleDelete = async (id: string) => {
    await db.backgrounds.delete(id);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('background.title')}</h1>
          <p>{t('background.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsFormOpen(!isFormOpen)}>
          <Plus size={18} /> {t('background.newBtn')}
        </button>
      </div>

      {isFormOpen && (
        <form className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }} onSubmit={handleSave}>
          <h3 style={{ marginBottom: '1.5rem' }}>{t('background.createTitle')}</h3>
          <div className="form-group">
            <label className="form-label">{t('background.nameLabel')}</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} required placeholder={t('background.namePlaceholder')} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('background.envLabel')}</label>
            <textarea className="form-textarea" value={environmentPrompt} onChange={e => setEnvironmentPrompt(e.target.value)} placeholder={t('background.envPlaceholder')} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('background.imageLabel')}</label>
            <input className="form-input" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder={t('background.imagePlaceholder')} />
          </div>
          <div className="flex gap-4">
            <button type="submit" className="btn btn-primary">{t('background.saveBtn')}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)}>{t('background.cancelBtn')}</button>
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
            <button 
              className="btn btn-secondary" 
              style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.4rem', border: 'none' }}
              onClick={() => handleDelete(bg.id)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {backgrounds?.length === 0 && !isFormOpen && (
          <p style={{ color: 'var(--text-muted)' }}>{t('background.empty')}</p>
        )}
      </div>
    </div>
  );
};
