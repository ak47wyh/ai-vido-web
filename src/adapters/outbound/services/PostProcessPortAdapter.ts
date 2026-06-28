/**
 * PostProcessPortAdapter —— IPostProcessPort 的 Service 包装实现
 *
 * PostProcessService 现有方法名与 Port 略有差异（如 mixBGM vs mixBgm），
 * 适配器负责方法名翻译，保持 PostProcessService 的向后兼容。
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
import { PostProcessService } from '../../../domain/services/PostProcessService';

export class PostProcessPortAdapter implements IPostProcessPort {
  constructor(private inner: PostProcessService) {}

  async mergeVideoAudio(ctx: MergeContext): Promise<Blob> {
    return this.inner.mergeVideoAudio(ctx.video, ctx.audio, ctx.audioOffsetSec);
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

  async applyTransition(clip1: Blob, clip2: Blob, transition: TransitionType, duration: number): Promise<Blob> {
    return this.inner.applyTransition(clip1, clip2, transition, duration);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async exportFinalVideo(_storyId: string, _options: ExportOptions): Promise<Blob> {
    // PostProcessService 暂未实现完整 story → 视频 编排
    // 留作占位，调用方可自行编排
    throw new Error('PostProcessPortAdapter.exportFinalVideo: not implemented in current PostProcessService');
  }

  isFFmpegLoaded(): boolean {
    return this.inner.isFFmpegLoaded();
  }

  async ensureLoaded(): Promise<void> {
    return this.inner.ensureLoaded();
  }
}

/** 默认单例（懒加载） */
export const postProcessPortAdapter = new PostProcessPortAdapter(new PostProcessService());
