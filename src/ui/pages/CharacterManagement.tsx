import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../adapters/outbound/repositories/DexieDatabase';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const CharacterManagement: React.FC = () => {
  const { t } = useTranslation();
  const characters = useLiveQuery(() => db.characters.toArray());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [appearance, setAppearance] = useState('');
  const [personality, setPersonality] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await db.characters.put({
      id: uuidv4(),
      name,
      appearancePrompt: appearance,
      personalityPrompt: personality,
      referenceImageUrl: imageUrl,
      createdAt: Date.now()
    });

    setName('');
    setAppearance('');
    setPersonality('');
    setImageUrl('');
    setIsFormOpen(false);
  };

  const handleDelete = async (id: string) => {
    await db.characters.delete(id);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t('character.title')}</h1>
          <p>{t('character.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsFormOpen(!isFormOpen)}>
          <Plus size={18} /> {t('character.newBtn')}
        </button>
      </div>

      {isFormOpen && (
        <form className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }} onSubmit={handleSave}>
          <h3 style={{ marginBottom: '1.5rem' }}>{t('character.createTitle')}</h3>
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
            <label className="form-label">{t('character.imageLabel')}</label>
            <input className="form-input" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder={t('character.imagePlaceholder')} />
          </div>
          <div className="flex gap-4">
            <button type="submit" className="btn btn-primary">{t('character.saveBtn')}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)}>{t('character.cancelBtn')}</button>
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
            <button 
              className="btn btn-secondary" 
              style={{ position: 'absolute', top: '1rem', right: '1rem', padding: '0.4rem', border: 'none' }}
              onClick={() => handleDelete(char.id)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {characters?.length === 0 && !isFormOpen && (
          <p style={{ color: 'var(--text-muted)' }}>{t('character.empty')}</p>
        )}
      </div>
    </div>
  );
};
