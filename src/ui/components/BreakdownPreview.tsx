import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Users, ImagePlus, Check, CheckCircle2, Trash2, RefreshCw, Wand2 } from 'lucide-react';
import type { CharacterDraft, BackgroundDraft, ImageGenerationContext } from '../../domain/ports/OutboundPorts';
import { InputWithCounter } from './InputWithCounter';
import { TextAreaWithCounter } from './TextAreaWithCounter';
import { TEXT_LIMITS } from '../../domain/constants/textLimits';

interface BreakdownPreviewProps {
  draftCharacters: CharacterDraft[];
  draftBackgrounds: BackgroundDraft[];
  confirmedCharIndices: Set<number>;
  confirmedBgIndices: Set<number>;
  generatingDraftCharImageIndices: Set<number>;
  generatingDraftBgImageIndices: Set<number>;
  refiningDraftCharField: { index: number; field: string } | null;
  refiningDraftBgField: { index: number; field: string } | null;
  isApplyingBreakdown: boolean;
  onUpdateDraftCharacter: (index: number, field: keyof CharacterDraft, value: string) => void;
  onRemoveDraftCharacter: (index: number) => void;
  onToggleConfirmChar: (index: number) => void;
  onToggleConfirmAllChars: () => void;
  onUpdateDraftBackground: (index: number, field: keyof BackgroundDraft, value: string) => void;
  onRemoveDraftBackground: (index: number) => void;
  onToggleConfirmBg: (index: number) => void;
  onToggleConfirmAllBgs: () => void;
  onGenerateCharImage: (index: number, context: ImageGenerationContext) => Promise<void>;
  onGenerateBgImage: (index: number, context: ImageGenerationContext) => Promise<void>;
  onRefineCharAppearance: (index: number, prompt: string) => Promise<void>;
  onRefineCharPersonality: (index: number, prompt: string) => Promise<void>;
  onRefineBackground: (index: number, prompt: string) => Promise<void>;
  onApplyBreakdown: () => Promise<void>;
  onCloseBreakdownPreview: () => Promise<void>;
}

