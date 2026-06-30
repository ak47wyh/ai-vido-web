import type {
  IPdfEnhancePort,
  PdfEnhanceOptions,
  ProgressCallback,
} from '../../../../domain/ports/EnhancementPorts';
import { CanvasImageEnhanceAdapter } from './CanvasImageEnhanceAdapter';

// CDN 动态加载的模块类型
type PdfJsModule = {
  getDocument: (params: { data: ArrayBuffer }) => { promise: Promise<PdfDocument> };
  GlobalWorkerOptions: { workerSrc: string };
};
type PdfDocument = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
};
type PdfPage = {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
};
type PdfLibModule = {
  PDFDocument: { create: () => Promise<PdfLibDoc> };
};
type PdfLibDoc = {
  embedPng: (bytes: Uint8Array) => Promise<PdfImage>;
  embedJpg: (bytes: Uint8Array) => Promise<PdfImage>;
  addPage: (size: [number, number]) => PdfPageOut;
  save: () => Promise<Uint8Array>;
};
type PdfImage = { width: number; height: number };
type PdfPageOut = { drawImage: (img: PdfImage, opts: Record<string, unknown>) => void } & PdfImage;

const PDFJS_CDN = 'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.min.mjs';
const PDFJS_WORKER_CDN = 'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs';
const PDFLIB_CDN = 'https://unpkg.com/pdf-lib@1.17.1/cjs/pdf-lib.js';

/**
 * PDF 清晰度提升适配器
 *
 * 流程：pdf.js 高 DPI 渲染 → Canvas 增强（锐化/去噪） → pdf-lib 重新封装
 * - rasterized 模式：每页栅格化为图像后整体增强（适合扫描件）
 * - preserve_text 模式：栅格化后增强，但保留原页面尺寸（文字层不抽取，留待二期）
 *
 * 与 PdfWatermarkAdapter 结构对齐，复用 CanvasImageEnhanceAdapter 做图像增强。
 */
export class PdfEnhanceAdapter implements IPdfEnhancePort {
  private imageEnhance = new CanvasImageEnhanceAdapter();
  private pdfjsPromise: Promise<PdfJsModule> | null = null;
  private pdfLibPromise: Promise<PdfLibModule> | null = null;

  async enhance(
    file: File,
    options: PdfEnhanceOptions,
    onProgress?: ProgressCallback,
  ): Promise<Blob> {
    const [pdfjs, pdfLib] = await Promise.all([
      this.loadPdfJs(),
      this.loadPdfLib(),
    ]);

    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdfDoc.numPages;

    // 解析页范围
    const pageList = this.resolvePageRange(options.pageRange, numPages);
    const totalToProcess = pageList.length;

    const { PDFDocument } = pdfLib;
    const outDoc = await PDFDocument.create();
    const scale = options.outputDpi / 72;

    for (let i = 0; i < totalToProcess; i++) {
      const pageNum = pageList[i];
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      // 白底，避免透明背景渲染为黑色
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      // 对渲染后的页面图像执行增强
      const shouldSharpen = options.mode === 'sharpen' || options.mode === 'all';
      const shouldDenoise = options.mode === 'denoise' || options.mode === 'all';
      if (shouldSharpen || shouldDenoise) {
        const bitmap = await createImageBitmap(canvas);
        try {
          const result = await this.imageEnhance.enhance(
            bitmap,
            {
              mode: options.mode === 'upscale' ? 'all' : options.mode,
              scale: 1,
              sharpenStrength: shouldSharpen ? options.sharpenStrength : 0,
              denoiseStrength: shouldDenoise ? 30 : 0,
              outputFormat: 'png',
              quality: 0.95,
            },
          );
          // 把增强后的图像画回 canvas
          const tmpCanvas = document.createElement('canvas');
          tmpCanvas.width = result.width;
          tmpCanvas.height = result.height;
          tmpCanvas.getContext('2d')!.putImageData(
            await this.blobToImageData(result.blob, result.width, result.height),
            0,
            0,
          );
          canvas.width = result.width;
          canvas.height = result.height;
          canvas.getContext('2d')!.drawImage(tmpCanvas, 0, 0);
        } finally {
          bitmap.close?.();
        }
      }

      // Canvas → PNG → embed
      const pngBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png');
      });
      const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
      const img = await outDoc.embedPng(pngBytes);

      // 保留原始页面尺寸（无论 DPI 多少，PDF 页面尺寸不变，只是图像更清晰）
      const originalViewport = page.getViewport({ scale: 1 });
      const newPage = outDoc.addPage([originalViewport.width, originalViewport.height]);
      newPage.drawImage(img, {
        x: 0, y: 0,
        width: originalViewport.width,
        height: originalViewport.height,
      });

      onProgress?.((i + 1) / totalToProcess);
    }

    const pdfBytes = await outDoc.save();
    return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  }

  /** 解析页范围 → 实际页码列表（1-based） */
  private resolvePageRange(range: PdfEnhanceOptions['pageRange'], total: number): number[] {
    if (range === 'all') {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const from = Math.max(1, range.from);
    const to = Math.min(total, range.to);
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  }

  /** Blob → ImageData */
  private async blobToImageData(blob: Blob, width: number, height: number): Promise<ImageData> {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    return ctx.getImageData(0, 0, width, height);
  }

  /** 动态加载 pdf.js（CDN） */
  private loadPdfJs(): Promise<PdfJsModule> {
    if (this.pdfjsPromise) return this.pdfjsPromise;
    this.pdfjsPromise = import(/* @vite-ignore */ PDFJS_CDN).then((mod: PdfJsModule) => {
      mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
      return mod;
    });
    return this.pdfjsPromise;
  }

  /** 动态加载 pdf-lib（CDN） */
  private loadPdfLib(): Promise<PdfLibModule> {
    if (this.pdfLibPromise) return this.pdfLibPromise;
    this.pdfLibPromise = import(/* @vite-ignore */ PDFLIB_CDN);
    return this.pdfLibPromise;
  }
}
