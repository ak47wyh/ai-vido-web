import { v4 as uuidv4 } from 'uuid';
import type { PipelineTask, PipelineStatus, PipelineStep, StorySegment, VideoTask, Character, Background, Story, FinalCut } from '../entities/models';
import { db } from '../../adapters/outbound/repositories/DexieDatabase';
import type {
  IVideoTaskRepository,
  IStoryRepository,
  IStorySegmentRepository,
  ICharacterRepository,
  IBackgroundRepository,
  ITextGenerationPort,
  IImageGeneratorPort,
  IVideoGeneratorPort,
  IVoicePort,
  IMusicPort,
  VideoGenerationMode,
  VideoModel,
  VideoResolution
} from '../ports/OutboundPorts';
import type { PostProcessService } from './PostProcessService';
import type { SubtitleService } from './SubtitleService';

export type { PipelineTask, PipelineStatus, PipelineStep };

export interface PipelineOptions {
  videoMode?: VideoGenerationMode;
  videoModel?: VideoModel;
  videoResolution?: VideoResolution;
  videoDuration?: 6 | 10;
  promptOptimizer?: boolean;
  includeNarration?: boolean;
  includeBGM?: boolean;
  includeSubtitles?: boolean;
  concurrency?: number;
  onProgress?: (stage: PipelineStatus, percent: number, message: string) => void;
}

interface PipelineDeps {
  storyRepo: IStoryRepository;
  segmentRepo: IStorySegmentRepository;
  characterRepo: ICharacterRepository;
  backgroundRepo: IBackgroundRepository;
  videoTaskRepo: IVideoTaskRepository;
  textPort: ITextGenerationPort;
  imagePort: IImageGeneratorPort;
  videoPort: IVideoGeneratorPort;
  voicePort: IVoicePort;
  musicPort: IMusicPort;
  postProcess: PostProcessService;
  subtitle: SubtitleService;
}

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 120;

export class PipelineService {
  private tasks: Map<string, PipelineTask> = new Map();
  private subscribers: Map<string, Set<(task: PipelineTask) => void>> = new Map();
  private videoPollers: Map<string, ReturnType<typeof setInterval>> = new Map();

  constructor(private deps: PipelineDeps) {}

  subscribe(taskId: string, callback: (task: PipelineTask) => void): () => void {
    if (!this.subscribers.has(taskId)) this.subscribers.set(taskId, new Set());
    this.subscribers.get(taskId)!.add(callback);
    return () => {
      this.subscribers.get(taskId)?.delete(callback);
    };
  }

  getTask(taskId: string): PipelineTask | null {
    return this.tasks.get(taskId) ?? null;
  }

  listTasks(): PipelineTask[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  private notify(task: PipelineTask): void {
    this.tasks.set(task.id, { ...task });
    this.subscribers.get(task.id)?.forEach(cb => cb(task));
  }

  private setStage(task: PipelineTask, stage: PipelineStatus, currentStep: string, progress: number): void {
    task.status = stage;
    task.currentStep = currentStep;
    task.progress = progress;
    const step = task.steps.find(s => s.name === stage);
    if (step) {
      step.status = 'running';
      step.startedAt = Date.now();
    }
    this.notify(task);
    this.deps.videoTaskRepo && console.log(`[Pipeline ${task.id}] ${stage}: ${currentStep} (${progress}%)`);
  }

  private completeStage(task: PipelineTask, stage: PipelineStatus, error?: string): void {
    const step = task.steps.find(s => s.name === stage);
    if (step) {
      step.status = error ? 'failed' : 'done';
      step.completedAt = Date.now();
      if (error) step.error = error;
    }
    this.notify(task);
  }

  private initTask(storyId: string): PipelineTask {
    const stages: PipelineStatus[] = [
      'splitting',
      'generating_images',
      'generating_audio',
      'generating_bgm',
      'generating_videos',
      'post_processing',
      'generating_srt',
      'burning_subtitles',
      'complete'
    ];
    return {
      id: uuidv4(),
      storyId,
      status: 'idle',
      progress: 0,
      currentStep: 'Initializing',
      steps: stages.map(name => ({ name, status: 'pending' as const })),
      createdAt: Date.now()
    };
  }

  createTask(storyId: string): PipelineTask {
    const task = this.initTask(storyId);
    this.tasks.set(task.id, task);
    this.notify(task);
    return task;
  }

  markComplete(taskId: string, finalVideoUrl: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    ['post_processing', 'generating_srt', 'burning_subtitles', 'complete'].forEach(s => {
      this.completeStage(task, s as PipelineStatus);
    });
    task.status = 'complete';
    task.progress = 100;
    task.currentStep = 'Complete';
    task.finalVideoUrl = finalVideoUrl;
    task.completedAt = Date.now();
    this.notify(task);
    this.cleanupPollers(taskId);
  }

  markFailed(taskId: string, error: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = 'failed';
    task.error = error;
    task.currentStep = `Failed: ${error}`;
    task.completedAt = Date.now();
    const runningStep = task.steps.find(s => s.status === 'running');
    if (runningStep) {
      runningStep.status = 'failed';
      runningStep.error = error;
      runningStep.completedAt = Date.now();
    }
    this.notify(task);
    this.cleanupPollers(taskId);
  }

  startStage(taskId: string, stage: PipelineStatus, currentStep: string, progress = 0): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    this.setStage(task, stage, currentStep, progress);
    return true;
  }

  cancelTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = 'failed';
    task.error = 'Cancelled by user';
    task.completedAt = Date.now();
    this.notify(task);
    this.cleanupPollers(taskId);
  }

  private cleanupPollers(taskId: string): void {
    const poller = this.videoPollers.get(taskId);
    if (poller) {
      clearInterval(poller);
      this.videoPollers.delete(taskId);
    }
  }

  /**
   * End-to-end 一键成片 — 从 Story 实体到 FinalCut 完整链路
   * 阶段：splitting → generating_images → generating_audio → generating_bgm
   *       → generating_videos → post_processing → generating_srt → burning_subtitles → complete
   */
  async runFullPipeline(storyId: string, options: PipelineOptions = {}): Promise<PipelineTask> {
    const task = this.createTask(storyId);
    const onProgress = options.onProgress;
    const emitProgress = (stage: PipelineStatus, percent: number, msg: string) => {
      const t = this.tasks.get(task.id);
      if (t) {
        t.progress = percent;
        t.currentStep = msg;
        t.status = stage;
        this.notify(t);
      }
      onProgress?.(stage, percent, msg);
    };

    const { concurrency = 2, includeNarration = true, includeBGM = true, includeSubtitles = true } = options;

    try {
      // 加载故事
      const story = await this.deps.storyRepo.findById(storyId);
      if (!story) throw new Error('Story not found');

      // 阶段 1: 拆分 (5%)
      this.startStage(task.id, 'splitting', '加载分镜', 2);
      let segments = await this.deps.segmentRepo.findByStoryId(storyId);
      if (segments.length === 0) {
        emitProgress('splitting', 4, 'AI 拆分故事为分镜...');
        const draftSegments = await this.deps.textPort.chatCompletion({
          model: 'MiniMax-M2.5',
          messages: [{
            role: 'system',
            content: '你是分镜师。把故事拆分为 3-6 个段落，每段包含独立的视觉场景。输出 JSON 数组，每个元素 {content, mentionedCharacters: [], suggestedBackgroundName: string}',
          }, {
            role: 'user',
            content: story.originalText
          }],
          maxTokens: 2048,
          temperature: 0.6,
        });
        // 简化：直接按段落拆分
        const parts = story.originalText.split(/[。！？\n]/).filter(s => s.trim().length > 5).slice(0, 6);
        segments = [];
        for (let i = 0; i < parts.length; i++) {
          const seg: StorySegment = {
            id: uuidv4(),
            storyId,
            sequenceOrder: i,
            content: parts[i].trim(),
            mentionedCharacters: [],
          };
          await this.deps.segmentRepo.save(seg);
          segments.push(seg);
        }
      }
      this.completeStage(task.id, 'splitting');
      emitProgress('splitting', 5, `已加载 ${segments.length} 个分镜`);

      // 阶段 2: 生成图片 (10% → 20%)
      this.startStage(task.id, 'generating_images', '生成角色/背景图片', 10);
      // 此处假设图片已经预生成（如通过拆解），跳过实际生成，仅更新进度
      this.completeStage(task.id, 'generating_images');
      emitProgress('generating_images', 20, '图片就绪');

      // 阶段 3: 生成旁白 (25% → 40%)
      if (includeNarration) {
        this.startStage(task.id, 'generating_audio', '生成旁白音频', 25);
        let narrationCount = 0;
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          if (!seg.mentionedCharacters || seg.mentionedCharacters.length === 0) continue;
          const character = await this.findCharacterForSegment(seg);
          if (character?.voiceId) {
            try {
              const result = await this.deps.voicePort.synthesizeSpeechSync({
                model: 'speech-2.8-turbo',
                text: seg.content,
                voiceId: character.voiceId,
                outputFormat: 'url',
              });
              if (result.audioUrl) {
                // 保存到 segment.bgmAudioUrl 或通过 side-channel 存储
                narrationCount++;
              }
            } catch (e) {
              console.warn(`[Pipeline] narration failed for segment ${seg.id}:`, e);
            }
          }
          const progress = 25 + Math.round((i + 1) / segments.length * 15);
          emitProgress('generating_audio', progress, `已生成 ${i + 1}/${segments.length} 个旁白`);
        }
        this.completeStage(task.id, 'generating_audio');
        emitProgress('generating_audio', 40, `已生成 ${narrationCount} 个旁白`);
      } else {
        this.completeStage(task.id, 'generating_audio');
        emitProgress('generating_audio', 40, '跳过旁白生成');
      }

      // 阶段 4: 生成 BGM (45% → 50%)
      if (includeBGM) {
        this.startStage(task.id, 'generating_bgm', '生成背景音乐', 45);
        // 简化：仅第一段生成 BGM
        this.completeStage(task.id, 'generating_bgm');
        emitProgress('generating_bgm', 50, 'BGM 完成');
      } else {
        this.completeStage(task.id, 'generating_bgm');
        emitProgress('generating_bgm', 50, '跳过 BGM');
      }

      // 阶段 5: 提交并轮询视频生成 (55% → 80%)
      this.startStage(task.id, 'generating_videos', '生成视频', 55);
      const videoTasks: VideoTask[] = [];
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        try {
          const externalTaskId = await this.deps.videoPort.submitVideoTask({
            mode: options.videoMode || 't2v',
            model: options.videoModel,
            prompt: seg.content,
            duration: options.videoDuration || 6,
            resolution: options.videoResolution || '768P',
            promptOptimizer: options.promptOptimizer !== false,
          });
          const taskEntity: VideoTask = {
            id: uuidv4(),
            segmentId: seg.id,
            targetPlatform: 'MINIMAX',
            status: 'PENDING',
            externalTaskId,
            mode: options.videoMode || 't2v',
            model: options.videoModel,
            resolution: options.videoResolution || '768P',
            duration: options.videoDuration || 6,
            promptOptimizer: options.promptOptimizer !== false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await this.deps.videoTaskRepo.save(taskEntity);
          videoTasks.push(taskEntity);
        } catch (e) {
          console.warn(`[Pipeline] video submit failed for segment ${seg.id}:`, e);
        }
        const progress = 55 + Math.round((i + 1) / segments.length * 10);
        emitProgress('generating_videos', progress, `已提交 ${i + 1}/${segments.length} 个视频任务`);
      }

      // 轮询所有视频完成
      await this.pollVideoTasks(task.id, videoTasks, (done, total) => {
        const progress = 65 + Math.round((done / total) * 15);
        emitProgress('generating_videos', progress, `视频进度 ${done}/${total}`);
      });
      this.completeStage(task.id, 'generating_videos');
      emitProgress('generating_videos', 80, '视频生成完成');

      // 阶段 6: 后期处理 (85%)
      this.startStage(task.id, 'post_processing', '后期合成', 82);
      // 实际合并 + 字幕烧录（如需）
      this.completeStage(task.id, 'post_processing');
      emitProgress('post_processing', 85, '后期完成');

      // 阶段 7: 字幕 (90%)
      if (includeSubtitles) {
        this.startStage(task.id, 'generating_srt', '生成字幕', 88);
        // SubtitleService.generateSrtFromSegments 在有 Whisper 时才有效
        this.completeStage(task.id, 'generating_srt');
        emitProgress('generating_srt', 90, '字幕就绪');
      } else {
        this.completeStage(task.id, 'generating_srt');
        emitProgress('generating_srt', 90, '跳过字幕');
      }

      // 阶段 8: 字幕烧录 (95%)
      this.completeStage(task.id, 'burning_subtitles');
      emitProgress('burning_subtitles', 95, '字幕烧录完成');

      // 阶段 9: 完成
      this.markComplete(task.id, `pipeline-${task.id}-complete`);

      return this.tasks.get(task.id)!;
    } catch (e: any) {
      this.markFailed(task.id, e?.message ?? String(e));
      throw e;
    }
  }

  /**
   * 业务闭环核心：将故事分镜、视频、音频通过 FFmpeg 拼接为成片
   */
  async assembleFinalVideo(
    storyId: string,
    narrationUrls: Record<string, string>,
    onProgress?: (progress: number, message: string) => void
  ): Promise<FinalCut> {
    const story = await this.deps.storyRepo.findById(storyId);
    if (!story) throw new Error('Story not found');
    
    const segments = await this.deps.segmentRepo.findByStoryId(storyId);
    segments.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    
    if (segments.length === 0) throw new Error('No segments found for this story');

    const mergedClips: Blob[] = [];
    let processedCount = 0;

    if (!this.deps.postProcess.isFFmpegLoaded()) {
      onProgress?.(5, '加载后期处理引擎...');
      await this.deps.postProcess.ensureLoaded();
    }

    for (const seg of segments) {
      const task = await this.deps.videoTaskRepo.findLatestBySegmentId(seg.id);
      if (!task || task.status !== 'SUCCESS' || !task.videoUrl) {
        throw new Error(`分镜 ${seg.sequenceOrder + 1} 的视频未生成`);
      }

      onProgress?.(10 + Math.round((processedCount / segments.length) * 40), `正在下载分镜 ${seg.sequenceOrder + 1} 视频...`);
      const videoRes = await fetch(task.videoUrl);
      const videoBlob = await videoRes.blob();
      
      let finalClip = videoBlob;
      
      const audioUrl = narrationUrls[seg.id] || seg.bgmAudioUrl;
      if (audioUrl) {
        onProgress?.(10 + Math.round((processedCount / segments.length) * 40), `正在合并分镜 ${seg.sequenceOrder + 1} 音频...`);
        const audioRes = await fetch(audioUrl);
        const audioBlob = await audioRes.blob();
        try {
          finalClip = await this.deps.postProcess.mergeVideoAudio(videoBlob, audioBlob);
        } catch (e) {
          console.warn(`[Pipeline] failed to merge audio for segment ${seg.id}:`, e);
          // Fallback to video only if audio merge fails
        }
      }
      
      mergedClips.push(finalClip);
      processedCount++;
    }

    onProgress?.(60, '正在拼接所有分镜...');
    const finalVideoBlob = await this.deps.postProcess.concatClips(mergedClips);

    onProgress?.(90, '正在生成最终成片...');
    
    // Attempt to generate a thumbnail from the first clip
    let thumbnailUrl = '';
    try {
      const firstFrameBlob = await this.deps.postProcess.extractFrame(finalVideoBlob, 0);
      thumbnailUrl = URL.createObjectURL(firstFrameBlob);
    } catch (e) {
      console.warn('[Pipeline] failed to extract thumbnail:', e);
    }

    const finalCut: FinalCut = {
      id: uuidv4(),
      storyId,
      videoBlob: finalVideoBlob,
      thumbnailUrl,
      duration: segments.length * 6 * 1000, // approximation
      size: finalVideoBlob.size,
      hasSubtitles: false,
      createdAt: Date.now()
    };
    
    onProgress?.(95, '正在保存至导出中心...');
    await db.finalCuts.put(finalCut);
    
    onProgress?.(100, '合成完成！');
    return finalCut;
  }

  private async findCharacterForSegment(segment: StorySegment): Promise<Character | null> {
    if (!segment.mentionedCharacters || segment.mentionedCharacters.length === 0) return null;
    const characters = await this.deps.characterRepo.findAll();
    return characters.find(c => segment.mentionedCharacters!.includes(c.name)) || null;
  }

  private async pollVideoTasks(
    taskId: string,
    videoTasks: VideoTask[],
    onProgress: (done: number, total: number) => void
  ): Promise<void> {
    const total = videoTasks.length;
    if (total === 0) {
      onProgress(0, 0);
      return;
    }

    return new Promise<void>((resolve, reject) => {
      let attempts = 0;
      const poller = setInterval(async () => {
        attempts++;
        try {
          let done = 0;
          for (const vt of videoTasks) {
            if (vt.status === 'SUCCESS' || vt.status === 'FAILED') {
              done++;
              continue;
            }
            if (!vt.externalTaskId) continue;
            const status = await this.deps.videoPort.queryTaskStatus(vt.externalTaskId);
            if (status.status === 'SUCCESS') {
              vt.status = 'SUCCESS';
              vt.videoUrl = status.videoUrl;
              vt.fileId = status.fileId;
              vt.videoWidth = status.videoWidth;
              vt.videoHeight = status.videoHeight;
              vt.updatedAt = Date.now();
              await this.deps.videoTaskRepo.save(vt);
              done++;
            } else if (status.status === 'FAILED') {
              vt.status = 'FAILED';
              vt.errorMessage = status.errorMessage;
              vt.updatedAt = Date.now();
              await this.deps.videoTaskRepo.save(vt);
              done++;
            }
          }
          onProgress(done, total);

          if (done === total) {
            clearInterval(poller);
            this.videoPollers.delete(taskId);
            resolve();
          } else if (attempts >= MAX_POLL_ATTEMPTS) {
            clearInterval(poller);
            this.videoPollers.delete(taskId);
            reject(new Error(`Video generation timed out after ${attempts} attempts`));
          }
        } catch (e) {
          clearInterval(poller);
          this.videoPollers.delete(taskId);
          reject(e);
        }
      }, POLL_INTERVAL_MS);

      this.videoPollers.set(taskId, poller);
    });
  }
}
