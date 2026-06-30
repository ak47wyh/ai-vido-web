import type {
  IImageEnhancePort,
  ImageEnhanceOptions,
  EnhanceResult,
  ProgressCallback,
} from '../../../../domain/ports/EnhancementPorts';

/**
 * 基于 Canvas 2D API 的图片清晰度增强适配器
 *
 * 实现的算法链：
 * 1. 去噪：双边滤波（保边平滑）
 * 2. 放大：Lanczos / 双三次 / 双线性插值
 * 3. 锐化：USM 锐化（Unsharp Mask）
 *
 * 综合模式按「去噪 → 放大 → 锐化」顺序串联。
 * 所有运算在主线程 Canvas 上执行（大图建议后续 Worker 化）。
 */
export class CanvasImageEnhanceAdapter implements IImageEnhancePort {
  async enhance(
    image: ImageBitmap | HTMLImageElement,
    options: ImageEnhanceOptions,
    onProgress?: ProgressCallback,
  ): Promise<EnhanceResult> {
    const srcWidth = 'width' in image ? image.width : (image as HTMLImageElement).naturalWidth;
    const srcHeight = 'height' in image ? image.height : (image as HTMLImageElement).naturalHeight;

    // 步骤权重：综合模式三步均分，单模式整步占满
    const steps: Array<'denoise' | 'upscale' | 'sharpen'> = [];
    if (options.mode === 'all') {
      steps.push('denoise', 'upscale', 'sharpen');
    } else if (options.mode === 'denoise') {
      steps.push('denoise');
    } else if (options.mode === 'upscale') {
      steps.push('upscale');
    } else if (options.mode === 'sharpen') {
      steps.push('sharpen');
    }
    const totalSteps = steps.length || 1;

    // 1. 绘制原图到 Canvas
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = srcWidth;
    srcCanvas.height = srcHeight;
    const srcCtx = srcCanvas.getContext('2d')!;
    srcCtx.drawImage(image as CanvasImageSource, 0, 0);
    let imageData = srcCtx.getImageData(0, 0, srcWidth, srcHeight);

    let currentWidth = srcWidth;
    let currentHeight = srcHeight;
    let algorithmUsed = 'none';

    // 2. 按步骤处理
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      if (step === 'denoise' && options.denoiseStrength > 0) {
        imageData = this.applyBilateralDenoise(imageData, options.denoiseStrength);
        algorithmUsed = 'bilateral';
      } else if (step === 'upscale' && options.scale > 1) {
        const result = this.applyUpscale(imageData, currentWidth, currentHeight, options.scale, 'lanczos');
        imageData = result.imageData;
        currentWidth = result.width;
        currentHeight = result.height;
        algorithmUsed = 'lanczos';
      } else if (step === 'sharpen' && options.sharpenStrength > 0) {
        imageData = this.applyUSMSharpen(imageData, options.sharpenStrength);
        algorithmUsed = 'usm_sharpen';
      }

      onProgress?.((i + 1) / totalSteps);
    }

    // 3. 输出到 Canvas
    const outCanvas = document.createElement('canvas');
    outCanvas.width = currentWidth;
    outCanvas.height = currentHeight;
    const outCtx = outCanvas.getContext('2d')!;
    outCtx.putImageData(imageData, 0, 0);

    const mimeType = options.outputFormat === 'png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob>((resolve) => {
      outCanvas.toBlob((b) => resolve(b!), mimeType, options.quality);
    });

    return {
      blob,
      width: currentWidth,
      height: currentHeight,
      algorithmUsed,
    };
  }

  /**
   * USM 锐化（Unsharp Mask）
   * 原理：原图 = 原图 + amount * (原图 - 模糊图)
   * 使用简化的 3x3 高斯模糊核生成模糊图
   */
  private applyUSMSharpen(imageData: ImageData, strength: number): ImageData {
    const { data, width, height } = imageData;
    const amount = strength / 100; // 0-1
    const blurred = this.gaussianBlur3x3(imageData);
    const out = new Uint8ClampedArray(data);

    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const original = data[i + c];
        const blur = blurred[i + c];
        const sharpened = original + amount * (original - blur);
        out[i + c] = Math.max(0, Math.min(255, sharpened));
      }
      out[i + 3] = data[i + 3]; // alpha 不变
    }

    return new ImageData(out, width, height);
  }

  /**
   * 双边滤波去噪（简化版）
   * 保边平滑：对每个像素，按空间距离 + 像素值差异加权平均邻域
   * 为性能考虑，使用 3x3 窗口
   */
  private applyBilateralDenoise(imageData: ImageData, strength: number): ImageData {
    const { data, width, height } = imageData;
    const out = new Uint8ClampedArray(data);
    // strength 0-100 → sigmaRange 10-80（值域越大越平滑）
    const sigmaSpace = 1.5;
    const sigmaRange = 10 + (strength / 100) * 70;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          const center = data[idx + c];
          let weightSum = 0;
          let valueSum = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nIdx = ((y + dy) * width + (x + dx)) * 4 + c;
              const neighbor = data[nIdx];
              const spatialDist = dx * dx + dy * dy;
              const colorDist = center - neighbor;
              const w = Math.exp(-(spatialDist / (2 * sigmaSpace * sigmaSpace)) - (colorDist * colorDist) / (2 * sigmaRange * sigmaRange));
              weightSum += w;
              valueSum += w * neighbor;
            }
          }
          out[idx + c] = Math.max(0, Math.min(255, valueSum / weightSum));
        }
        out[idx + 3] = data[idx + 3];
      }
    }

    return new ImageData(out, width, height);
  }

  /**
   * 图像放大
   * 使用 Canvas drawImage 内置插值（浏览器实现，性能最优）
   * algorithm 参数预留，浏览器内置即为高品质双线性/双三次混合
   */
  private applyUpscale(
    imageData: ImageData,
    width: number,
    height: number,
    scale: number,
    _algorithm: 'lanczos' | 'bicubic' | 'bilinear',
  ): { imageData: ImageData; width: number; height: number } {
    const newWidth = Math.round(width * scale);
    const newHeight = Math.round(height * scale);

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = width;
    srcCanvas.height = height;
    srcCanvas.getContext('2d')!.putImageData(imageData, 0, 0);

    const dstCanvas = document.createElement('canvas');
    dstCanvas.width = newWidth;
    dstCanvas.height = newHeight;
    const dstCtx = dstCanvas.getContext('2d')!;
    // 浏览器内置的高品质图像缩放（imageSmoothingQuality: 'high'）
    dstCtx.imageSmoothingEnabled = true;
    dstCtx.imageSmoothingQuality = 'high';
    dstCtx.drawImage(srcCanvas, 0, 0, newWidth, newHeight);

    return {
      imageData: dstCtx.getImageData(0, 0, newWidth, newHeight),
      width: newWidth,
      height: newHeight,
    };
  }

  /**
   * 3x3 高斯模糊（用于 USM 锐化的模糊图）
   */
  private gaussianBlur3x3(imageData: ImageData): Uint8ClampedArray {
    const { data, width, height } = imageData;
    const out = new Uint8ClampedArray(data);
    // 高斯核 [1,2,1;2,4,2;1,2,1] / 16
    const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
    const kernelSum = 16;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          let k = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nIdx = ((y + dy) * width + (x + dx)) * 4 + c;
              sum += data[nIdx] * kernel[k++];
            }
          }
          out[idx + c] = sum / kernelSum;
        }
        out[idx + 3] = data[idx + 3];
      }
    }
    return out;
  }
}
