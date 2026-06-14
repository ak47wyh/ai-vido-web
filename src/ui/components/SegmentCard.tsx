import React from 'react';
import { useTranslation } from 'react-i18next';
import { Play, RefreshCw, Users, Download, Volume2, Music, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { StorySegment, Character, VideoTask, Background } from '../../domain/entities/models';
import { BGMPanel } from './BGMPanel';

interface SegmentCardProps {
  segment: StorySegment;
  index: number;
  task: VideoTask | undefined;
  characterMap: Map<string, Character>;
  backgrounds: Background[] | undefined;
  narrationStatus: string | undefined;
  narrationUrl: string | undefined;
  isBGMEditing: boolean;
  bgmPrompt: string;
  bgmMode: 'instrumental' | 'autoLyrics' | 'customLyrics' | 'cover';
  bgmLyrics: string;
  bgmModel: 'music-2.6' | 'music-2.6-free' | 'music-cover' | 'music-cover-free';
  bgmCoverAudioUrl: string;
  isGeneratingBGM: boolean;
  isGeneratingLyrics: boolean;
  suggestingBGMStyle: boolean;
  onSelectBackground: (segmentId: string, bgId: string) => Promise<void>;
  onGenerateVideo: (segmentId: string) => Promise<void>;
  onGenerateNarration: (segmentId: string, content: string, characterIds: string[]) => Promise<void>;
  onRemoveBGM: (segmentId: string) => Promise<void>;
  onBGMEditStart: () => void;
  onBGMEditCancel: () => void;
  onBgmPromptChange: (value: string) => void;
  onBgmModeChange: (mode: 'instrumental' | 'autoLyrics' | 'customLyrics' | 'cover') => void;
  onBgmModelChange: (model: 'music-2.6' | 'music-2.6-free' | 'music-cover' | 'music-cover-free') => void;
  onBgmLyricsChange: (lyrics: string) => void;
  onBgmCoverAudioUrlChange: (url: string) => void;
  onGenerateBGM: () => void;
  onGenerateLyrics: () => void;
  onSuggestBGMStyle: (segmentContent: string) => Promise<void>;
}

const getStatusColor = (status: VideoTask['status']) => {
  switch (status) {
    case 'SUCCESS': return '#34d399';
    case 'FAILED': return '#f87171';
    case 'PROCESSING': return '#fbbf24';
    case 'PENDING': return '#9ca3af';
  }
};

const getStatusLabel = (status: VideoTask['status'], t: (key: string) => string) => {
  switch (status) {
    case 'SUCCESS': return t('workbench.statusSuccess');
    case 'FAILED': return t('workbench.statusFailed');
    case 'PROCESSING': return t('workbench.statusProcessing');
    case 'PENDING': return t('workbench.statusPending');
  }
};

export const SegmentCard: React.FC<SegmentCardProps> = ({
  segment, index, task, characterMap, backgrounds,
  narrationStatus, narrationUrl,
  isBGMEditing, bgmPrompt, bgmMode, bgmLyrics, bgmModel, bgmCoverAudioUrl,
  isGeneratingBGM, isGeneratingLyrics, suggestingBGMStyle,
  onSelectBackground, onGenerateVideo, onGenerateNarration, onRemoveBGM,
  onBGMEditStart, onBGMEditCancel,
  onBgmPromptChange, onBgmModeChange, onBgmModelChange,
  onBgmLyricsChange, onBgmCoverAudioUrlChange,
  onGenerateBGM, onGenerateLyrics, onSuggestBGMStyle,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const mentionedCharNames = segment.mentionedCharacters
    .map(id => characterMap.get(id)?.name)
    .filter((name): name is string => !!name);

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem' }}>
      <div style={{ flex: '0 0 60px', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
        #{index + 1}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ marginBottom: '1rem', lineHeight: 1.6 }}>{segment.content}</p>

        {mentionedCharNames.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {mentionedCharNames.map(name => (
              <span key={name} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.2rem 0.6rem', borderRadius: '999px',
                fontSize: '0.75rem', fontWeight: 500,
                background: 'rgba(99,102,241,0.15)', color: '#818cf8',
                border: '1px solid rgba(99,102,241,0.25)',
                cursor: 'pointer', transition: 'all 0.15s'
              }} onClick={() => navigate('/characters')} title={t('workbench.goCharacters')}>
                <Users size={12} /> {name}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-4 items-center flex-wrap">
          <select className="form-select" style={{ width: '200px' }}
            value={segment.selectedBackgroundId || ''}
            onChange={(e) => onSelectBackground(segment.id, e.target.value)}>
            <option value="">{t('workbench.selectBg')}</option>
            {backgrounds?.map(bg => (
              <option key={bg.id} value={bg.id}>{bg.name}</option>
            ))}
          </select>

          <button
            className="btn btn-primary"
            disabled={!segment.selectedBackgroundId || task?.status === 'PROCESSING' || task?.status === 'PENDING'}
            onClick={() => onGenerateVideo(segment.id)}
          >
            <Play size={16} />
            {task?.status === 'PROCESSING' || task?.status === 'PENDING'
              ? t('workbench.generating')
              : t('workbench.generateBtn')}
          </button>

          {task?.status === 'FAILED' && (
            <button className="btn btn-secondary" disabled={!segment.selectedBackgroundId}
              onClick={() => onGenerateVideo(segment.id)}>
              <RefreshCw size={16} /> {t('workbench.retryBtn')}
            </button>
          )}

          {task && (
            <div style={{ fontSize: '0.875rem', color: getStatusColor(task.status), display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%', background: getStatusColor(task.status),
                animation: task.status === 'PROCESSING' || task.status === 'PENDING' ? 'pulse 1.5s ease-in-out infinite' : 'none'
              }} />
              {getStatusLabel(task.status, t)}
            </div>
          )}
        </div>

        {task?.status === 'FAILED' && task.errorMessage && (
          <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#f87171' }}>
            {task.errorMessage}
          </p>
        )}

        {task?.status === 'SUCCESS' && task.videoUrl && (
          <div style={{ marginTop: '1.5rem' }}>
            <video src={task.videoUrl} controls style={{ width: '100%', maxHeight: '300px', borderRadius: 'var(--radius-md)' }} />
            <a href={task.videoUrl} download target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--primary-color)', textDecoration: 'none' }}>
              <Download size={14} /> {t('workbench.downloadVideo')}
            </a>
          </div>
        )}

        <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          disabled={narrationStatus === 'running'}
          onClick={() => onGenerateNarration(segment.id, segment.content, segment.mentionedCharacters)}>
          {narrationStatus === 'running' ? <RefreshCw size={14} className="spin" /> : <Volume2 size={14} />}
          {narrationStatus === 'running' ? t('character.generatingNarration') : t('character.generateNarration')}
        </button>
        {narrationUrl && (
          <audio controls style={{ width: '100%', marginTop: '0.5rem', height: '32px' }} src={narrationUrl} />
        )}

        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Music size={14} style={{ color: '#f472b6' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f472b6' }}>{t('music.title')}</span>
          </div>

          {segment.bgmAudioUrl ? (
            <div>
              <audio controls style={{ width: '100%', height: '32px' }} src={segment.bgmAudioUrl} />
              {segment.bgmPrompt && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  {segment.bgmIsInstrumental ? '\uD83C\uDFB5' : '\uD83C\uDFA4'} {segment.bgmPrompt}
                </span>
              )}
              <button className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', marginTop: '0.3rem', color: '#f87171' }}
                onClick={() => onRemoveBGM(segment.id)}>
                <Trash2 size={12} /> {t('music.removeBGMBtn')}
              </button>
            </div>
          ) : isBGMEditing ? (
            <BGMPanel
              bgmPrompt={bgmPrompt}
              bgmMode={bgmMode}
              bgmLyrics={bgmLyrics}
              bgmModel={bgmModel}
              bgmCoverAudioUrl={bgmCoverAudioUrl}
              isGeneratingBGM={isGeneratingBGM}
              isGeneratingLyrics={isGeneratingLyrics}
              suggestingBGMStyle={suggestingBGMStyle}
              onBgmPromptChange={onBgmPromptChange}
              onBgmModeChange={onBgmModeChange}
              onBgmModelChange={onBgmModelChange}
              onBgmLyricsChange={onBgmLyricsChange}
              onBgmCoverAudioUrlChange={onBgmCoverAudioUrlChange}
              onGenerateBGM={onGenerateBGM}
              onGenerateLyrics={onGenerateLyrics}
              onSuggestStyle={() => onSuggestBGMStyle(segment.content)}
              onCancel={onBGMEditCancel}
            />
          ) : (
            <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              onClick={onBGMEditStart}>
              <Music size={14} /> {t('music.generateBGM')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};