import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../adapters/outbound/repositories/DexieDatabase';
import { storyService, videoGenerationService } from '../../dependencies';
import { Play, Spline } from 'lucide-react';
import type { StorySegment } from '../../domain/entities/models';
import { useTranslation } from 'react-i18next';

export const StoryWorkbench: React.FC = () => {
  const { t } = useTranslation();
  const stories = useLiveQuery(() => db.stories.toArray());
  const backgrounds = useLiveQuery(() => db.backgrounds.toArray());
  const videoTasks = useLiveQuery(() => db.videoTasks.toArray());
  
  const [title, setTitle] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [segments, setSegments] = useState<StorySegment[]>([]);
  const [isSplitting, setIsSplitting] = useState(false);

  // Auto-load segments when a story is selected
  useEffect(() => {
    if (selectedStoryId) {
      loadSegments(selectedStoryId);
    } else {
      setSegments([]);
    }
  }, [selectedStoryId]);

  const loadSegments = async (storyId: string) => {
    const segs = await storyService.getSegments(storyId);
    setSegments(segs);
  };

  const handleCreateAndSplit = async () => {
    if (!title || !originalText) return;
    setIsSplitting(true);
    try {
      const story = await storyService.createStory(title, originalText);
      setSelectedStoryId(story.id);
      await storyService.splitStory(story.id);
      await loadSegments(story.id);
      setTitle('');
      setOriginalText('');
    } catch (e) {
      console.error(e);
      alert(t('workbench.splitFailed'));
    } finally {
      setIsSplitting(false);
    }
  };

  const handleSelectBackground = async (segmentId: string, bgId: string) => {
    if (!selectedStoryId) return;
    await storyService.updateSegmentBackground(segmentId, bgId, selectedStoryId);
    await loadSegments(selectedStoryId); // reload
  };

  const handleGenerateVideo = async (segmentId: string) => {
    if (!selectedStoryId) return;
    try {
      await videoGenerationService.generateVideo(segmentId, selectedStoryId, 'MINIMAX');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const getTaskForSegment = (segmentId: string) => {
    return videoTasks?.find(t => t.segmentId === segmentId);
  };

  return (
    <div style={{ display: 'flex', gap: '2rem', height: '100%' }}>
      {/* Left panel: Stories list & creation */}
      <div style={{ flex: '0 0 350px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3>{t('workbench.newStory')}</h3>
          <div className="form-group" style={{ marginTop: '1rem' }}>
            <input className="form-input" placeholder={t('workbench.storyTitlePlaceholder')} value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="form-group">
            <textarea className="form-textarea" placeholder={t('workbench.storyContentPlaceholder')} value={originalText} onChange={e => setOriginalText(e.target.value)} />
          </div>
          <button className="btn btn-primary w-full" onClick={handleCreateAndSplit} disabled={isSplitting || !title || !originalText}>
            {isSplitting ? t('workbench.splitting') : <><Spline size={16} /> {t('workbench.splitBtn')}</>}
          </button>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
          <h3>{t('workbench.yourStories')}</h3>
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {stories?.map(s => (
              <div 
                key={s.id} 
                className="glass-panel" 
                style={{ 
                  padding: '1rem', 
                  cursor: 'pointer', 
                  borderColor: selectedStoryId === s.id ? 'var(--primary-color)' : 'var(--border-color)',
                  background: selectedStoryId === s.id ? 'var(--bg-panel-hover)' : 'var(--bg-panel)'
                }}
                onClick={() => setSelectedStoryId(s.id)}
              >
                <div style={{ fontWeight: 600 }}>{s.title}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('workbench.status')}: {s.status}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel: Segments and Video Generation */}
      <div className="glass-panel" style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div className="page-header" style={{ marginBottom: '1.5rem' }}>
          <h2>{t('workbench.segmentsTitle')}</h2>
        </div>
        
        {!selectedStoryId ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>{t('workbench.selectStory')}</p>
        ) : segments.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>{t('workbench.noSegments')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {segments.map((seg, idx) => {
              const task = getTaskForSegment(seg.id);
              
              return (
                <div key={seg.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem' }}>
                  <div style={{ flex: '0 0 60px', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                    #{idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ marginBottom: '1rem', lineHeight: 1.6 }}>{seg.content}</p>
                    
                    <div className="flex gap-4 items-center">
                      <select 
                        className="form-select" 
                        style={{ width: '200px' }}
                        value={seg.selectedBackgroundId || ''}
                        onChange={(e) => handleSelectBackground(seg.id, e.target.value)}
                      >
                        <option value="">{t('workbench.selectBg')}</option>
                        {backgrounds?.map(bg => (
                          <option key={bg.id} value={bg.id}>{bg.name}</option>
                        ))}
                      </select>
                      
                      <button 
                        className="btn btn-primary"
                        disabled={!seg.selectedBackgroundId || task?.status === 'PROCESSING'}
                        onClick={() => handleGenerateVideo(seg.id)}
                      >
                        <Play size={16} /> 
                        {task?.status === 'PROCESSING' ? t('workbench.generating') : t('workbench.generateBtn')}
                      </button>

                      {task && (
                        <div style={{ 
                          fontSize: '0.875rem', 
                          color: task.status === 'SUCCESS' ? 'lightgreen' : task.status === 'FAILED' ? 'lightcoral' : 'orange' 
                        }}>
                          {t('workbench.status')}: {task.status}
                        </div>
                      )}
                    </div>
                    
                    {task?.status === 'SUCCESS' && task.videoUrl && (
                      <div style={{ marginTop: '1.5rem' }}>
                        <video src={task.videoUrl} controls style={{ width: '100%', maxHeight: '300px', borderRadius: 'var(--radius-md)' }} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