export const BreakdownPreview: React.FC<BreakdownPreviewProps> = ({
  draftCharacters, draftBackgrounds,
  confirmedCharIndices, confirmedBgIndices,
  generatingDraftCharImageIndices, generatingDraftBgImageIndices,
  refiningDraftCharField, refiningDraftBgField,
  isApplyingBreakdown,
  onUpdateDraftCharacter, onRemoveDraftCharacter,
  onToggleConfirmChar, onToggleConfirmAllChars,
  onUpdateDraftBackground, onRemoveDraftBackground,
  onToggleConfirmBg, onToggleConfirmAllBgs,
  onGenerateCharImage, onGenerateBgImage,
  onRefineCharAppearance, onRefineCharPersonality, onRefineBackground,
  onApplyBreakdown, onCloseBreakdownPreview,
}) => {
  const { t } = useTranslation();

  return (
    <div style={{
      marginBottom: '1.5rem', padding: '1.5rem', borderRadius: 'var(--radius-lg)',
      background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(236,72,153,0.1))',
      border: '1px solid rgba(99,102,241,0.25)',
      animation: 'fadeIn 0.3s ease'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#a78bfa' }}>
          <Sparkles size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
          {t('workbench.breakdownResult')}
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-primary"
            style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', background: 'linear-gradient(135deg, #6366f1, #ec4899)' }}
            onClick={onApplyBreakdown}
            disabled={isApplyingBreakdown || (confirmedCharIndices.size === 0 && confirmedBgIndices.size === 0)}
          >
            {isApplyingBreakdown ? t('workbench.applying') : t('workbench.applyBreakdownBtn')}
          </button>
          <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }} onClick={onCloseBreakdownPreview}>
            {t('workbench.closePreview')}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h4 style={{ fontSize: '0.85rem', color: '#818cf8', margin: 0 }}>
              <Users size={14} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
              {t('workbench.extractedCharacters')} ({draftCharacters.length})
            </h4>
            {draftCharacters.length > 0 && (
              <button className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }} onClick={onToggleConfirmAllChars}>
                <Check size={12} /> {t('workbench.confirmAllDrafts')}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {draftCharacters.map((c, i) => {
              const isConfirmed = confirmedCharIndices.has(i);
              return (
                <div key={i} style={{
                  padding: '0.75rem', borderRadius: 'var(--radius-md)',
                  background: isConfirmed ? 'rgba(52,211,153,0.1)' : 'rgba(99,102,241,0.1)',
                  fontSize: '0.8rem',
                  border: isConfirmed ? '1px solid rgba(52,211,153,0.4)' : '1px solid rgba(99,102,241,0.2)',
                  transition: 'all 0.2s'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <InputWithCounter maxLength={TEXT_LIMITS.DRAFT_NAME_MAX} className="form-input" style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem', flex: 1, marginRight: '0.5rem' }}
                      value={c.name} onChange={e => onUpdateDraftCharacter(i, 'name', e.target.value)}
                      placeholder={t('workbench.draftCharNamePlaceholder')} />
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button className="btn btn-secondary" style={{ padding: '0.2rem 0.4rem', border: 'none', color: isConfirmed ? '#34d399' : '#818cf8', background: isConfirmed ? 'rgba(52,211,153,0.15)' : 'rgba(99,102,241,0.15)' }}
                        onClick={() => onToggleConfirmChar(i)}
                        title={isConfirmed ? t('workbench.unconfirmDraft') : t('workbench.confirmDraft')}>
                        {isConfirmed ? <CheckCircle2 size={14} /> : <Check size={14} />}
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '0.2rem', border: 'none', color: '#f87171' }}
                        onClick={() => onRemoveDraftCharacter(i)} title={t('workbench.removeDraft')}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <TextAreaWithCounter maxLength={TEXT_LIMITS.DRAFT_PROMPT_MAX} className="form-textarea" style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', minHeight: '40px', width: '100%', marginBottom: '0.3rem' }}
                    value={c.appearancePrompt} onChange={e => onUpdateDraftCharacter(i, 'appearancePrompt', e.target.value)}
                    placeholder={t('workbench.draftAppearancePlaceholder')} />
                  <button type="button" className="btn btn-secondary" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#a78bfa' }}
                    disabled={!c.appearancePrompt || (refiningDraftCharField?.index === i && refiningDraftCharField?.field === 'appearance')}
                    onClick={() => onRefineCharAppearance(i, c.appearancePrompt)}>
                    {refiningDraftCharField?.index === i && refiningDraftCharField?.field === 'appearance' ? <RefreshCw size={10} className="spin" /> : <Wand2 size={10} />}
                    {refiningDraftCharField?.index === i && refiningDraftCharField?.field === 'appearance' ? t('textAI.refiningPrompt') : t('textAI.refineCharAppearance')}
                  </button>
                  <TextAreaWithCounter maxLength={TEXT_LIMITS.DRAFT_PROMPT_MAX} className="form-textarea" style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', minHeight: '40px', width: '100%', marginBottom: '0.3rem' }}
                    value={c.personalityPrompt} onChange={e => onUpdateDraftCharacter(i, 'personalityPrompt', e.target.value)}
                    placeholder={t('workbench.draftPersonalityPlaceholder')} />
                  <button type="button" className="btn btn-secondary" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#a78bfa' }}
                    disabled={!c.personalityPrompt || (refiningDraftCharField?.index === i && refiningDraftCharField?.field === 'personality')}
                    onClick={() => onRefineCharPersonality(i, c.personalityPrompt)}>
                    {refiningDraftCharField?.index === i && refiningDraftCharField?.field === 'personality' ? <RefreshCw size={10} className="spin" /> : <Wand2 size={10} />}
                    {refiningDraftCharField?.index === i && refiningDraftCharField?.field === 'personality' ? t('textAI.refiningPrompt') : t('textAI.refineCharPersonality')}
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    disabled={!c.appearancePrompt && !c.personalityPrompt || generatingDraftCharImageIndices.has(i)}
                    onClick={() => onGenerateCharImage(i, {
                      prompt: [c.appearancePrompt, c.personalityPrompt].filter(Boolean).join(', '),
                      aspectRatio: '1:1',
                      promptOptimizer: true,
                    })}>
                    {generatingDraftCharImageIndices.has(i) ? <RefreshCw size={12} className="spin" /> : <Sparkles size={12} />}
                    {generatingDraftCharImageIndices.has(i) ? t('workbench.generatingDraftImage') : t('workbench.generateDraftImage')}
                  </button>
                </div>
              );
            })}
          </div>
          {draftCharacters.length > 0 && (
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              {t('workbench.confirmedCount', { count: confirmedCharIndices.size })} / {t('workbench.unconfirmedCount', { count: draftCharacters.length - confirmedCharIndices.size })}
            </p>
          )}
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h4 style={{ fontSize: '0.85rem', color: '#f472b6', margin: 0 }}>
              <ImagePlus size={14} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
              {t('workbench.extractedBackgrounds')} ({draftBackgrounds.length})
            </h4>
            {draftBackgrounds.length > 0 && (
              <button className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }} onClick={onToggleConfirmAllBgs}>
                <Check size={12} /> {t('workbench.confirmAllDrafts')}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {draftBackgrounds.map((bg, i) => {
              const isConfirmed = confirmedBgIndices.has(i);
              return (
                <div key={i} style={{
                  padding: '0.75rem', borderRadius: 'var(--radius-md)',
                  background: isConfirmed ? 'rgba(52,211,153,0.1)' : 'rgba(236,72,153,0.1)',
                  fontSize: '0.8rem',
                  border: isConfirmed ? '1px solid rgba(52,211,153,0.4)' : '1px solid rgba(236,72,153,0.2)',
                  transition: 'all 0.2s'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <InputWithCounter maxLength={TEXT_LIMITS.DRAFT_NAME_MAX} className="form-input" style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem', flex: 1, marginRight: '0.5rem' }}
                      value={bg.name} onChange={e => onUpdateDraftBackground(i, 'name', e.target.value)}
                      placeholder={t('workbench.draftBgNamePlaceholder')} />
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button className="btn btn-secondary" style={{ padding: '0.2rem 0.4rem', border: 'none', color: isConfirmed ? '#34d399' : '#f472b6', background: isConfirmed ? 'rgba(52,211,153,0.15)' : 'rgba(236,72,153,0.15)' }}
                        onClick={() => onToggleConfirmBg(i)}
                        title={isConfirmed ? t('workbench.unconfirmDraft') : t('workbench.confirmDraft')}>
                        {isConfirmed ? <CheckCircle2 size={14} /> : <Check size={14} />}
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '0.2rem', border: 'none', color: '#f87171' }}
                        onClick={() => onRemoveDraftBackground(i)} title={t('workbench.removeDraft')}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <TextAreaWithCounter maxLength={TEXT_LIMITS.DRAFT_PROMPT_MAX} className="form-textarea" style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', minHeight: '50px', width: '100%', marginBottom: '0.3rem' }}
                    value={bg.environmentPrompt} onChange={e => onUpdateDraftBackground(i, 'environmentPrompt', e.target.value)}
                    placeholder={t('workbench.draftEnvPlaceholder')} />
                  <button type="button" className="btn btn-secondary" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#f472b6' }}
                    disabled={!bg.environmentPrompt || (refiningDraftBgField?.index === i && refiningDraftBgField?.field === 'environment')}
                    onClick={() => onRefineBackground(i, bg.environmentPrompt)}>
                    {refiningDraftBgField?.index === i && refiningDraftBgField?.field === 'environment' ? <RefreshCw size={10} className="spin" /> : <Wand2 size={10} />}
                    {refiningDraftBgField?.index === i && refiningDraftBgField?.field === 'environment' ? t('textAI.refiningPrompt') : t('textAI.refinePrompt')}
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    disabled={!bg.environmentPrompt || generatingDraftBgImageIndices.has(i)}
                    onClick={() => onGenerateBgImage(i, { prompt: bg.environmentPrompt, aspectRatio: '16:9', promptOptimizer: true })}>
                    {generatingDraftBgImageIndices.has(i) ? <RefreshCw size={12} className="spin" /> : <Sparkles size={12} />}
                    {generatingDraftBgImageIndices.has(i) ? t('workbench.generatingDraftImage') : t('workbench.generateDraftImage')}
                  </button>
                </div>
              );
            })}
          </div>
          {draftBackgrounds.length > 0 && (
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              {t('workbench.confirmedCount', { count: confirmedBgIndices.size })} / {t('workbench.unconfirmedCount', { count: draftBackgrounds.length - confirmedBgIndices.size })}
            </p>
          )}
        </div>
      </div>

      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
        {t('workbench.breakdownEditHint')}
      </p>
    </div>
  );
};