// ========================================
// 去水印功能端口定义
// 遵循六边形架构：domain 层只定义接口，不依赖任何外部实现
// ========================================

/** 去水印选区（矩形区域） */
export interface InpaintRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 去水印算法模式 */
export type InpaintAlgorithm =
  | 'fast_fill'
  | 'edge_interpolation'
  | 'texture_synthesis'
  | 'telea' // Telea 快速行进法（Fast Marching Method）
  | 'navier_stokes' // Navier-Stokes 流体动力学方法
  | 'content_aware'; // 内容感知填充（Patch-Match 纹理合成）

/** 图片去水印选项 */
export interface InpaintOptions {
  algorithm: InpaintAlgorithm;
  quality: number; // 0.5 - 1.0
}

/** PDF 区域策略 */
export type PdfRegionStrategy = 'per_page' | 'global';

/** PDF 去水印选项 */
export interface PdfOptions {
  renderDpi: number; // 渲染分辨率 96-300
  regionStrategy: PdfRegionStrategy;
}

/** 视频水印类型 */
export type VideoWatermarkType = 'static' | 'dynamic';

/** 视频抽帧策略 */
export type VideoSampleStrategy = 'all_frames' | 'keyframes_only';

/** 视频输出编码 */
export type VideoOutputCodec = 'h264' | 'vp9';

/** 视频去水印选项 */
export interface VideoOptions {
  watermarkType: VideoWatermarkType;
  sampleStrategy: VideoSampleStrategy;
  outputCodec: VideoOutputCodec;
}

/** 进度回调 */
export type ProgressCallback = (progress: number) => void;

/** 处理结果 */
export interface InpaintResult {
  blob: Blob;
  width: number;
  height: number;
}

// ==================== 端口接口 ====================

/** 图片去水印端口 */
export interface IImageInpaintPort {
  inpaint(
    image: ImageBitmap | HTMLImageElement,
    regions: InpaintRegion[],
    options: InpaintOptions,
    onProgress?: ProgressCallback,
  ): Promise<InpaintResult>;
}

/** PDF 去水印端口 */
export interface IPdfWatermarkPort {
  removeWatermark(
    file: File,
    regions: InpaintRegion[],
    options: PdfOptions,
    onProgress?: ProgressCallback,
  ): Promise<Blob>;
}

/** 视频去水印端口 */
export interface IVideoInpaintPort {
  inpaintVideo(
    file: File,
    regions: InpaintRegion[],
    options: VideoOptions,
    onProgress?: ProgressCallback,
  ): Promise<Blob>;
}
