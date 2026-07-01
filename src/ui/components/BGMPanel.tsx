import React from 'react';
import { useTranslation } from 'react-i18next';
import { Music, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import { InputWithCounter } from './InputWithCounter';
import { TextAreaWithCounter } from './TextAreaWithCounter';
import { TEXT_LIMITS } from '../../domain/constants/textLimits';

interface BGMPanelProps {
  bgmPrompt: string;
  bgmMode: 'instrumental' | 'autoLyrics' | 'customLyrics' | 'cover';
  bgmLyrics: string;
  bgmModel: 'music-2.6' | 'music-2.6-free' | 'music-cover' | 'music-cover-free';
  bgmCoverAudioUrl: string;
  isGeneratingBGM: boolean;
  isGeneratingLyrics: boolean;
  suggestingBGMStyle: boolean;
  onBgmPromptChange: (value: string) => void;
  onBgmModeChange: (mode: 'instrumental' | 'autoLyrics' | 'customLyrics' | 'cover') => void;
  onBgmModelChange: (model: 'music-2.6' | 'music-2.6-free' | 'music-cover' | 'music-cover-free') => void;
  onBgmLyricsChange: (lyrics: string) => void;
  onBgmCoverAudioUrlChange: (url: string) => void;
  onGenerateBGM: () => void;
  onGenerateLyrics: () => void;
  onSuggestStyle: () => void;
  onCancel: () => void;
}

const bgmStylePresets = [
  { key: 'cinematic', prompt: 'Cinematic, Epic, Orchestral, Grand, Sweeping' },
  { key: 'lighthearted', prompt: 'Lighthearted, Acoustic, Pop, Warm, Gentle' },
  { key: 'suspense', prompt: 'Suspense, Dark, Thriller, Tension, Mysterious' },
  { key: 'melancholic', prompt: 'Melancholic, Piano, Emotional, Sad, Reflective' },
  { key: 'upbeat', prompt: 'Upbeat, Funky, Dance, Energetic, Joyful' },
];

export const BGMPanel: React.FC<BGMPanelProps> = ({
  bgmPrompt, bgmMode, bgmLyrics, bgmModel, bgmCoverAudioUrl,
  isGeneratingBGM, isGeneratingLyrics, suggestingBGMStyle,
  onBgmPromptChange, onBgmModeChange, onBgmModelChange,
  onBgmLyricsChange, onBgmCoverAudioUrlChange,
  onGenerateBGM, onGenerateLyrics, onSuggestStyle, onCancel,
}) => {
  const { t } = useTranslation();

  const modeKey = (mode: string) => mode.charAt(0).toUpperCase() + mode.slice(1);

  return (
    <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(244,114,182,0.08)', border: '1px solid rgba(244,114,182,0.2)' }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        {(['instrumental', 'autoLyrics', 'customLyrics', 'cover'] as const).map(mode => (
          <button key={mode} className="btn btn-secondary" style={{
            fontSize: '0.7rem', padding: '0.2rem 0.5rem',
            background: bgmMode === mode ? 'rgba(244,114,182,0.2)' : undefined,
            borderColor: bgmMode === mode ? '#f472b6' : undefined,
            color: bgmMode === mode ? '#f472b6' : undefined,
          }} onClick={() => {
            onBgmModeChange(mode);
            if (mode === 'cover') onBgmModelChange('music-cover');
            else onBgmModelChange('music-2.6');
          }}>
            {t(`music.mode${modeKey(mode)}`)}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('music.modelLabel')}</span>
        <select className="form-select" style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem', width: 'auto' }}
          value={bgmModel} onChange={e => onBgmModelChange(e.target.value as typeof bgmModel)}>
          {bgmMode !== 'cover' && (
            <>
              <option value="music-2.6">music-2.6</option>
              <option value="music-2.6-free">music-2.6-free</option>
            </>
          )}
          {bgmMode === 'cover' && (
            <>
              <option value="music-cover">music-cover</option>
              <option value="music-cover-free">music-cover-free</option>
            </>
          )}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        {bgmStylePresets.map(preset => (
          <button key={preset.key} className="btn btn-secondary" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}
            onClick={() => onBgmPromptChange(preset.prompt)}>
            {t(`music.style${modeKey(preset.key)}`)}
          </button>
        ))}
        <button className="btn btn-secondary" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#f472b6' }}
          disabled={suggestingBGMStyle} onClick={onSuggestStyle}>
          {suggestingBGMStyle ? <RefreshCw size={10} className="spin" /> : <Wand2 size={10} />}
          {suggestingBGMStyle ? t('textAI.suggestingBGMStyle') : t('textAI.suggestBGMStyle')}
        </button>
      </div>

      <InputWithCounter className="form-input" style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', width: '100%', marginBottom: '0.5rem' }}
        value={bgmPrompt} onChange={e => onBgmPromptChange(e.target.value)}
        placeholder={t('music.promptPlaceholder')}
        maxLength={TEXT_LIMITS.BGM_PROMPT_MAX} />

      {bgmMode !== 'instrumental' && (
        <div style={{ marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.3rem' }}>
            {bgmMode === 'autoLyrics' && (
              <button className="btn btn-secondary" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                disabled={isGeneratingLyrics || !bgmPrompt.trim()} onClick={onGenerateLyrics}>
                {isGeneratingLyrics ? <RefreshCw size={10} className="spin" /> : <Sparkles size={10} />}
                {isGeneratingLyrics ? t('music.generatingLyrics') : t('music.generateLyricsBtn')}
              </button>
            )}
          </div>
          <TextAreaWithCounter className="form-textarea" style={{ fontSize: '0.7rem', padding: '0.3rem 0.5rem', minHeight: '60px', width: '100%' }}
            value={bgmLyrics} onChange={e => onBgmLyricsChange(e.target.value)}
            placeholder={t('music.lyricsPlaceholder')}
            maxLength={TEXT_LIMITS.BGM_LYRICS_MAX} />
        </div>
      )}

      {bgmMode === 'cover' && (
        <div style={{ marginBottom: '0.5rem' }}>
          <InputWithCounter className="form-input" style={{ fontSize: '0.7rem', padding: '0.3rem 0.5rem', width: '100%' }} type="url"
            value={bgmCoverAudioUrl} onChange={e => onBgmCoverAudioUrlChange(e.target.value)}
            placeholder={t('music.coverAudioPlaceholder')}
            maxLength={TEXT_LIMITS.URL_MAX} />
          <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{t('music.coverAudioHint')}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button className="btn btn-primary" style={{ fontSize: '0.7rem', padding: '0.3rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'linear-gradient(135deg, #f472b6, #ec4899)' }}
          disabled={isGeneratingBGM || !bgmPrompt.trim()} onClick={onGenerateBGM}>
          {isGeneratingBGM ? <RefreshCw size={12} className="spin" /> : <Music size={12} />}
          {isGeneratingBGM ? t('music.generatingBGM') : t('music.generateBGM')}
        </button>
        <button className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.3rem 0.5rem' }} onClick={onCancel}>
          {t('workbench.cancelBtn')}
        </button>
      </div>
    </div>
  );
};