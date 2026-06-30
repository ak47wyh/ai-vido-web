// ========================================
// 清晰度提升功能端口定义
// 遵循六边形架构：domain 层只定义接口，不依赖任何外部实现
// 与 WatermarkRemovalPorts 风格保持一致
// ========================================

/** 增强处理模式 */
export type EnhanceMode = 'sharpen' | 'denoise' | 'upscale' | 'all';

/** 图片放大倍数 */
export type ImageScale = 1 | 2 | 3 | 4;

/** 视频放大倍数 */
export type VideoScale = 1 | 1.5 | 2;

/** 图片增强算法 */
export type ImageEnhanceAlgorithm =
  | 'lanczos'      // Lanczos 高品质插值（推荐）
  | 'bicubic'      // 双三次插值（基础）
  | 'bilinear'     // 双线性插值（最快）
  | 'usm_sharpen'  // USM 锐化
  | 'bilateral';   // 双边滤波去噪

/** 输出图片格式 */
export type ImageOutputFormat = 'png' | 'jpeg';

/** 图片增强选项 */
export interface ImageEnhanceOptions {
  mode: EnhanceMode;
  scale: ImageScale;
  sharpenStrength: number;   // 0-100
  denoiseStrength: number;   // 0-100
  outputFormat: ImageOutputFormat;
  quality: number;           // 0-1（jpeg 有效）
}

/** PDF 输出形式 */
export type PdfOutputForm = 'rasterized' | 'preserve_text';

/** PDF 页范围 */
export type PdfPageRange = 'all' | { from: number; to: number };

/** PDF 增强选项 */
export interface PdfEnhanceOptions {
  outputDpi: 96 | 150 | 300;
  mode: EnhanceMode;
  sharpenStrength: number;   // 0-100
  pageRange: PdfPageRange;
  outputForm: PdfOutputForm;
}

/** 视频输出编码 */
export type VideoOutputCodec = 'h264' | 'vp9';

/** 视频增强选项 */
export interface VideoEnhanceOptions {
  mode: EnhanceMode;
  scale: VideoScale;
  sharpenStrength: number;   // 0-100
  denoiseStrength: number;   // 0-100
  outputCodec: VideoOutputCodec;
  frameInterpolation: boolean;
}

/** 进度回调 */
export type ProgressCallback = (progress: number) => void;

/** 增强结果 */
export interface EnhanceResult {
  blob: Blob;
  width: number;
  height: number;
  /** 实际使用的算法（降级后可能与选择不同） */
  algorithmUsed: string;
}

// ==================== 端口接口 ====================

/** 图片清晰度提升端口 */
export interface IImageEnhancePort {
  enhance(
    image: ImageBitmap | HTMLImageElement,
    options: ImageEnhanceOptions,
    onProgress?: ProgressCallback,
  ): Promise<EnhanceResult>;
}

/** PDF 清晰度提升端口 */
export interface IPdfEnhancePort {
  enhance(
    file: File,
    options: PdfEnhanceOptions,
    onProgress?: ProgressCallback,
  ): Promise<Blob>;
}

/** 视频清晰度提升端口 */
export interface IVideoEnhancePort {
  enhance(
    file: File,
    options: VideoEnhanceOptions,
    onProgress?: ProgressCallback,
  ): Promise<Blob>;
}
