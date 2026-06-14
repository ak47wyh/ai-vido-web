import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../adapters/outbound/repositories/DexieDatabase';
import { storyService, videoGenerationService, imageAdapter, voiceService, musicService, textGenerationService, pipelineService } from '../../dependencies';
import { Spline, Sparkles, AlertTriangle, ImagePlus, PlayCircle, Film } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { VideoTask, Character } from '../../domain/entities/models';
import type { CharacterDraft, BackgroundDraft, BreakdownSegmentDraft, ImageGenerationContext, VideoModel, VideoResolution, VideoGenerationMode, MusicModel } from '../../domain/ports/OutboundPorts';
import { useSpace } from '../contexts/SpaceContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { getErrorMessage } from '../utils/errorUtils';
import { StoryListPanel } from '../components/StoryListPanel';
import { BreakdownPreview } from '../components/BreakdownPreview';
import { SegmentCard } from '../components/SegmentCard';

export const StoryWorkbench: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentSpaceId } = useSpace();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const stories = useLiveQuery(() => currentSpaceId ? db.stories.where('spaceId').equals(currentSpaceId).toArray() : [], [currentSpaceId]);
  const backgrounds = useLiveQuery(() => currentSpaceId ? db.backgrounds.where('spaceId').equals(currentSpaceId).toArray() : [], [currentSpaceId]);
  const characters = useLiveQuery(() => currentSpaceId ? db.characters.where('spaceId').equals(currentSpaceId).toArray() : [], [currentSpaceId]);

  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(() => {
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
  const [bgmSegmentId, setBgmSegmentId] = useState<string | null>(null);
  const [bgmPrompt, setBgmPrompt] = useState('');
  const [bgmMode, setBgmMode] = useState<'instrumental' | 'autoLyrics' | 'customLyrics' | 'cover'>('instrumental');
  const [bgmLyrics, setBgmLyrics] = useState('');
  const [bgmModel, setBgmModel] = useState<'music-2.6' | 'music-2.6-free' | 'music-cover' | 'music-cover-free'>('music-2.6');
  const [bgmCoverAudioUrl, setBgmCoverAudioUrl] = useState('');
  const [isGeneratingBGM, setIsGeneratingBGM] = useState(false);
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [refiningStoryText, setRefiningStoryText] = useState(false);
  const [refiningDraftCharField, setRefiningDraftCharField] = useState<{ index: number; field: string } | null>(null);
  const [refiningDraftBgField, setRefiningDraftBgField] = useState<{ index: number; field: string } | null>(null);
  const [suggestingBGMStyle, setSuggestingBGMStyle] = useState(false);

  const [videoMode, setVideoMode] = useState<VideoGenerationMode>('t2v');
  const [videoModel, setVideoModel] = useState<VideoModel>('T2V-01-Director');
  const [videoResolution, setVideoResolution] = useState<VideoResolution>('768P');
  const [videoDuration, setVideoDuration] = useState<6 | 10>(6);
  const [videoPromptOptimizer, setVideoPromptOptimizer] = useState(true);
  const [isAssembling, setIsAssembling] = useState(false);
  const [assembleProgress, setAssembleProgress] = useState<{ percent: number; message: string } | null>(null);

  const narrationPollersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  useEffect(() => {
    const currentPollers = narrationPollersRef.current;
    return () => {
      for (const [, interval] of currentPollers) {
        clearInterval(interval);
      }
      currentPollers.clear();
    };
  }, []);

  const clearNarrationState = () => {
    for (const [, interval] of narrationPollersRef.current) {
      clearInterval(interval);
    }
    narrationPollersRef.current.clear();
    setNarrationStatuses({});
    setNarrationUrls({});
  };

  const clearBGMState = () => {
    setBgmSegmentId(null);
    setBgmPrompt('');
    setBgmLyrics('');
    setBgmMode('instrumental');
  };

  const switchStory = useCallback((storyId: string | null) => {
    if (storyId !== selectedStoryId) {
      clearNarrationState();
      clearBGMState();
    }
    setSelectedStoryId(storyId);
  }, [selectedStoryId]);

  const segments = useLiveQuery(
    () => selectedStoryId ? db.segments.where('storyId').equals(selectedStoryId).toArray() : [],
    [selectedStoryId], []
  );

  const segmentIds = useMemo(() => (segments || []).map(s => s.id), [segments]);
  const videoTasks = useLiveQuery(
    () => segmentIds.length > 0 ? db.videoTasks.where('segmentId').anyOf(segmentIds).toArray() : [],
    [segmentIds]
  );

  const sortedSegments = useMemo(
    () => [...(segments || [])].sort((a, b) => a.sequenceOrder - b.sequenceOrder),
    [segments]
  );

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

  const characterMap = useMemo(() => {
    const map = new Map<string, Character>();
    if (!characters) return map;
    for (const c of characters) {
      map.set(c.id, c);
    }
    return map;
  }, [characters]);

  const selectedStory = useMemo(
    () => stories?.find(s => s.id === selectedStoryId) ?? null,
    [stories, selectedStoryId]
  );

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

  // ---- Story CRUD handlers ----

  const handleCreateStory = async () => {
    if (!currentSpaceId) return;
    setIsSplitting(true);
    let createdStoryId: string | null = null;
    try {
      const story = await storyService.createStory('', '', currentSpaceId);
      createdStoryId = story.id;
      switchStory(story.id);
      await storyService.splitStory(story.id);
    } catch (e) {
      console.error(e);
      if (createdStoryId) {
        try { await storyService.deleteStory(createdStoryId); } catch { /* rollback */ }
        switchStory(null);
      }
      showToast('error', t('workbench.splitFailed'));
    } finally {
      setIsSplitting(false);
    }
  };

  const handleCreateAndBreakdown = async () => {
    if (!currentSpaceId) return;
    setIsBreakingDown(true);
    setDraftCharacters([]);
    setDraftBackgrounds([]);
    setDraftSegments([]);
    setShowBreakdownPreview(false);
    setConfirmedCharIndices(new Set());
    setConfirmedBgIndices(new Set());
    let createdStoryId: string | null = null;
    try {
      const story = await storyService.createStory('', '', currentSpaceId);
      createdStoryId = story.id;
      switchStory(story.id);
      const result = await storyService.previewBreakdown(story.id);
      setDraftCharacters(result.characters);
      setDraftBackgrounds(result.backgrounds);
      setDraftSegments(result.segments);
      setShowBreakdownPreview(true);
    } catch (e) {
      console.error(e);
      if (createdStoryId) {
        try { await storyService.deleteStory(createdStoryId); } catch { /* rollback */ }
        switchStory(null);
      }
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

  // ---- Breakdown draft handlers ----

  const updateDraftCharacter = (index: number, field: keyof CharacterDraft, value: string) => {
    setDraftCharacters(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
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

  // ---- Video generation handlers ----

  const handleSelectBackground = async (segmentId: string, bgId: string) => {
    await storyService.updateSegmentBackground(segmentId, bgId);
  };

  const handleGenerateVideo = async (segmentId: string) => {
    if (!selectedStoryId) return;
    try {
      await videoGenerationService.generateVideo(segmentId, selectedStoryId, 'MINIMAX', {
        mode: videoMode, model: videoModel, resolution: videoResolution,
        duration: videoDuration, promptOptimizer: videoPromptOptimizer,
      });
    } catch (e: unknown) {
      showToast('error', getErrorMessage(e));
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
        if (!ok) { setIsBatchGenerating(false); return; }
      }

      let successCount = 0, failCount = 0;
      for (const seg of eligible) {
        try {
          await videoGenerationService.generateVideo(seg.id, selectedStoryId, 'MINIMAX', {
            mode: videoMode, model: videoModel, resolution: videoResolution,
            duration: videoDuration, promptOptimizer: videoPromptOptimizer,
          });
          successCount++;
        } catch {
          failCount++;
        }
      }
      if (successCount > 0) showToast('info', t('workbench.batchStarted', { count: successCount }));
      if (failCount > 0) showToast('warning', t('workbench.batchPartialFailed', { count: failCount }));
      if (successCount === 0 && failCount === 0) showToast('warning', t('workbench.batchNoEligible'));
    } catch (e: unknown) {
      showToast('error', getErrorMessage(e));
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
      showToast('error', getErrorMessage(e));
    }
  };

  const handleAssembleFinalVideo = async () => {
    if (!selectedStoryId) return;
    setIsAssembling(true);
    setAssembleProgress({ percent: 0, message: '初始化合成任务...' });
    try {
      await pipelineService.assembleFinalVideo(selectedStoryId, narrationUrls, (percent, message) => {
        setAssembleProgress({ percent, message });
      });
      showToast('success', t('workbench.assembleSuccess', '合成成功，已保存至导出中心！'));
      navigate('/export');
    } catch (e: unknown) {
      showToast('error', getErrorMessage(e, t('workbench.assembleFailed', '合成失败')));
    } finally {
      setIsAssembling(false);
      setAssembleProgress(null);
    }
  };

  // ---- Narration handlers ----

  const handleGenerateNarration = async (segmentId: string, content: string, characterIds: string[]) => {
    const charWithVoice = characterIds
      .map(id => characters?.find(c => c.id === id))
      .find(c => c?.voiceId);
    if (!charWithVoice?.voiceId) {
      showToast('warning', t('character.noVoice'));
      return;
    }
    setNarrationStatuses(prev => ({ ...prev, [segmentId]: 'running' }));
    try {
      const result = await voiceService.generateNarrationAudio(content, charWithVoice.voiceId);
      if (result.audioUrl) {
        setNarrationStatuses(prev => ({ ...prev, [segmentId]: 'done' }));
        setNarrationUrls(prev => ({ ...prev, [segmentId]: result.audioUrl! }));
        showToast('success', t('character.narrationGenerated'));
      } else if (result.taskId) {
        let pollRetries = 0;
        const maxPollRetries = 60;
        const pollInterval = setInterval(async () => {
          try {
            pollRetries++;
            const pollResult = await voiceService.queryNarrationStatus(result.taskId!);
            if (pollResult.status === 'done') {
              clearInterval(pollInterval);
              narrationPollersRef.current.delete(segmentId);
              setNarrationStatuses(prev => ({ ...prev, [segmentId]: 'done' }));
              if (pollResult.audioUrl) {
                setNarrationUrls(prev => ({ ...prev, [segmentId]: pollResult.audioUrl! }));
              }
              showToast('success', t('character.narrationGenerated'));
            } else if (pollResult.status === 'failed') {
              clearInterval(pollInterval);
              narrationPollersRef.current.delete(segmentId);
              setNarrationStatuses(prev => ({ ...prev, [segmentId]: 'failed' }));
              showToast('error', pollResult.errorMessage || t('character.narrationFailed'));
            } else if (pollRetries >= maxPollRetries) {
              clearInterval(pollInterval);
              narrationPollersRef.current.delete(segmentId);
              setNarrationStatuses(prev => ({ ...prev, [segmentId]: 'failed' }));
              showToast('error', t('character.narrationFailed'));
            }
          } catch {
            clearInterval(pollInterval);
            narrationPollersRef.current.delete(segmentId);
            setNarrationStatuses(prev => ({ ...prev, [segmentId]: 'failed' }));
          }
        }, 3000);
        narrationPollersRef.current.set(segmentId, pollInterval);
      }
    } catch (e: unknown) {
      setNarrationStatuses(prev => ({ ...prev, [segmentId]: 'failed' }));
      showToast('error', getErrorMessage(e, t('character.narrationFailed')));
    }
  };

  // ---- BGM handlers ----

  const handleGenerateBGM = async (segmentId: string) => {
    if (!bgmPrompt.trim()) {
      showToast('warning', t('music.promptLabel'));
      return;
    }
    setIsGeneratingBGM(true);
    try {
      if (bgmMode === 'cover') {
        if (!bgmCoverAudioUrl.trim()) {
          showToast('warning', t('music.coverAudioRequired'));
          return;
        }
        await musicService.generateCoverBGM(segmentId, bgmCoverAudioUrl.trim(), bgmPrompt.trim(), {
          lyrics: bgmLyrics || undefined, model: bgmModel,
        });
      } else {
        const options: { isInstrumental?: boolean; lyrics?: string; lyricsOptimizer?: boolean; model?: MusicModel } = { model: bgmModel };
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
      }
      showToast('success', t('music.bgmGenerated'));
      setBgmSegmentId(null);
      setBgmPrompt('');
      setBgmLyrics('');
      setBgmCoverAudioUrl('');
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

  // ---- AI Refine handlers (for StoryListPanel) ----

  const handleRefineStoryText = async (text: string): Promise<string> => {
    setRefiningStoryText(true);
    try {
      const result = await textGenerationService.refineText(text);
      showToast('success', t('textAI.textRefined'));
      return result.content;
    } catch (e) {
      showToast('error', getErrorMessage(e, t('textAI.promptRefineFailed')));
      return text;
    } finally {
      setRefiningStoryText(false);
    }
  };

  // ---- AI Refine handlers (for BreakdownPreview) ----

  const handleRefineCharAppearance = async (index: number, prompt: string) => {
    setRefiningDraftCharField({ index, field: 'appearance' });
    try {
      const result = await textGenerationService.refinePrompt(prompt, 'character_appearance');
      updateDraftCharacter(index, 'appearancePrompt', result.content);
      showToast('success', t('textAI.promptRefined'));
    } catch (e) {
      showToast('error', getErrorMessage(e, t('textAI.promptRefineFailed')));
    } finally {
      setRefiningDraftCharField(null);
    }
  };

  const handleRefineCharPersonality = async (index: number, prompt: string) => {
    setRefiningDraftCharField({ index, field: 'personality' });
    try {
      const result = await textGenerationService.refinePrompt(prompt, 'character_personality');
      updateDraftCharacter(index, 'personalityPrompt', result.content);
      showToast('success', t('textAI.promptRefined'));
    } catch (e) {
      showToast('error', getErrorMessage(e, t('textAI.promptRefineFailed')));
    } finally {
      setRefiningDraftCharField(null);
    }
  };

  const handleRefineBackground = async (index: number, prompt: string) => {
    setRefiningDraftBgField({ index, field: 'environment' });
    try {
      const result = await textGenerationService.refinePrompt(prompt, 'background');
      updateDraftBackground(index, 'environmentPrompt', result.content);
      showToast('success', t('textAI.promptRefined'));
    } catch (e) {
      showToast('error', getErrorMessage(e, t('textAI.promptRefineFailed')));
    } finally {
      setRefiningDraftBgField(null);
    }
  };

  // ---- Draft image generation handlers ----

  const handleGenerateCharDraftImage = async (index: number, context: ImageGenerationContext) => {
    setGeneratingDraftCharImageIndices(prev => new Set(prev).add(index));
    try {
      const result = await imageAdapter.generateImage(context);
      setDraftCharacters(prev => {
        const next = [...prev];
        next[index] = { ...next[index], referenceImageUrl: result.imageDataUri || result.imageUrls?.[0] };
        return next;
      });
      showToast('success', t('workbench.draftImageGenerated'));
    } catch (e: unknown) {
      showToast('error', getErrorMessage(e, t('workbench.breakdownApplyFailed')));
    } finally {
      setGeneratingDraftCharImageIndices(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  const handleGenerateBgDraftImage = async (index: number, context: ImageGenerationContext) => {
    setGeneratingDraftBgImageIndices(prev => new Set(prev).add(index));
    try {
      const result = await imageAdapter.generateImage(context);
      setDraftBackgrounds(prev => {
        const next = [...prev];
        next[index] = { ...next[index], referenceImageUrl: result.imageDataUri || result.imageUrls?.[0] };
        return next;
      });
      showToast('success', t('workbench.draftImageGenerated'));
    } catch (e: unknown) {
      showToast('error', getErrorMessage(e, t('workbench.breakdownApplyFailed')));
    } finally {
      setGeneratingDraftBgImageIndices(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  // ---- BGM Style suggestion ----

  const handleSuggestBGMStyle = async (segmentContent: string) => {
    setSuggestingBGMStyle(true);
    try {
      const result = await textGenerationService.suggestBGMStyle(segmentContent);
      setBgmPrompt(result.content);
      showToast('success', t('textAI.bgmStyleSuggested'));
    } catch (e) {
      showToast('error', getErrorMessage(e, t('textAI.promptRefineFailed')));
    } finally {
      setSuggestingBGMStyle(false);
    }
  };

  // ---- Derived UI state ----

  const hasCharacters = (characters?.length ?? 0) > 0;
  const hasBackgrounds = (backgrounds?.length ?? 0) > 0;

  return (
    <div style={{ display: 'flex', gap: '2rem', height: '100%', flexWrap: 'wrap' }}>
      <StoryListPanel
        stories={stories}
        selectedStoryId={selectedStoryId}
        isSplitting={isSplitting}
        isBreakingDown={isBreakingDown}
        refiningStoryText={refiningStoryText}
        onSwitchStory={switchStory}
        onCreateStory={handleCreateStory}
        onCreateAndBreakdown={handleCreateAndBreakdown}
        onQuickSplit={handleQuickSplit}
        onDeleteStory={handleDeleteStory}
        onRefineStoryText={handleRefineStoryText}
      />

      <div className="glass-panel" style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div className="page-header" style={{ marginBottom: '1.5rem' }}>
          <h2>{t('workbench.segmentsTitle')}</h2>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {selectedStory && (
              <>
                <button className="btn btn-secondary" onClick={handleReSplit} disabled={isSplitting}>
                  <Spline size={16} /> {isSplitting ? t('workbench.splitting') : t('workbench.reSplitBtn')}
                </button>
                <button className="btn btn-primary" onClick={handleReBreakdown} disabled={isBreakingDown}
                  style={{ background: 'linear-gradient(135deg, #6366f1, #ec4899)' }}>
                  <Sparkles size={16} />
                  {isBreakingDown ? t('workbench.breakingDown') : t('workbench.reBreakdownBtn')}
                </button>
              </>
            )}
          </div>
        </div>

        {showBreakdownPreview && (draftCharacters.length > 0 || draftBackgrounds.length > 0) && (
          <BreakdownPreview
          draftCharacters={draftCharacters}
          draftBackgrounds={draftBackgrounds}
          confirmedCharIndices={confirmedCharIndices}
          confirmedBgIndices={confirmedBgIndices}
          generatingDraftCharImageIndices={generatingDraftCharImageIndices}
          generatingDraftBgImageIndices={generatingDraftBgImageIndices}
          refiningDraftCharField={refiningDraftCharField}
          refiningDraftBgField={refiningDraftBgField}
          isApplyingBreakdown={isApplyingBreakdown}
          onUpdateDraftCharacter={updateDraftCharacter}
          onRemoveDraftCharacter={removeDraftCharacter}
          onToggleConfirmChar={(i) => {
            setConfirmedCharIndices(prev => {
              const next = new Set(prev);
              if (next.has(i)) next.delete(i); else next.add(i);
              return next;
            });
          }}
          onToggleConfirmAllChars={() => {
            if (confirmedCharIndices.size === draftCharacters.length) {
              setConfirmedCharIndices(new Set());
            } else {
              setConfirmedCharIndices(new Set(draftCharacters.map((_, i) => i)));
            }
          }}
          onUpdateDraftBackground={updateDraftBackground}
          onRemoveDraftBackground={removeDraftBackground}
          onToggleConfirmBg={(i) => {
            setConfirmedBgIndices(prev => {
              const next = new Set(prev);
              if (next.has(i)) next.delete(i); else next.add(i);
              return next;
            });
          }}
          onToggleConfirmAllBgs={() => {
            if (confirmedBgIndices.size === draftBackgrounds.length) {
              setConfirmedBgIndices(new Set());
            } else {
              setConfirmedBgIndices(new Set(draftBackgrounds.map((_, i) => i)));
            }
          }}
          onGenerateCharImage={handleGenerateCharDraftImage}
          onGenerateBgImage={handleGenerateBgDraftImage}
          onRefineCharAppearance={handleRefineCharAppearance}
          onRefineCharPersonality={handleRefineCharPersonality}
          onRefineBackground={handleRefineBackground}
          onApplyBreakdown={handleApplyBreakdown}
          onCloseBreakdownPreview={handleCloseBreakdownPreview}
        />)}

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
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }}
              onClick={() => navigate(hasCharacters ? '/backgrounds' : '/characters')}>
              {hasCharacters ? t('workbench.goBackgrounds') : t('workbench.goCharacters')}
            </button>
          </div>
        )}

        {progressStats && progressStats.total > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('workbench.progress')}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                {progressStats.success}/{progressStats.total} {t('workbench.completed')}
              </span>
            </div>
            <div style={{ height: '6px', borderRadius: '3px', background: 'var(--border-color)', overflow: 'hidden', display: 'flex' }}>
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

        {selectedStory && sortedSegments.length > 0 && (
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select className="form-select" style={{ width: '160px', padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
                value={batchBgId} onChange={e => setBatchBgId(e.target.value)}>
                <option value="">{t('workbench.batchBgPlaceholder')}</option>
                {backgrounds?.map(bg => (
                  <option key={bg.id} value={bg.id}>{bg.name}</option>
                ))}
              </select>
              <button className="btn btn-secondary" disabled={!batchBgId} onClick={handleBatchSetBackground}
                style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}>
                <ImagePlus size={14} /> {t('workbench.batchBgBtn')}
              </button>
            </div>
            <button className="btn btn-primary" onClick={handleBatchGenerate}
              disabled={isBatchGenerating || !hasBackgrounds}>
              <PlayCircle size={16} />
              {isBatchGenerating ? t('workbench.batchGenerating') : t('workbench.batchGenerateBtn')}
            </button>
            <button className="btn btn-primary" onClick={handleAssembleFinalVideo}
              disabled={isAssembling || progressStats?.success !== progressStats?.total}
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}>
              <Film size={16} />
              {isAssembling ? (assembleProgress?.message || t('workbench.assembling', '合成中...')) : t('workbench.assembleBtn', '一键合成导出')}
            </button>
          </div>
        )}

        {selectedStory && sortedSegments.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('workbench.videoConfig')}</span>
            <select className="form-select" style={{ width: '100px', fontSize: '0.75rem' }}
              value={videoMode} onChange={e => setVideoMode(e.target.value as VideoGenerationMode)}>
              <option value="t2v">{t('video.modeT2V')}</option>
              <option value="fl2v">{t('video.modeFL2V')}</option>
              <option value="s2v">{t('video.modeS2V')}</option>
            </select>
            {videoMode === 't2v' && (
              <select className="form-select" style={{ width: '140px', fontSize: '0.75rem' }}
                value={videoModel} onChange={e => setVideoModel(e.target.value as VideoModel)}>
                <option value="MiniMax-Hailuo-2.3">Hailuo 2.3</option>
                <option value="MiniMax-Hailuo-02">Hailuo 02</option>
                <option value="T2V-01-Director">T2V-01 Director</option>
                <option value="T2V-01">T2V-01</option>
              </select>
            )}
            <select className="form-select" style={{ width: '70px', fontSize: '0.75rem' }}
              value={videoResolution} onChange={e => setVideoResolution(e.target.value as VideoResolution)}>
              <option value="768P">768P</option>
              <option value="1080P">1080P</option>
            </select>
            <select className="form-select" style={{ width: '60px', fontSize: '0.75rem' }}
              value={videoDuration} onChange={e => setVideoDuration(Number(e.target.value) as 6 | 10)}>
              <option value={6}>6s</option>
              <option value={10}>10s</option>
            </select>
            <label style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={videoPromptOptimizer} onChange={e => setVideoPromptOptimizer(e.target.checked)}
                style={{ width: '12px', height: '12px' }} />
              {t('video.promptOptimizer')}
            </label>
          </div>
        )}

        {!selectedStoryId ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>{t('workbench.selectStory')}</p>
        ) : sortedSegments.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>{t('workbench.noSegments')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {sortedSegments.map((seg, idx) => (
              <SegmentCard
                key={seg.id}
                segment={seg}
                index={idx}
                task={latestTaskMap.get(seg.id)}
                characterMap={characterMap}
                backgrounds={backgrounds}
                narrationStatus={narrationStatuses[seg.id]}
                narrationUrl={narrationUrls[seg.id]}
                isBGMEditing={bgmSegmentId === seg.id}
                bgmPrompt={bgmPrompt}
                bgmMode={bgmMode}
                bgmLyrics={bgmLyrics}
                bgmModel={bgmModel}
                bgmCoverAudioUrl={bgmCoverAudioUrl}
                isGeneratingBGM={isGeneratingBGM}
                isGeneratingLyrics={isGeneratingLyrics}
                suggestingBGMStyle={suggestingBGMStyle}
                onSelectBackground={handleSelectBackground}
                onGenerateVideo={handleGenerateVideo}
                onGenerateNarration={handleGenerateNarration}
                onRemoveBGM={handleRemoveBGM}
                onBGMEditStart={() => { setBgmSegmentId(seg.id); setBgmMode('instrumental'); setBgmPrompt(''); setBgmLyrics(''); }}
                onBGMEditCancel={() => { setBgmSegmentId(null); setBgmPrompt(''); setBgmLyrics(''); }}
                onBgmPromptChange={setBgmPrompt}
                onBgmModeChange={setBgmMode}
                onBgmModelChange={setBgmModel}
                onBgmLyricsChange={setBgmLyrics}
                onBgmCoverAudioUrlChange={setBgmCoverAudioUrl}
                onGenerateBGM={() => handleGenerateBGM(seg.id)}
                onGenerateLyrics={handleGenerateLyrics}
                onSuggestBGMStyle={handleSuggestBGMStyle}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};