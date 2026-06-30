import type {
  IPdfWatermarkPort,
  InpaintRegion,
  PdfOptions,
  ProgressCallback,
} from '../../../../domain/ports/WatermarkRemovalPorts';
import { CanvasInpaintAdapter } from './CanvasInpaintAdapter';

// CDN 加载的模块类型
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
  addPage: (size: [number, number]) => PdfPageOut;
  save: () => Promise<Uint8Array>;
};
type PdfImage = { width: number; height: number };
type PdfPageOut = { drawImage: (img: PdfImage, opts: Record<string, unknown>) => void } & PdfImage;

const PDFJS_CDN = 'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.min.mjs';
const PDFJS_WORKER_CDN = 'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs';
const PDFLIB_CDN = 'https://unpkg.com/pdf-lib@1.17.1/cjs/pdf-lib.js';

/**
 * PDF 去水印适配器
 *
 * 通过 CDN 动态加载 pdf.js 和 pdf-lib，无需 npm 安装。
 * 流程：pdf.js 渲染 → Canvas Inpaint → pdf-lib 重新封装
 */
export class PdfWatermarkAdapter implements IPdfWatermarkPort {
  private imageInpaint = new CanvasInpaintAdapter();
  private pdfjsPromise: Promise<PdfJsModule> | null = null;
  private pdfLibPromise: Promise<PdfLibModule> | null = null;

  async removeWatermark(
    file: File,
    regions: InpaintRegion[],
    options: PdfOptions,
    onProgress?: ProgressCallback,
  ): Promise<Blob> {
    const [pdfjs, pdfLib] = await Promise.all([
      this.loadPdfJs(),
      this.loadPdfLib(),
    ]);

    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdfDoc.numPages;

    const { PDFDocument } = pdfLib;
    const outDoc = await PDFDocument.create();
    const scale = options.renderDpi / 72;

    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport }).promise;

      // 对 Canvas 执行 Inpaint
      if (regions.length > 0) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const scaledRegions = regions.map(r => ({
          x: r.x * scale, y: r.y * scale,
          width: r.width * scale, height: r.height * scale,
        }));
        const adapter = this.imageInpaint as unknown as {
          inpaintRegion: (data: Uint8ClampedArray, width: number, height: number, region: InpaintRegion, algorithm: string) => void;
        };
        for (const region of scaledRegions) {
          adapter.inpaintRegion(data, canvas.width, canvas.height, region, 'edge_interpolation');
        }
        ctx.putImageData(imageData, 0, 0);
      }

      // Canvas → PNG → embed
      const pngBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png');
      });
      const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
      const img = await outDoc.embedPng(pngBytes);

      const originalViewport = page.getViewport({ scale: 1 });
      const newPage = outDoc.addPage([originalViewport.width, originalViewport.height]);
      newPage.drawImage(img, {
        x: 0, y: 0,
        width: originalViewport.width,
        height: originalViewport.height,
      });

      onProgress?.(i / numPages);
    }

    const pdfBytes = await outDoc.save();
    return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
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
