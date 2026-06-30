import type {
  IVideoEnhancePort,
  VideoEnhanceOptions,
  ProgressCallback,
} from '../../../../domain/ports/EnhancementPorts';
import type { IFFmpegPort } from '../../../../domain/ports/PostProcessPorts';
import { CanvasImageEnhanceAdapter } from './CanvasImageEnhanceAdapter';

/**
 * 视频清晰度提升适配器
 *
 * 流程：
 * 1. FFmpeg WASM 抽帧（按固定间隔）
 * 2. 逐帧 Canvas 增强（锐化 / 去噪 / 放大）
 * 3. FFmpeg 重新编码（保留音频流）
 *
 * 复用现有 FFmpegAdapter 和 CanvasImageEnhanceAdapter。
 * 与 FFmpegVideoInpaintAdapter 结构对齐。
 *
 * 注意：当前为简化实现（按秒抽帧），完整帧序列重编码留待二期。
 */
export class FFmpegVideoEnhanceAdapter implements IVideoEnhancePort {
  private imageEnhance = new CanvasImageEnhanceAdapter();
  private ffmpeg: IFFmpegPort;

  constructor(ffmpeg: IFFmpegPort) {
    this.ffmpeg = ffmpeg;
  }

  async enhance(
    file: File,
    options: VideoEnhanceOptions,
    onProgress?: ProgressCallback,
  ): Promise<Blob> {
    await this.ffmpeg.load();

    // 1. 抽帧
    const frames = await this.extractFrames(file);
    const totalFrames = frames.length;
    if (totalFrames === 0) {
      throw new Error('视频抽帧失败：未获取到任何帧');
    }

    // 2. 逐帧增强
    const processedFrames: Blob[] = [];
    for (let i = 0; i < totalFrames; i++) {
      const bitmap = await createImageBitmap(frames[i]);
      try {
        const result = await this.imageEnhance.enhance(
          bitmap,
          {
            mode: options.mode === 'upscale' ? 'upscale' : (['sharpen', 'denoise', 'all'].includes(options.mode) ? options.mode : 'all'),
            scale: options.scale === 1 ? 1 : Math.round(options.scale) as 1 | 2 | 3 | 4,
            sharpenStrength: options.mode === 'sharpen' || options.mode === 'all' ? options.sharpenStrength : 0,
            denoiseStrength: options.mode === 'denoise' || options.mode === 'all' ? options.denoiseStrength : 0,
            outputFormat: 'png',
            quality: 0.95,
          },
        );
        processedFrames.push(result.blob);
      } finally {
        bitmap.close?.();
      }
      onProgress?.((i + 1) / (totalFrames * 2)); // 抽帧已占一半，增强占另一半
    }

    // 3. 重新编码视频（含音频合成）
    const videoBlob = await this.encodeVideo(file, processedFrames);
    onProgress?.(1);
    return videoBlob;
  }

  /**
   * 抽帧：从视频中按固定间隔提取图像帧
   * 与 FFmpegVideoInpaintAdapter 保持一致的简化策略
   */
  private async extractFrames(file: File): Promise<Blob[]> {
    const frames: Blob[] = [];
    const interval = 1; // 每秒一帧（简化版）
    const duration = 10; // 默认 10 秒

    for (let t = 0; t < duration; t += interval) {
      try {
        const frame = await this.ffmpeg.extractFrame(file, t, 'png');
        frames.push(frame);
      } catch {
        break;
      }
    }

    if (frames.length === 0) {
      try {
        const frame = await this.ffmpeg.extractFrame(file, 0, 'png');
        frames.push(frame);
      } catch {
        // 全部失败时返回空，由上层抛错
      }
    }

    return frames;
  }

  /**
   * 重新编码视频
   * 将增强后的帧序列合并为视频，并尝试从原视频提取音频合成
   */
  private async encodeVideo(
    originalFile: File,
    frames: Blob[],
  ): Promise<Blob> {
    const clips = frames.map(blob => ({ blob, duration: 1 }));
    const videoBlob = await this.ffmpeg.concat(clips);

    try {
      const trimmed = await this.ffmpeg.trim(originalFile, 0, frames.length);
      const merged = await this.ffmpeg.merge({
        video: videoBlob,
        audio: trimmed,
      });
      return merged;
    } catch {
      return videoBlob;
    }
  }
}
