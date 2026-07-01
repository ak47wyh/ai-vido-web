import type {
  IVideoInpaintPort,
  InpaintRegion,
  VideoOptions,
  ProgressCallback,
} from '../../../../domain/ports/WatermarkRemovalPorts';
import type { IFFmpegPort } from '../../../../domain/ports/PostProcessPorts';
import type { ILoggerPort } from '../../../../domain/ports/CrossCuttingPorts';
import { CanvasInpaintAdapter } from './CanvasInpaintAdapter';

/**
 * 视频去水印 - 高质量模式（方案 B 修复版）
 *
 * 修复原实现的致命缺陷：
 * 1. 用 HTMLVideoElement 获取真实 duration（替代硬编码 duration=10）
 * 2. 按配置 fps 抽帧（替代每秒1帧），时序正确
 * 3. 用 encodeFromFrames 带正确 fps 重编码（替代 concat 每帧1秒）
 * 4. 音频用 trim(0, duration) 提取正确时长（替代用帧数当秒数）
 *
 * 流程：
 * 1. HTMLVideoElement 探测 duration
 * 2. FFmpeg 按 1/fps 间隔抽帧
 * 3. 逐帧 Canvas Inpaint（支持任意算法与涂抹选区）
 * 4. FFmpeg encodeFromFrames 重编码 + 原音频流
 *
 * 性能：逐帧处理较慢，适合短视频或需要涂抹选区的场景。
 */
export class FFmpegVideoInpaintAdapter implements IVideoInpaintPort {
  private imageInpaint = new CanvasInpaintAdapter();
  private _logger: ILoggerPort;
  private readonly _ffmpeg: IFFmpegPort;

  /** 抽帧帧率（每秒帧数），平衡质量与速度 */
  private readonly fps = 10;

  constructor(
    ffmpeg: IFFmpegPort,
    logger: ILoggerPort,
  ) {
    this._ffmpeg = ffmpeg;
    this._logger = logger.child({ adapter: 'FFmpegVideoInpaintAdapter' });
  }

  async inpaintVideo(
    file: File,
    regions: InpaintRegion[],
    options: VideoOptions,
    onProgress?: ProgressCallback,
  ): Promise<Blob> {
    const startTime = Date.now();
    // 入参日志
    this._logger.info('inpaintVideo 入参', {
      fileName: file.name,
      fileSize: file.size,
      regions,
      options,
      fps: this.fps,
    });

    if (regions.length === 0) {
      throw new Error('未选择水印区域');
    }

    await this._ffmpeg.load();
    onProgress?.(0.02);

    // 1. 探测真实 duration（修复硬编码 duration=10）
    const duration = await this.probeDuration(file);
    this._logger.info('视频时长探测', { fileName: file.name, duration });
    onProgress?.(0.05);

    // 2. 按 fps 抽帧（修复每秒1帧的时序错乱）
    const frames = await this.extractFrames(file, duration, onProgress);
    if (frames.length === 0) {
      throw new Error('抽帧失败：未获取到任何帧');
    }
    this._logger.info('抽帧完成', { fileName: file.name, frameCount: frames.length });

    // 3. 逐帧 Canvas Inpaint
    const processedFrames: Blob[] = [];
    for (let i = 0; i < frames.length; i++) {
      const bitmap = await createImageBitmap(frames[i]);
      try {
        const result = await this.imageInpaint.inpaint(bitmap, regions, {
          algorithm: 'edge_interpolation',
          quality: 0.85,
        });
        processedFrames.push(result.blob);
      } finally {
        bitmap.close?.();
      }
      // 抽帧占 5%-50%，逐帧处理占 50%-90%
      const progress = 0.5 + (i + 1) / frames.length * 0.4;
      onProgress?.(progress);
    }

    // 4. 提取原音频（修复用帧数当秒数的音画不同步）
    let audio: Blob | undefined;
    try {
      audio = await this._ffmpeg.trim(file, 0, duration);
      this._logger.info('音频提取成功', { fileName: file.name, audioSize: audio.size });
    } catch (e) {
      this._logger.warn('音频提取失败，输出无音频', { fileName: file.name, error: String(e) });
      audio = undefined;
    }
    onProgress?.(0.92);

    // 5. 重编码（用正确 fps，修复每帧1秒的时序错乱）
    const videoBlob = await this._ffmpeg.encodeFromFrames(processedFrames, this.fps, audio);
    onProgress?.(1);

    // 出参日志
    this._logger.info('inpaintVideo 出参', {
      fileName: file.name,
      resultSize: videoBlob.size,
      frameCount: processedFrames.length,
      elapsedMs: Date.now() - startTime,
    });

    return videoBlob;
  }

  /**
   * 探测视频真实时长（修复硬编码 duration=10）
   * 使用 HTMLVideoElement.onloadedmetadata，无需 FFmpeg
   */
  private probeDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        // 兜底：探测失败时默认 10 秒
        resolve(duration > 0 ? duration : 10);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        this._logger.warn('时长探测失败，使用默认 10 秒', { fileName: file.name });
        resolve(10);
      };
      video.src = url;
    });
  }

  /**
   * 按 fps 抽帧（修复每秒1帧的时序错乱）
   * 每帧间隔 = 1/fps 秒
   */
  private async extractFrames(
    file: File,
    duration: number,
    onProgress?: ProgressCallback,
  ): Promise<Blob[]> {
    const frames: Blob[] = [];
    const interval = 1 / this.fps;
    const totalFrames = Math.max(1, Math.floor(duration / interval));

    for (let i = 0; i < totalFrames; i++) {
      const t = i * interval;
      try {
        const frame = await this._ffmpeg.extractFrame(file, t, 'png');
        frames.push(frame);
      } catch (e) {
        this._logger.warn('抽帧失败，跳过', { fileName: file.name, time: t, error: String(e) });
      }
      // 抽帧占 5%-50%
      const progress = 0.05 + (i + 1) / totalFrames * 0.45;
      onProgress?.(progress);
    }

    // 兜底：至少抽首帧
    if (frames.length === 0) {
      const frame = await this._ffmpeg.extractFrame(file, 0, 'png');
      frames.push(frame);
    }

    return frames;
  }
}
