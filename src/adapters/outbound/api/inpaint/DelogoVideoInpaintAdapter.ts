import type {
  IVideoInpaintPort,
  InpaintRegion,
  VideoOptions,
  ProgressCallback,
} from '../../../../domain/ports/WatermarkRemovalPorts';
import type { IFFmpegPort } from '../../../../domain/ports/PostProcessPorts';
import type { ILoggerPort } from '../../../../domain/ports/CrossCuttingPorts';

/**
 * 视频去水印 - 快速模式（方案 A）
 *
 * 使用 FFmpeg 内置 delogo 滤镜单次执行：
 * - 时序与 FPS 完全保留
 * - 音频流 -c:a copy 直接复制，无音画不同步
 * - 仅支持矩形区域（涂抹选区需取最小包围矩形）
 *
 * 性能：比逐帧 Canvas 方案快数十倍。
 */
export class DelogoVideoInpaintAdapter implements IVideoInpaintPort {
  private _logger: ILoggerPort;
  private readonly _ffmpeg: IFFmpegPort;

  constructor(
    ffmpeg: IFFmpegPort,
    logger: ILoggerPort,
  ) {
    this._ffmpeg = ffmpeg;
    this._logger = logger.child({ adapter: 'DelogoVideoInpaintAdapter' });
  }

  async inpaintVideo(
    file: File,
    regions: InpaintRegion[],
    options: VideoOptions,
    onProgress?: ProgressCallback,
  ): Promise<Blob> {
    const startTime = Date.now();
    // 入参日志（遵循规则：所有接口出入参数都通过日志打印出来）
    this._logger.info('inpaintVideo 入参', {
      fileName: file.name,
      fileSize: file.size,
      regions,
      options,
    });

    if (regions.length === 0) {
      throw new Error('未选择水印区域');
    }

    // delogo 滤镜仅支持矩形，regions 已是矩形结构
    // 若选区来自涂抹模式（已被上层转为最小包围矩形），此处直接使用
    onProgress?.(0.1);

    try {
      await this._ffmpeg.load();
      onProgress?.(0.3);

      const videoBlob: Blob = file;
      const result = await this._ffmpeg.applyDelogo(videoBlob, regions);
      onProgress?.(1);

      // 出参日志
      this._logger.info('inpaintVideo 出参', {
        fileName: file.name,
        resultSize: result.size,
        elapsedMs: Date.now() - startTime,
      });

      return result;
    } catch (e) {
      this._logger.error('inpaintVideo 失败', e, { fileName: file.name });
      throw e;
    }
  }
}
