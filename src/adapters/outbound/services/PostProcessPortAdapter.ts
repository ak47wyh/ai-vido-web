/**
 * PostProcessPortAdapter —— IPostProcessPort 的 Service 包装实现
 *
 * PostProcessService 现有方法名与 Port 略有差异（如 mixBGM vs mixBgm），
 * 适配器负责方法名翻译，保持 PostProcessService 的向后兼容。
 *
 * exportFinalVideo 原为 throw 'not implemented'，
 * 现通过注入 TimelineRenderService + TimelineService 实现真正的成片渲染。
 */

import type {
  IPostProcessPort,
  MergeContext,
  ExportOptions,
  SubtitleStyle,
  VideoClip,
  TransitionType,
  BgmMixConfig
} from '../../../domain/ports/DomainServicePorts';
import type { RenderExportOptions } from '../../../domain/ports/TimelineRenderPorts';
import { PostProcessService } from '../../../domain/services/PostProcessService';
import type { TimelineRenderService } from '../../../domain/services/TimelineRenderService';
import type { TimelineService } from '../../../domain/services/TimelineService';

export class PostProcessPortAdapter implements IPostProcessPort {
  private inner: PostProcessService;
  private renderer?: TimelineRenderService;
  private timelineService?: TimelineService;

  constructor(
    inner: PostProcessService,
    renderer?: TimelineRenderService,
    timelineService?: TimelineService,
  ) {
    this.inner = inner;
    this.renderer = renderer;
    this.timelineService = timelineService;
  }

  async mergeVideoAudio(ctx: MergeContext): Promise<Blob> {
    return this.inner.mergeVideoAudio(ctx.video, ctx.audio, ctx.audioOffset);
  }

  async concatClips(clips: VideoClip[]): Promise<Blob> {
    const blobs = clips.map(c => c.blob);
    return this.inner.concatClips(blobs);
  }

  async burnSubtitles(video: Blob, srt: string, style?: SubtitleStyle): Promise<Blob> {
    return this.inner.burnSubtitles(video, srt, style);
  }

  async extractFrame(video: Blob, atSec: number, format: 'png' | 'jpg' = 'jpg'): Promise<Blob> {
    return this.inner.extractFrame(video, atSec, format);
  }

  async mixBgm(voice: Blob, bgm: Blob, config: BgmMixConfig): Promise<Blob> {
    return this.inner.mixBGM(voice, bgm, config.bgmVolume ?? 0.3);
  }

  async applyTransition(clip1: Blob, clip2: Blob, transition: TransitionType, duration: number, offsetSec?: number): Promise<Blob> {
    return this.inner.applyTransition(clip1, clip2, transition, duration, offsetSec);
  }

  /**
   * 编码最终视频：基于故事的时间线编排渲染成片。
   * 若 renderer / timelineService 未注入，回退到明确报错（不静默 Mock）。
   */
  async exportFinalVideo(storyId: string, options: ExportOptions): Promise<Blob> {
    if (!this.renderer || !this.timelineService) {
      throw new Error('exportFinalVideo 未配置渲染器：请在 DI 装配时注入 TimelineRenderService + TimelineService');
    }
    const timeline = await this.timelineService.buildFromStory(storyId);
    const renderOptions = this.toRenderOptions(options);
    return this.renderer.render(timeline, renderOptions);
  }

  /** 把 IPostProcessPort.ExportOptions 转换为 TimelineRenderService 的 RenderExportOptions */
  private toRenderOptions(options: ExportOptions): RenderExportOptions {
    let resolution: RenderExportOptions['resolution'] = 'original';
    if (options.width && options.height) {
      if (options.width >= 1920 || options.height >= 1080) resolution = '1080p';
      else if (options.width >= 1280 || options.height >= 720) resolution = '720p';
    }
    const format: RenderExportOptions['format'] = options.outputFormat === 'webm' || options.outputFormat === 'mov'
      ? (options.outputFormat as 'mp4') // RenderExportOptions.format 当前仅 'mp4'，强制 mp4
      : 'mp4';
    return {
      resolution,
      format,
      quality: 'medium',
      burnSubtitles: options.includeSubtitles,
      subtitleStyle: options.subtitleStyle,
    };
  }

  isFFmpegLoaded(): boolean {
    return this.inner.isFFmpegLoaded();
  }

  async ensureLoaded(): Promise<void> {
    return this.inner.ensureLoaded();
  }
}
