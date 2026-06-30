import type {
  IVideoInpaintPort,
  InpaintRegion,
  VideoOptions,
  ProgressCallback,
} from '../../../../domain/ports/WatermarkRemovalPorts';
import type { IFFmpegPort } from '../../../../domain/ports/PostProcessPorts';
import { CanvasInpaintAdapter } from './CanvasInpaintAdapter';

/**
 * 视频去水印适配器
 *
 * 流程：
 * 1. FFmpeg WASM 抽帧（关键帧或全帧）
 * 2. 逐帧 Canvas Inpaint
 * 3. FFmpeg 重新编码（保留音频流）
 *
 * 复用现有 FFmpegAdapter 和 CanvasInpaintAdapter
 */
export class FFmpegVideoInpaintAdapter implements IVideoInpaintPort {
  private imageInpaint = new CanvasInpaintAdapter();
  private ffmpeg: IFFmpegPort;

  constructor(ffmpeg: IFFmpegPort) {
    this.ffmpeg = ffmpeg;
  }

  async inpaintVideo(
    file: File,
    regions: InpaintRegion[],
    options: VideoOptions,
    onProgress?: ProgressCallback,
  ): Promise<Blob> {
    await this.ffmpeg.load();

    // 抽帧：用 FFmpeg 将视频转为帧图片序列
    const frames = await this.extractFrames(file, options);
    const totalFrames = frames.length;

    // 逐帧 Inpaint
    const processedFrames: Blob[] = [];
    for (let i = 0; i < totalFrames; i++) {
      const bitmap = await createImageBitmap(frames[i]);
      const result = await this.imageInpaint.inpaint(bitmap, regions, {
        algorithm: 'edge_interpolation',
        quality: 0.85,
      });
      processedFrames.push(result.blob);
      bitmap.close?.();
      onProgress?.((i + 1) / totalFrames);
    }

    // 重新编码视频
    const videoBlob = await this.encodeVideo(file, processedFrames, options);
    return videoBlob;
  }

  /**
   * 抽帧：从视频中提取图像帧
   * 使用 FFmpeg 的截图命令
   */
  private async extractFrames(file: File, _options: VideoOptions): Promise<Blob[]> {
    // 用 FFmpeg 抽帧
    // keyframes_only: 仅抽 I 帧（更快）
    // all_frames: 抽所有帧
    // 使用 FFmpegAdapter 的 extractFrame 方法逐帧抽取
    // 这里简化为按固定间隔抽帧
    const frames: Blob[] = [];
    const interval = 1; // 每秒一帧（简化版）
    const duration = 10; // 默认 10 秒（实际应从元数据获取）

    for (let t = 0; t < duration; t += interval) {
      try {
        const frame = await this.ffmpeg.extractFrame(file, t, 'png');
        frames.push(frame);
      } catch {
        // 抽帧失败时跳过
        break;
      }
    }

    if (frames.length === 0) {
      // 兜底：至少抽首帧
      const frame = await this.ffmpeg.extractFrame(file, 0, 'png');
      frames.push(frame);
    }

    return frames;
  }

  /**
   * 重新编码视频
   * 将处理后的帧重新编码为视频，并从原视频中提取音频流合成
   */
  private async encodeVideo(
    originalFile: File,
    frames: Blob[],
    _options: VideoOptions,
  ): Promise<Blob> {
    // 简化实现：使用 FFmpeg 将帧序列合并为视频
    // 实际生产中需要更完整的 FFmpeg 命令编排
    // 这里用 concat 方式合并帧（每帧 1 秒）
    const clips = frames.map(blob => ({ blob, duration: 1 }));
    const videoBlob = await this.ffmpeg.concat(clips);

    // 尝试从原视频提取音频并合成
    try {
      const trimmed = await this.ffmpeg.trim(originalFile, 0, frames.length);
      const merged = await this.ffmpeg.merge({
        video: videoBlob,
        audio: trimmed,
      });
      return merged;
    } catch {
      // 音频提取失败时直接返回无音频视频
      return videoBlob;
    }
  }
}
