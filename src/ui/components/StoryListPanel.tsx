import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Spline, Sparkles, Trash2, Pencil, RefreshCw, Wand2 } from 'lucide-react';
import type { Story } from '../../domain/entities/models';

interface StoryListPanelProps {
  stories: Story[] | undefined;
  selectedStoryId: string | null;
  isSplitting: boolean;
  isBreakingDown: boolean;
  refiningStoryText: boolean;
  onSwitchStory: (storyId: string | null) => void;
  onCreateStory: () => Promise<void>;
  onCreateAndBreakdown: () => Promise<void>;
  onQuickSplit: (storyId: string) => Promise<void>;
  onDeleteStory: (storyId: string) => Promise<void>;
  onRefineStoryText: (text: string) => Promise<string>;
  onSaveStory: (storyId: string, title: string, originalText: string) => Promise<void>;
}

export const StoryListPanel: React.FC<StoryListPanelProps> = ({
  stories, selectedStoryId, isSplitting, isBreakingDown, refiningStoryText,
  onSwitchStory, onCreateStory, onCreateAndBreakdown, onQuickSplit, onDeleteStory, onRefineStoryText, onSaveStory,
}) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editOriginalText, setEditOriginalText] = useState('');

  const handleCreate = async () => {
    await onCreateStory();
    setTitle('');
    setOriginalText('');
  };

  const handleCreateAndBreakdown = async () => {
    await onCreateAndBreakdown();
    setTitle('');
    setOriginalText('');
  };

  const handleRefineText = async () => {
    if (!originalText.trim()) return;
    const refined = await onRefineStoryText(originalText);
    setOriginalText(refined);
  };

  const openEditStory = (story: Story) => {
    setEditingStoryId(story.id);
    setEditTitle(story.title);
    setEditOriginalText(story.originalText);
  };

  const handleSaveEdit = async () => {
    if (!editingStoryId || !editTitle.trim()) return;
    await onSaveStory(editingStoryId, editTitle.trim(), editOriginalText.trim());
    setEditingStoryId(null);
  };

  return (
    <div style={{ flex: '1 1 320px', maxWidth: '400px', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3>{t('workbench.newStory')}</h3>
        <div className="form-group" style={{ marginTop: '1rem' }}>
          <input className="form-input" placeholder={t('workbench.storyTitlePlaceholder')} value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="form-group">
          <textarea className="form-textarea" placeholder={t('workbench.storyContentPlaceholder')} value={originalText} onChange={e => setOriginalText(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <button
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#a78bfa' }}
            disabled={refiningStoryText || !originalText.trim()}
            onClick={handleRefineText}
          >
            {refiningStoryText ? <RefreshCw size={14} className="spin" /> : <Wand2 size={14} />}
            {refiningStoryText ? t('textAI.refiningText') : t('textAI.refineText')}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={handleCreateAndBreakdown}
            disabled={isBreakingDown || !title || !originalText}
          >
            {isBreakingDown ? t('workbench.breakingDown') : <><Sparkles size={16} /> {t('workbench.breakdownBtn')}</>}
          </button>
          <button
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={handleCreate}
            disabled={isSplitting || !title || !originalText}
          >
            {isSplitting ? t('workbench.splitting') : <><Spline size={16} /> {t('workbench.splitBtn')}</>}
          </button>
        </div>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: 1.4 }}>
          {t('workbench.breakdownTip')}
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
        <h3>{t('workbench.yourStories')}</h3>
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {stories?.map(s => (
            <div key={s.id}>
              {editingStoryId === s.id ? (
                <div className="glass-panel" style={{ padding: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <input className="form-input" value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder={t('workbench.storyTitlePlaceholder')} />
                  </div>
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <textarea className="form-textarea" value={editOriginalText} onChange={e => setEditOriginalText(e.target.value)} placeholder={t('workbench.storyContentPlaceholder')} style={{ minHeight: '80px' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }} onClick={handleSaveEdit}>{t('workbench.saveEditBtn')}</button>
                    <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }} onClick={() => setEditingStoryId(null)}>{t('workbench.cancelBtn')}</button>
                  </div>
                </div>
              ) : (
                <div
                  className="glass-panel interactive story-card"
                  style={{
                    padding: '1rem', cursor: 'pointer',
                    borderColor: selectedStoryId === s.id ? 'var(--primary-color)' : 'var(--border-color)',
                    background: selectedStoryId === s.id ? 'var(--bg-panel-hover)' : 'var(--bg-panel)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}
                  onClick={() => onSwitchStory(s.id)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span style={{
                        display: 'inline-block', padding: '0.1rem 0.5rem', borderRadius: '999px',
                        fontSize: '0.7rem', fontWeight: 600,
                        background: s.status === 'SPLIT' ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)',
                        color: s.status === 'SPLIT' ? '#34d399' : '#fbbf24',
                      }}>
                        {s.status === 'SPLIT' ? t('workbench.statusSplit') : t('workbench.statusDraft')}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                    {s.status === 'DRAFT' && (
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem', border: 'none' }}
                        onClick={(e) => { e.stopPropagation(); onQuickSplit(s.id); }}
                        title={t('workbench.splitBtn')}
                      >
                        <Spline size={14} />
                      </button>
                    )}
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.3rem', border: 'none' }}
                      onClick={(e) => { e.stopPropagation(); openEditStory(s); }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.3rem', border: 'none' }}
                      onClick={(e) => { e.stopPropagation(); onDeleteStory(s.id); }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {stories?.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
              <BookOpen size={36} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
              <p style={{ fontSize: '0.85rem' }}>{t('workbench.noStoriesHint')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};