import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../adapters/outbound/repositories/DexieDatabase';
import { storyService, videoGenerationService, imageAdapter, voiceService, musicService } from '../../dependencies';
import { Play, Spline, Trash2, RefreshCw, Users, PlayCircle, AlertTriangle, ImagePlus, Sparkles, Pencil, BookOpen, Download, Check, CheckCircle2, Volume2, Music } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { VideoTask, Character } from '../../domain/entities/models';
import type { CharacterDraft, BackgroundDraft, BreakdownSegmentDraft, ImageGenerationContext } from '../../domain/ports/OutboundPorts';
import { useSpace } from '../contexts/SpaceContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { getErrorMessage } from '../utils/errorUtils';

export const StoryWorkbench: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentSpaceId } = useSpace();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const stories = useLiveQuery(() => currentSpaceId ? db.stories.where('spaceId').equals(currentSpaceId).toArray() : [], [currentSpaceId]);
  const backgrounds = useLiveQuery(() => currentSpaceId ? db.backgrounds.where('spaceId').equals(currentSpaceId).toArray() : [], [currentSpaceId]);
  const characters = useLiveQuery(() => currentSpaceId ? db.characters.where('spaceId').equals(currentSpaceId).toArray() : [], [currentSpaceId]);

  const [title, setTitle] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(() => {
    // Initialize from URL param if present
    const params = new URLSearchParams(window.location.search);
    return params.get('story');
  });
  const [isSplitting, setIsSplitting] = useState(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchBgId, setBatchBgId] = useState('');
  const [isBreakingDown, setIsBreakingDown] = useState(false);
  const [draftCharacters, setDraftCharacters] = useState<CharacterDraft[]>([]);
  const [draftBackgrounds, setDraftBackgrounds] = useState<BackgroundDraft[]>([]);
  const [draftSegments, setDraftSegments] = useState<BreakdownSegmentDraft[]>([]);
  const [showBreakdownPreview, setShowBreakdownPreview] = useState(false);
  const [isApplyingBreakdown, setIsApplyingBreakdown] = useState(false);
  const [confirmedCharIndices, setConfirmedCharIndices] = useState<Set<number>>(new Set());
  const [confirmedBgIndices, setConfirmedBgIndices] = useState<Set<number>>(new Set());
  const [generatingDraftCharImageIndices, setGeneratingDraftCharImageIndices] = useState<Set<number>>(new Set());
  const [generatingDraftBgImageIndices, setGeneratingDraftBgImageIndices] = useState<Set<number>>(new Set());
  const [narrationStatuses, setNarrationStatuses] = useState<Record<string, string>>({});
  const [narrationUrls, setNarrationUrls] = useState<Record<string, string>>({});
  // BGM state
  const [bgmSegmentId, setBgmSegmentId] = useState<string | null>(null);
  const [bgmPrompt, setBgmPrompt] = useState('');
  const [bgmMode, setBgmMode] = useState<'instrumental' | 'autoLyrics' | 'customLyrics'>('instrumental');
  const [bgmLyrics, setBgmLyrics] = useState('');
  const [isGeneratingBGM, setIsGeneratingBGM] = useState(false);
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [editingStoryId, setEditingStoryId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editOriginalText, setEditOriginalText] = useState('');

  // Track active narration polling intervals for cleanup
  const narrationPollersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Cleanup all polling intervals on unmount
  useEffect(() => {
    const currentPollers = narrationPollersRef.current;
    return () => {
      for (const [, interval] of currentPollers) {
        clearInterval(interval);
      }
      currentPollers.clear();
    };
  }, []);

  // Helper: clear all narration pollers and state (call when switching stories)
  const clearNarrationState = () => {
    for (const [, interval] of narrationPollersRef.current) {
      clearInterval(interval);
    }
    narrationPollersRef.current.clear();
    setNarrationStatuses({});
    setNarrationUrls({});
  };

  // Helper: clear BGM editing state
  const clearBGMState = () => {
    setBgmSegmentId(null);
    setBgmPrompt('');
    setBgmLyrics('');
    setBgmMode('instrumental');
  };

  // Wrapper for setting selectedStoryId that also clears narration and BGM state
  const switchStory = (storyId: string | null) => {
    if (storyId !== selectedStoryId) {
      clearNarrationState();
      clearBGMState();
    }
    setSelectedStoryId(storyId);
  };

  // Reactive segments
  const segments = useLiveQuery(
    () => selectedStoryId ? db.segments.where('storyId').equals(selectedStoryId).toArray() : [],
    [selectedStoryId],
    []
  );

  // Only load video tasks for segments of the selected story
  const segmentIds = useMemo(() => (segments || []).map(s => s.id), [segments]);
  const videoTasks = useLiveQuery(
    () => segmentIds.length > 0 ? db.videoTasks.where('segmentId').anyOf(segmentIds).toArray() : [],
    [segmentIds]
  );

  const sortedSegments = useMemo(
    () => [...(segments || [])].sort((a, b) => a.sequenceOrder - b.sequenceOrder),
    [segments]
  );

  // Map: segmentId -> latest VideoTask
  const latestTaskMap = useMemo(() => {
    const map = new Map<string, VideoTask>();
    if (!videoTasks) return map;
    const sorted = [...videoTasks].sort((a, b) => b.createdAt - a.createdAt);
    for (const task of sorted) {
      if (!map.has(task.segmentId)) {
        map.set(task.segmentId, task);
      }
    }
    return map;
  }, [videoTasks]);

  // Map: characterId -> Character
  const characterMap = useMemo(() => {
    const map = new Map<string, Character>();
    if (!characters) return map;
    for (const c of characters) {
      map.set(c.id, c);
    }
    return map;
  }, [characters]);

  // Currently selected story
  const selectedStory = useMemo(
    () => stories?.find(s => s.id === selectedStoryId) ?? null,
    [stories, selectedStoryId]
  );

  // Progress stats
  const progressStats = useMemo(() => {
    if (sortedSegments.length === 0) return null;
    let success = 0, processing = 0, pending = 0, failed = 0, ready = 0;
    for (const seg of sortedSegments) {
      const task = latestTaskMap.get(seg.id);
      if (!task) {
        ready++;
      } else {
        switch (task.status) {
          case 'SUCCESS': success++; break;
          case 'PROCESSING': processing++; break;
          case 'PENDING': pending++; break;
          case 'FAILED': failed++; break;
        }
      }
    }
    return { total: sortedSegments.length, success, processing, pending, failed, ready };
  }, [sortedSegments, latestTaskMap]);

  const handleCreateStory = async () => {
    if (!title || !originalText || !currentSpaceId) return;
    setIsSplitting(true);
    let createdStoryId: string | null = null;
    try {
      const story = await storyService.createStory(title, originalText, currentSpaceId);
      createdStoryId = story.id;
      switchStory(story.id);
      await storyService.splitStory(story.id);
      setTitle('');
      setOriginalText('');
    } catch (e) {
      console.error(e);
      // Rollback: delete the created story if split failed
      if (createdStoryId) {
        try { await storyService.deleteStory(createdStoryId); } catch { /* ignore rollback error */ }
        switchStory(null);
      }
      showToast('error', t('workbench.splitFailed'));
    } finally {
      setIsSplitting(false);
    }
  };

  const handleCreateAndBreakdown = async () => {
    if (!title || !originalText || !currentSpaceId) return;
    setIsBreakingDown(true);
    setDraftCharacters([]);
    setDraftBackgrounds([]);
    setDraftSegments([]);
    setShowBreakdownPreview(false);
    setConfirmedCharIndices(new Set());
    setConfirmedBgIndices(new Set());
    try {
      const story = await storyService.createStory(title, originalText, currentSpaceId);
      switchStory(story.id);
      const result = await storyService.previewBreakdown(story.id);
      setDraftCharacters(result.characters);
      setDraftBackgrounds(result.backgrounds);
      setDraftSegments(result.segments);
      setShowBreakdownPreview(true);
      setTitle('');
      setOriginalText('');
    } catch (e) {
      console.error(e);
      showToast('error', t('workbench.breakdownFailed'));
    } finally {
      setIsBreakingDown(false);
    }
  };

  const handleReBreakdown = async () => {
    if (!selectedStoryId) return;
    const ok = await confirm({
      title: t('workbench.confirmReBreakdownTitle'),
      message: t('workbench.confirmReBreakdown'),
      confirmLabel: t('workbench.reBreakdownBtn'),
      danger: true
    });
    if (!ok) return;
    setIsBreakingDown(true);
    setDraftCharacters([]);
    setDraftBackgrounds([]);
    setDraftSegments([]);
    setShowBreakdownPreview(false);
    setConfirmedCharIndices(new Set());
    setConfirmedBgIndices(new Set());
    try {
      const result = await storyService.previewBreakdown(selectedStoryId);
      setDraftCharacters(result.characters);
      setDraftBackgrounds(result.backgrounds);
      setDraftSegments(result.segments);
      setShowBreakdownPreview(true);
    } catch (e) {
      console.error(e);
      showToast('error', t('workbench.breakdownFailed'));
    } finally {
      setIsBreakingDown(false);
    }
  };

  const handleQuickSplit = async (storyId: string) => {
    switchStory(storyId);
    setIsSplitting(true);
    try {
      await storyService.splitStory(storyId);
    } catch (e) {
      console.error(e);
      showToast('error', t('workbench.splitFailed'));
    } finally {
      setIsSplitting(false);
    }
  };

  // --- Breakdown draft editing helpers ---
  const updateDraftCharacter = (index: number, field: keyof CharacterDraft, value: string) => {
    setDraftCharacters(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      // If name changed, also update segment references
      if (field === 'name') {
        const oldName = prev[index].name;
        setDraftSegments(segs => segs.map(seg => ({
          ...seg,
          mentionedCharacterNames: seg.mentionedCharacterNames.map(n => n === oldName ? value : n)
        })));
      }
      return next;
    });
  };

  const removeDraftCharacter = (index: number) => {
    const name = draftCharacters[index].name;
    setDraftCharacters(prev => prev.filter((_, i) => i !== index));
    setConfirmedCharIndices(prev => {
      const next = new Set<number>();
      for (const i of prev) {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      }
      return next;
    });
    setDraftSegments(prev => prev.map(seg => ({
      ...seg,
      mentionedCharacterNames: seg.mentionedCharacterNames.filter(n => n !== name)
    })));
  };

  const updateDraftBackground = (index: number, field: keyof BackgroundDraft, value: string) => {
    setDraftBackgrounds(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      // If name changed, also update segment references
      if (field === 'name') {
        const oldName = prev[index].name;
        setDraftSegments(segs => segs.map(seg => ({
          ...seg,
          suggestedBackgroundName: seg.suggestedBackgroundName === oldName ? value : seg.suggestedBackgroundName
        })));
      }
      return next;
    });
  };

  const removeDraftBackground = (index: number) => {
    const name = draftBackgrounds[index].name;
    setDraftBackgrounds(prev => prev.filter((_, i) => i !== index));
    setConfirmedBgIndices(prev => {
      const next = new Set<number>();
      for (const i of prev) {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      }
      return next;
    });
    setDraftSegments(prev => prev.map(seg => ({
      ...seg,
      suggestedBackgroundName: seg.suggestedBackgroundName === name ? '' : seg.suggestedBackgroundName
    })));
  };

  const handleCloseBreakdownPreview = async () => {
    const ok = await confirm({
      title: t('workbench.confirmClosePreviewTitle'),
      message: t('workbench.confirmClosePreview'),
      confirmLabel: t('workbench.closePreview'),
      danger: true
    });
    if (!ok) return;
    setShowBreakdownPreview(false);
    setDraftCharacters([]);
    setDraftBackgrounds([]);
    setDraftSegments([]);
    setConfirmedCharIndices(new Set());
    setConfirmedBgIndices(new Set());
    setGeneratingDraftCharImageIndices(new Set());
    setGeneratingDraftBgImageIndices(new Set());
  };

  const handleApplyBreakdown = async () => {
    if (!selectedStoryId) return;
    setIsApplyingBreakdown(true);
    try {
      // Only apply confirmed drafts
      const confirmedChars = draftCharacters.filter((_, i) => confirmedCharIndices.has(i));
      const confirmedBgs = draftBackgrounds.filter((_, i) => confirmedBgIndices.has(i));
      await storyService.applyBreakdown(selectedStoryId, confirmedChars, confirmedBgs, draftSegments);
      setShowBreakdownPreview(false);
      setDraftCharacters([]);
      setDraftBackgrounds([]);
      setDraftSegments([]);
      setConfirmedCharIndices(new Set());
      setConfirmedBgIndices(new Set());
      setGeneratingDraftCharImageIndices(new Set());
      setGeneratingDraftBgImageIndices(new Set());
      showToast('success', t('workbench.breakdownApplied'));
    } catch (e) {
      console.error(e);
      showToast('error', t('workbench.breakdownApplyFailed'));
    } finally {
      setIsApplyingBreakdown(false);
    }
  };

  const handleReSplit = async () => {
    if (!selectedStoryId) return;
    const ok = await confirm({
      title: t('workbench.confirmReSplitTitle'),
      message: t('workbench.confirmReSplit'),
      confirmLabel: t('workbench.reSplitBtn'),
      danger: true
    });
    if (!ok) return;
    setIsSplitting(true);
    try {
      await storyService.splitStory(selectedStoryId);
    } catch (e) {
      console.error(e);
      showToast('error', t('workbench.splitFailed'));
    } finally {
      setIsSplitting(false);
    }
  };

  const handleSelectBackground = async (segmentId: string, bgId: string) => {
    await storyService.updateSegmentBackground(segmentId, bgId);
  };

  const handleGenerateVideo = async (segmentId: string) => {
    if (!selectedStoryId) return;
    try {
      await videoGenerationService.generateVideo(segmentId, selectedStoryId, 'MINIMAX');
    } catch (e: unknown) {
      const message = getErrorMessage(e);
      showToast('error', message);
    }
  };

  const handleBatchGenerate = async () => {
    if (!selectedStoryId) return;
    setIsBatchGenerating(true);
    try {
      const eligible = sortedSegments.filter(seg => {
        if (!seg.selectedBackgroundId) return false;
        const task = latestTaskMap.get(seg.id);
        return !task || task.status === 'FAILED';
      });

      // Check readiness warnings
      const noVoice = eligible.filter(seg =>
        seg.mentionedCharacters.some(id => !characters?.find(c => c.id === id)?.voiceId)
      );
      const noBGM = eligible.filter(seg => !seg.bgmAudioUrl);

      if (noVoice.length > 0 || noBGM.length > 0) {
        const warnings: string[] = [];
        if (noVoice.length > 0) warnings.push(t('workbench.noVoiceWarning', { count: noVoice.length }));
        if (noBGM.length > 0) warnings.push(t('workbench.noBGMWarning', { count: noBGM.length }));
        const ok = await confirm({
          title: t('workbench.batchWarningsTitle'),
          message: warnings.join('\n'),
          confirmLabel: t('workbench.batchGenerateBtn'),
          danger: false
        });
        if (!ok) return;
      }

      for (const seg of eligible) {
        await videoGenerationService.generateVideo(seg.id, selectedStoryId, 'MINIMAX');
      }
      if (eligible.length > 0) {
        showToast('info', t('workbench.batchStarted', { count: eligible.length }));
      } else {
        showToast('warning', t('workbench.batchNoEligible'));
      }
    } catch (e: unknown) {
      const message = getErrorMessage(e);
      showToast('error', message);
    } finally {
      setIsBatchGenerating(false);
    }
  };

  const handleBatchSetBackground = async () => {
    if (!selectedStoryId || !batchBgId) return;
    try {
      for (const seg of sortedSegments) {
        await storyService.updateSegmentBackground(seg.id, batchBgId);
      }
      showToast('success', t('workbench.batchBgSuccess', { count: sortedSegments.length }));
      setBatchBgId('');
    } catch (e: unknown) {
      const message = getErrorMessage(e);
      showToast('error', message);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    const ok = await confirm({
      title: t('workbench.confirmDeleteTitle'),
      message: t('workbench.confirmDelete'),
      confirmLabel: t('workbench.deleteConfirmBtn'),
      danger: true
    });
    if (!ok) return;
    await storyService.deleteStory(storyId);
    showToast('success', t('workbench.deleteSuccess'));
    if (selectedStoryId === storyId) {
      switchStory(null);
    }
  };

  const openEditStory = (storyId: string) => {
    const story = stories?.find(s => s.id === storyId);
    if (!story) return;
    setEditingStoryId(storyId);
    setEditTitle(story.title);
    setEditOriginalText(story.originalText);
  };

  const handleSaveEditStory = async () => {
    if (!editingStoryId || !editTitle.trim()) return;
    const story = stories?.find(s => s.id === editingStoryId);
    const wasSplit = story?.status === 'SPLIT';
    await storyService.updateStory(editingStoryId, editTitle.trim(), editOriginalText.trim());
    setEditingStoryId(null);
    if (wasSplit) {
      showToast('warning', t('workbench.editResetToDraft'));
    }
  };

  const getStatusColor = (status: VideoTask['status']) => {
    switch (status) {
      case 'SUCCESS': return '#34d399';
      case 'FAILED': return '#f87171';
      case 'PROCESSING': return '#fbbf24';
      case 'PENDING': return '#9ca3af';
    }
  };

  const getStatusLabel = (status: VideoTask['status']) => {
    switch (status) {
      case 'SUCCESS': return t('workbench.statusSuccess');
      case 'FAILED': return t('workbench.statusFailed');
      case 'PROCESSING': return t('workbench.statusProcessing');
      case 'PENDING': return t('workbench.statusPending');
    }
  };

  const hasCharacters = (characters?.length ?? 0) > 0;
  const hasBackgrounds = (backgrounds?.length ?? 0) > 0;

  // BGM style presets
  const bgmStylePresets = [
    { key: 'cinematic', prompt: 'Cinematic, Epic, Orchestral, Grand, Sweeping' },
    { key: 'lighthearted', prompt: 'Lighthearted, Acoustic, Pop, Warm, Gentle' },
    { key: 'suspense', prompt: 'Suspense, Dark, Thriller, Tension, Mysterious' },
    { key: 'melancholic', prompt: 'Melancholic, Piano, Emotional, Sad, Reflective' },
    { key: 'upbeat', prompt: 'Upbeat, Funky, Dance, Energetic, Joyful' },
  ];

  const handleGenerateBGM = async (segmentId: string) => {
    if (!bgmPrompt.trim()) {
      showToast('warning', t('music.promptLabel'));
      return;
    }
    setIsGeneratingBGM(true);
    try {
      const options: { isInstrumental?: boolean; lyrics?: string; lyricsOptimizer?: boolean } = {};
      if (bgmMode === 'instrumental') {
        options.isInstrumental = true;
      } else if (bgmMode === 'autoLyrics') {
        options.isInstrumental = false;
        options.lyricsOptimizer = true;
      } else {
        options.isInstrumental = false;
        options.lyrics = bgmLyrics || undefined;
      }
      await musicService.generateBGM(segmentId, bgmPrompt.trim(), options);
      showToast('success', t('music.bgmGenerated'));
      setBgmSegmentId(null);
      setBgmPrompt('');
      setBgmLyrics('');
    } catch (e: unknown) {
      showToast('error', getErrorMessage(e, t('music.bgmGenerateFailed')));
    } finally {
      setIsGeneratingBGM(false);
    }
  };

  const handleRemoveBGM = async (segmentId: string) => {
    const ok = await confirm({
      title: t('music.removeBGM'),
      message: t('music.confirmRemoveBGM'),
      confirmLabel: t('music.removeBGMBtn'),
      danger: true
    });
    if (!ok) return;
    try {
      await musicService.removeBGMFromSegment(segmentId);
      showToast('success', t('music.removeBGM'));
    } catch (e: unknown) {
      showToast('error', getErrorMessage(e));
    }
  };

  const handleGenerateLyrics = async () => {
    if (!bgmPrompt.trim()) return;
    setIsGeneratingLyrics(true);
    try {
      const result = await musicService.generateLyrics(bgmPrompt.trim());
      setBgmLyrics(result.lyrics);
      showToast('success', t('music.lyricsGenerated'));
    } catch (e: unknown) {
      showToast('error', getErrorMessage(e));
    } finally {
      setIsGeneratingLyrics(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '2rem', height: '100%', flexWrap: 'wrap' }}>
      {/* Left panel: Stories list & creation */}
      <div style={{ flex: '1 1 320px', maxWidth: '400px', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3>{t('workbench.newStory')}</h3>
          <div className="form-group" style={{ marginTop: '1rem' }}>
            <input className="form-input" placeholder={t('workbench.storyTitlePlaceholder')} value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="form-group">
            <textarea className="form-textarea" placeholder={t('workbench.storyContentPlaceholder')} value={originalText} onChange={e => setOriginalText(e.target.value)} />
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
              onClick={handleCreateStory}
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
                      <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }} onClick={handleSaveEditStory}>{t('workbench.saveEditBtn')}</button>
                      <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }} onClick={() => setEditingStoryId(null)}>{t('workbench.cancelBtn')}</button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="glass-panel interactive story-card"
                    style={{
                      padding: '1rem',
                      cursor: 'pointer',
                      borderColor: selectedStoryId === s.id ? 'var(--primary-color)' : 'var(--border-color)',
                      background: selectedStoryId === s.id ? 'var(--bg-panel-hover)' : 'var(--bg-panel)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    onClick={() => switchStory(s.id)}
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
                          onClick={(e) => { e.stopPropagation(); handleQuickSplit(s.id); }}
                          title={t('workbench.splitBtn')}
                        >
                          <Spline size={14} />
                        </button>
                      )}
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem', border: 'none' }}
                        onClick={(e) => { e.stopPropagation(); openEditStory(s.id); }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem', border: 'none' }}
                        onClick={(e) => { e.stopPropagation(); handleDeleteStory(s.id); }}
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

      {/* Right panel: Segments and Video Generation */}
      <div className="glass-panel" style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div className="page-header" style={{ marginBottom: '1.5rem' }}>
          <h2>{t('workbench.segmentsTitle')}</h2>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {selectedStory && (
              <>
                <button className="btn btn-secondary" onClick={handleReSplit} disabled={isSplitting}>
                  <Spline size={16} /> {isSplitting ? t('workbench.splitting') : t('workbench.reSplitBtn')}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleReBreakdown}
                  disabled={isBreakingDown}
                  style={{ background: 'linear-gradient(135deg, #6366f1, #ec4899)' }}
                >
                  <Sparkles size={16} />
                  {isBreakingDown ? t('workbench.breakingDown') : t('workbench.reBreakdownBtn')}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Breakdown result preview — editable */}
        {showBreakdownPreview && (draftCharacters.length > 0 || draftBackgrounds.length > 0) && (
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
                  onClick={handleApplyBreakdown}
                  disabled={isApplyingBreakdown || (confirmedCharIndices.size === 0 && confirmedBgIndices.size === 0)}
                >
                  {isApplyingBreakdown ? t('workbench.applying') : t('workbench.applyBreakdownBtn')}
                </button>
                <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }} onClick={handleCloseBreakdownPreview}>
                  {t('workbench.closePreview')}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {/* Editable character cards */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.85rem', color: '#818cf8', margin: 0 }}>
                    <Users size={14} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
                    {t('workbench.extractedCharacters')} ({draftCharacters.length})
                  </h4>
                  {draftCharacters.length > 0 && (
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                      onClick={() => {
                        if (confirmedCharIndices.size === draftCharacters.length) {
                          setConfirmedCharIndices(new Set());
                        } else {
                          setConfirmedCharIndices(new Set(draftCharacters.map((_, i) => i)));
                        }
                      }}
                    >
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
                        <input
                          className="form-input"
                          style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem', flex: 1, marginRight: '0.5rem' }}
                          value={c.name}
                          onChange={e => updateDraftCharacter(i, 'name', e.target.value)}
                          placeholder={t('workbench.draftCharNamePlaceholder')}
                        />
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            className="btn btn-secondary"
                            style={{
                              padding: '0.2rem 0.4rem', border: 'none',
                              color: isConfirmed ? '#34d399' : '#818cf8',
                              background: isConfirmed ? 'rgba(52,211,153,0.15)' : 'rgba(99,102,241,0.15)'
                            }}
                            onClick={() => {
                              setConfirmedCharIndices(prev => {
                                const next = new Set(prev);
                                if (next.has(i)) next.delete(i); else next.add(i);
                                return next;
                              });
                            }}
                            title={isConfirmed ? t('workbench.unconfirmDraft') : t('workbench.confirmDraft')}
                          >
                            {isConfirmed ? <CheckCircle2 size={14} /> : <Check size={14} />}
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.2rem', border: 'none', color: '#f87171' }}
                            onClick={() => removeDraftCharacter(i)}
                            title={t('workbench.removeDraft')}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <textarea
                        className="form-textarea"
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', minHeight: '40px', width: '100%', marginBottom: '0.3rem' }}
                        value={c.appearancePrompt}
                        onChange={e => updateDraftCharacter(i, 'appearancePrompt', e.target.value)}
                        placeholder={t('workbench.draftAppearancePlaceholder')}
                      />
                      <textarea
                        className="form-textarea"
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', minHeight: '40px', width: '100%' }}
                        value={c.personalityPrompt}
                        onChange={e => updateDraftCharacter(i, 'personalityPrompt', e.target.value)}
                        placeholder={t('workbench.draftPersonalityPlaceholder')}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        disabled={!c.appearancePrompt && !c.personalityPrompt || generatingDraftCharImageIndices.has(i)}
                        onClick={async () => {
                          setGeneratingDraftCharImageIndices(prev => new Set(prev).add(i));
                          try {
                            const context: ImageGenerationContext = {
                              prompt: [c.appearancePrompt, c.personalityPrompt].filter(Boolean).join(', '),
                              aspectRatio: '1:1',
                            };
                            const result = await imageAdapter.generateImage(context);
                            setDraftCharacters(prev => {
                              const next = [...prev];
                              next[i] = { ...next[i], referenceImageUrl: result.imageDataUri };
                              return next;
                            });
                            showToast('success', t('workbench.draftImageGenerated'));
                          } catch (e: unknown) {
                            showToast('error', getErrorMessage(e, t('workbench.breakdownApplyFailed')));
                          } finally {
                            setGeneratingDraftCharImageIndices(prev => {
                              const next = new Set(prev);
                              next.delete(i);
                              return next;
                            });
                          }
                        }}
                      >
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

              {/* Editable background cards */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.85rem', color: '#f472b6', margin: 0 }}>
                    <ImagePlus size={14} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
                    {t('workbench.extractedBackgrounds')} ({draftBackgrounds.length})
                  </h4>
                  {draftBackgrounds.length > 0 && (
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                      onClick={() => {
                        if (confirmedBgIndices.size === draftBackgrounds.length) {
                          setConfirmedBgIndices(new Set());
                        } else {
                          setConfirmedBgIndices(new Set(draftBackgrounds.map((_, i) => i)));
                        }
                      }}
                    >
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
                        <input
                          className="form-input"
                          style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem', flex: 1, marginRight: '0.5rem' }}
                          value={bg.name}
                          onChange={e => updateDraftBackground(i, 'name', e.target.value)}
                          placeholder={t('workbench.draftBgNamePlaceholder')}
                        />
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            className="btn btn-secondary"
                            style={{
                              padding: '0.2rem 0.4rem', border: 'none',
                              color: isConfirmed ? '#34d399' : '#f472b6',
                              background: isConfirmed ? 'rgba(52,211,153,0.15)' : 'rgba(236,72,153,0.15)'
                            }}
                            onClick={() => {
                              setConfirmedBgIndices(prev => {
                                const next = new Set(prev);
                                if (next.has(i)) next.delete(i); else next.add(i);
                                return next;
                              });
                            }}
                            title={isConfirmed ? t('workbench.unconfirmDraft') : t('workbench.confirmDraft')}
                          >
                            {isConfirmed ? <CheckCircle2 size={14} /> : <Check size={14} />}
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.2rem', border: 'none', color: '#f87171' }}
                            onClick={() => removeDraftBackground(i)}
                            title={t('workbench.removeDraft')}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <textarea
                        className="form-textarea"
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', minHeight: '50px', width: '100%' }}
                        value={bg.environmentPrompt}
                        onChange={e => updateDraftBackground(i, 'environmentPrompt', e.target.value)}
                        placeholder={t('workbench.draftEnvPlaceholder')}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        disabled={!bg.environmentPrompt || generatingDraftBgImageIndices.has(i)}
                        onClick={async () => {
                          setGeneratingDraftBgImageIndices(prev => new Set(prev).add(i));
                          try {
                            const context: ImageGenerationContext = {
                              prompt: bg.environmentPrompt,
                              aspectRatio: '16:9',
                            };
                            const result = await imageAdapter.generateImage(context);
                            setDraftBackgrounds(prev => {
                              const next = [...prev];
                              next[i] = { ...next[i], referenceImageUrl: result.imageDataUri };
                              return next;
                            });
                            showToast('success', t('workbench.draftImageGenerated'));
                          } catch (e: unknown) {
                            showToast('error', getErrorMessage(e, t('workbench.breakdownApplyFailed')));
                          } finally {
                            setGeneratingDraftBgImageIndices(prev => {
                              const next = new Set(prev);
                              next.delete(i);
                              return next;
                            });
                          }
                        }}
                      >
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
        )}

        {/* Prerequisite warnings */}
        {selectedStory && sortedSegments.length > 0 && (!hasCharacters || !hasBackgrounds) && (
          <div style={{
            padding: '1rem 1.25rem', marginBottom: '1.5rem', borderRadius: 'var(--radius-md)',
            background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)',
            display: 'flex', alignItems: 'center', gap: '0.75rem'
          }}>
            <AlertTriangle size={20} color="#fbbf24" />
            <div style={{ flex: 1 }}>
              {!hasCharacters && (
                <span style={{ fontSize: '0.85rem', color: '#fbbf24', marginRight: '1rem' }}>
                  {t('workbench.noCharactersWarning')}
                </span>
              )}
              {!hasBackgrounds && (
                <span style={{ fontSize: '0.85rem', color: '#fbbf24' }}>
                  {t('workbench.noBackgroundsWarning')}
                </span>
              )}
            </div>
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }} onClick={() => navigate(hasCharacters ? '/backgrounds' : '/characters')}>
              {hasCharacters ? t('workbench.goBackgrounds') : t('workbench.goCharacters')}
            </button>
          </div>
        )}

        {/* Progress bar */}
        {progressStats && progressStats.total > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('workbench.progress')}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                {progressStats.success}/{progressStats.total} {t('workbench.completed')}
              </span>
            </div>
            <div style={{
              height: '6px', borderRadius: '3px', background: 'var(--border-color)',
              overflow: 'hidden', display: 'flex'
            }}>
              {progressStats.success > 0 && (
                <div style={{ width: `${(progressStats.success / progressStats.total) * 100}%`, background: '#34d399', transition: 'width 0.3s' }} />
              )}
              {progressStats.processing + progressStats.pending > 0 && (
                <div style={{ width: `${((progressStats.processing + progressStats.pending) / progressStats.total) * 100}%`, background: '#fbbf24', transition: 'width 0.3s' }} />
              )}
              {progressStats.failed > 0 && (
                <div style={{ width: `${(progressStats.failed / progressStats.total) * 100}%`, background: '#f87171', transition: 'width 0.3s' }} />
              )}
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {progressStats.success > 0 && <span style={{ color: '#34d399' }}>{progressStats.success} {t('workbench.statusSuccess')}</span>}
              {progressStats.processing + progressStats.pending > 0 && <span style={{ color: '#fbbf24' }}>{progressStats.processing + progressStats.pending} {t('workbench.statusProcessing')}</span>}
              {progressStats.failed > 0 && <span style={{ color: '#f87171' }}>{progressStats.failed} {t('workbench.statusFailed')}</span>}
              {progressStats.ready > 0 && <span>{progressStats.ready} {t('workbench.statusReady')}</span>}
            </div>
          </div>
        )}

        {/* Batch operations toolbar */}
        {selectedStory && sortedSegments.length > 0 && (
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select
                className="form-select"
                style={{ width: '160px', padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
                value={batchBgId}
                onChange={e => setBatchBgId(e.target.value)}
              >
                <option value="">{t('workbench.batchBgPlaceholder')}</option>
                {backgrounds?.map(bg => (
                  <option key={bg.id} value={bg.id}>{bg.name}</option>
                ))}
              </select>
              <button
                className="btn btn-secondary"
                disabled={!batchBgId}
                onClick={handleBatchSetBackground}
                style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
              >
                <ImagePlus size={14} /> {t('workbench.batchBgBtn')}
              </button>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleBatchGenerate}
              disabled={isBatchGenerating || !hasBackgrounds}
            >
              <PlayCircle size={16} />
              {isBatchGenerating ? t('workbench.batchGenerating') : t('workbench.batchGenerateBtn')}
            </button>
          </div>
        )}

        {!selectedStoryId ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>{t('workbench.selectStory')}</p>
        ) : sortedSegments.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>{t('workbench.noSegments')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {sortedSegments.map((seg, idx) => {
              const task = latestTaskMap.get(seg.id);
              const mentionedCharNames = seg.mentionedCharacters
                .map(id => characterMap.get(id)?.name)
                .filter((name): name is string => !!name);

              return (
                <div key={seg.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem' }}>
                  <div style={{ flex: '0 0 60px', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                    #{idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ marginBottom: '1rem', lineHeight: 1.6 }}>{seg.content}</p>

                    {/* Character tags */}
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
                          }}
                            onClick={() => navigate('/characters')}
                            title={t('workbench.goCharacters')}
                          >
                            <Users size={12} /> {name}
                          </span>
                        ))}
                      </div>
                    )}

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
                        disabled={!seg.selectedBackgroundId || task?.status === 'PROCESSING' || task?.status === 'PENDING'}
                        onClick={() => handleGenerateVideo(seg.id)}
                      >
                        <Play size={16} />
                        {task?.status === 'PROCESSING' || task?.status === 'PENDING'
                          ? t('workbench.generating')
                          : t('workbench.generateBtn')}
                      </button>

                      {task?.status === 'FAILED' && (
                        <button
                          className="btn btn-secondary"
                          disabled={!seg.selectedBackgroundId}
                          onClick={() => handleGenerateVideo(seg.id)}
                        >
                          <RefreshCw size={16} /> {t('workbench.retryBtn')}
                        </button>
                      )}

                      {task && (
                        <div style={{
                          fontSize: '0.875rem',
                          color: getStatusColor(task.status),
                          display: 'flex', alignItems: 'center', gap: '0.4rem'
                        }}>
                          <span style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            background: getStatusColor(task.status),
                            animation: task.status === 'PROCESSING' || task.status === 'PENDING'
                              ? 'pulse 1.5s ease-in-out infinite' : 'none'
                          }} />
                          {getStatusLabel(task.status)}
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
                        <a
                          href={task.videoUrl}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                            marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--primary-color)',
                            textDecoration: 'none'
                          }}
                        >
                          <Download size={14} /> {t('workbench.downloadVideo')}
                        </a>
                      </div>
                    )}

                    {/* Narration Generation */}
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      disabled={narrationStatuses[seg.id] === 'running'}
                      onClick={async () => {
                        const charWithVoice = seg.mentionedCharacters
                          .map(id => characters?.find(c => c.id === id))
                          .find(c => c?.voiceId);
                        if (!charWithVoice?.voiceId) {
                          showToast('warning', t('character.noVoice'));
                          return;
                        }
                        setNarrationStatuses(prev => ({ ...prev, [seg.id]: 'running' }));
                        try {
                          const taskId = await voiceService.generateNarrationAudio(seg.content, charWithVoice.voiceId);
                          const pollInterval = setInterval(async () => {
                            try {
                              const result = await voiceService.queryNarrationStatus(taskId);
                              if (result.status === 'done') {
                                clearInterval(pollInterval);
                                narrationPollersRef.current.delete(seg.id);
                                setNarrationStatuses(prev => ({ ...prev, [seg.id]: 'done' }));
                                if (result.audioUrl) {
                                  setNarrationUrls(prev => ({ ...prev, [seg.id]: result.audioUrl! }));
                                }
                                showToast('success', t('character.narrationGenerated'));
                              } else if (result.status === 'failed') {
                                clearInterval(pollInterval);
                                narrationPollersRef.current.delete(seg.id);
                                setNarrationStatuses(prev => ({ ...prev, [seg.id]: 'failed' }));
                                showToast('error', result.errorMessage || t('character.narrationFailed'));
                              }
                            } catch {
                              clearInterval(pollInterval);
                              narrationPollersRef.current.delete(seg.id);
                              setNarrationStatuses(prev => ({ ...prev, [seg.id]: 'failed' }));
                            }
                          }, 3000);
                          narrationPollersRef.current.set(seg.id, pollInterval);
                        } catch (e: unknown) {
                          setNarrationStatuses(prev => ({ ...prev, [seg.id]: 'failed' }));
                          showToast('error', getErrorMessage(e, t('character.narrationFailed')));
                        }
                      }}
                    >
                      {narrationStatuses[seg.id] === 'running' ? <RefreshCw size={14} className="spin" /> : <Volume2 size={14} />}
                      {narrationStatuses[seg.id] === 'running' ? t('character.generatingNarration') : t('character.generateNarration')}
                    </button>
                    {narrationUrls[seg.id] && (
                      <audio controls style={{ width: '100%', marginTop: '0.5rem', height: '32px' }} src={narrationUrls[seg.id]} />
                    )}

                    {/* BGM Section */}
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <Music size={14} style={{ color: '#f472b6' }} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f472b6' }}>{t('music.title')}</span>
                      </div>

                      {seg.bgmAudioUrl ? (
                        <div>
                          <audio controls style={{ width: '100%', height: '32px' }} src={seg.bgmAudioUrl} />
                          {seg.bgmPrompt && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                              {seg.bgmIsInstrumental ? '🎵' : '🎤'} {seg.bgmPrompt}
                            </span>
                          )}
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', marginTop: '0.3rem', color: '#f87171' }}
                            onClick={() => handleRemoveBGM(seg.id)}
                          >
                            <Trash2 size={12} /> {t('music.removeBGMBtn')}
                          </button>
                        </div>
                      ) : bgmSegmentId === seg.id ? (
                        <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(244,114,182,0.08)', border: '1px solid rgba(244,114,182,0.2)' }}>
                          {/* Mode selection */}
                          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            {(['instrumental', 'autoLyrics', 'customLyrics'] as const).map(mode => (
                              <button
                                key={mode}
                                className="btn btn-secondary"
                                style={{
                                  fontSize: '0.7rem', padding: '0.2rem 0.5rem',
                                  background: bgmMode === mode ? 'rgba(244,114,182,0.2)' : undefined,
                                  borderColor: bgmMode === mode ? '#f472b6' : undefined,
                                  color: bgmMode === mode ? '#f472b6' : undefined,
                                }}
                                onClick={() => setBgmMode(mode)}
                              >
                                {t(`music.mode${mode.charAt(0).toUpperCase() + mode.slice(1)}`)}
                              </button>
                            ))}
                          </div>

                          {/* Style presets */}
                          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                            {bgmStylePresets.map(preset => (
                              <button
                                key={preset.key}
                                className="btn btn-secondary"
                                style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}
                                onClick={() => setBgmPrompt(preset.prompt)}
                              >
                                {t(`music.style${preset.key.charAt(0).toUpperCase() + preset.key.slice(1)}`)}
                              </button>
                            ))}
                          </div>

                          {/* Prompt input */}
                          <input
                            className="form-input"
                            style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', width: '100%', marginBottom: '0.5rem' }}
                            value={bgmPrompt}
                            onChange={e => setBgmPrompt(e.target.value)}
                            placeholder={t('music.promptPlaceholder')}
                          />

                          {/* Lyrics (for autoLyrics and customLyrics modes) */}
                          {bgmMode !== 'instrumental' && (
                            <div style={{ marginBottom: '0.5rem' }}>
                              <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.3rem' }}>
                                {bgmMode === 'autoLyrics' && (
                                  <button
                                    className="btn btn-secondary"
                                    style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                    disabled={isGeneratingLyrics || !bgmPrompt.trim()}
                                    onClick={handleGenerateLyrics}
                                  >
                                    {isGeneratingLyrics ? <RefreshCw size={10} className="spin" /> : <Sparkles size={10} />}
                                    {isGeneratingLyrics ? t('music.generatingLyrics') : t('music.generateLyricsBtn')}
                                  </button>
                                )}
                              </div>
                              <textarea
                                className="form-textarea"
                                style={{ fontSize: '0.7rem', padding: '0.3rem 0.5rem', minHeight: '60px', width: '100%' }}
                                value={bgmLyrics}
                                onChange={e => setBgmLyrics(e.target.value)}
                                placeholder={t('music.lyricsPlaceholder')}
                              />
                            </div>
                          )}

                          {/* Generate & Cancel buttons */}
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className="btn btn-primary"
                              style={{ fontSize: '0.7rem', padding: '0.3rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'linear-gradient(135deg, #f472b6, #ec4899)' }}
                              disabled={isGeneratingBGM || !bgmPrompt.trim()}
                              onClick={() => handleGenerateBGM(seg.id)}
                            >
                              {isGeneratingBGM ? <RefreshCw size={12} className="spin" /> : <Music size={12} />}
                              {isGeneratingBGM ? t('music.generatingBGM') : t('music.generateBGM')}
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: '0.7rem', padding: '0.3rem 0.5rem' }}
                              onClick={() => { setBgmSegmentId(null); setBgmPrompt(''); setBgmLyrics(''); }}
                            >
                              {t('workbench.cancelBtn')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                          onClick={() => { setBgmSegmentId(seg.id); setBgmMode('instrumental'); setBgmPrompt(''); setBgmLyrics(''); }}
                        >
                          <Music size={14} /> {t('music.generateBGM')}
                        </button>
                      )}
                    </div>
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
