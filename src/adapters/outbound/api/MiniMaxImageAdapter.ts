import type { IImageGeneratorPort, ImageGenerationContext, ImageGenerationResult } from '../../../domain/ports/OutboundPorts';
import { ApiConfigStore } from '../config/ApiConfigStore';
import { getMiniMaxErrorMessage } from './MiniMaxErrorUtils';
import axios from 'axios';

/**
 * Adapter for MiniMax Image Generation API.
 *
 * Supports both T2I (Text-to-Image) and I2I (Image-to-Image with subject_reference).
 *
 * API Docs:
 *   - T2I: https://platform.minimaxi.com/docs/api-reference/image-generation-t2i
 *   - I2I: https://platform.minimaxi.com/docs/api-reference/image-generation-i2i
 *
 * Endpoint: POST https://api.minimaxi.com/v1/image_generation
 * Models: image-01, image-01-live
 * Response format: url (24h validity) or base64
 */
export class MiniMaxImageAdapter implements IImageGeneratorPort {

  /**
   * 将 OSS 签名 URL 改写为本地代理 URL，绕过浏览器 CORS 限制和 OSS 502 瞬时故障。
   * 开发环境下通过 vite ossProxyPlugin 在 Node 端下载（无 CORS 限制）。
   * 非开发环境（生产构建）直接返回原始 URL。
   */
  private rewriteOssUrl(url: string): string {
    if (typeof import.meta === 'undefined' || !import.meta.env?.DEV) return url;
    if (!url.startsWith('http')) return url;
    return `/__oss-proxy?url=${encodeURIComponent(url)}`;
  }

  async generateImage(context: ImageGenerationContext): Promise<ImageGenerationResult> {
    const config = ApiConfigStore.load();

    // ── Mock mode ─────────────────────────────────────────────────────────
    if (!config.minimaxApiKey) {
      console.warn('[MiniMaxImageAdapter] No API key — returning placeholder image.');
      const mockBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      return { imageDataUri: `data:image/png;base64,${mockBase64}` };
    }

    // ── Build request payload ──────────────────────────────────────────────
    const model = context.model || 'image-01';
    const responseFormat = context.responseFormat || 'url';
    const MAX_PROMPT_LENGTH = 1500;

    // Truncate prompt to API limit
    let prompt = context.prompt;
    if (prompt.length > MAX_PROMPT_LENGTH) {
      console.warn(`[MiniMaxImageAdapter] Prompt too long (${prompt.length}), truncating to ${MAX_PROMPT_LENGTH}`);
      prompt = prompt.slice(0, MAX_PROMPT_LENGTH);
    }

    const payload: Record<string, unknown> = {
      model,
      prompt,
    };

    // Response format (API default is 'url')
    if (responseFormat) {
      payload.response_format = responseFormat;
    }

    // Aspect ratio — 21:9 only valid for image-01
    const LIVE_UNSUPPORTED_RATIOS = ['21:9'];
    if (context.aspectRatio) {
      if (model === 'image-01-live' && LIVE_UNSUPPORTED_RATIOS.includes(context.aspectRatio)) {
        console.warn(`[MiniMaxImageAdapter] aspect_ratio "${context.aspectRatio}" not supported by ${model}, falling back to 16:9`);
        payload.aspect_ratio = '16:9';
      } else {
        payload.aspect_ratio = context.aspectRatio;
      }
    }

    // Custom width/height (only for image-01)
    if (model === 'image-01' && context.width && context.height) {
      payload.width = context.width;
      payload.height = context.height;
    }

    // Number of images
    if (context.n && context.n > 1) {
      payload.n = context.n;
    }

    // Seed for reproducibility
    if (context.seed !== undefined) {
      payload.seed = context.seed;
    }

    // Prompt optimizer
    if (context.promptOptimizer !== undefined) {
      payload.prompt_optimizer = context.promptOptimizer;
    }

    // Watermark
    if (context.aigcWatermark !== undefined) {
      payload.aigc_watermark = context.aigcWatermark;
    }

    // Subject reference (I2V: image-to-image)
    const subjectRef = context.subjectReference ||
      (context.subjectReferenceUrl ? [{ type: 'character', image_file: context.subjectReferenceUrl }] : undefined);
    if (subjectRef && subjectRef.length > 0) {
      payload.subject_reference = subjectRef;
    }

    // Style (only for image-01-live)
    if (model === 'image-01-live' && context.style) {
      payload.style = context.style;
    }

    console.log(`[MiniMaxImageAdapter] Generating image, model: ${model}, format: ${responseFormat}`);
    console.log(`[MiniMaxImageAdapter] Payload:`, JSON.stringify(payload, null, 2));

    // ── Real API call ─────────────────────────────────────────────────────
    const baseUrl = config.minimaxBaseUrl.replace(/\/+$/, '');
    const response = await axios.post(
      `${baseUrl}/image_generation`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${config.minimaxApiKey}`,
          'Content-Type': 'application/json',
        },
        params: config.minimaxGroupId ? { group_id: config.minimaxGroupId } : undefined,
      }
    );

    const data = response.data;

    // Check base_resp error codes
    const statusCode = data?.base_resp?.status_code;
    const statusMsg = data?.base_resp?.status_msg;
    const error = getMiniMaxErrorMessage(statusCode, statusMsg, 'MiniMax Image Generation error');
    if (error) {
      console.error(`[MiniMaxImageAdapter] API error: status_code=${statusCode}, status_msg=${statusMsg}`);
      console.error(`[MiniMaxImageAdapter] Request payload was:`, JSON.stringify(payload, null, 2));
      throw new Error(error);
    }

    // Parse metadata
    const metadata = data?.metadata ? {
      successCount: Number(data.metadata.success_count || 0),
      failedCount: Number(data.metadata.failed_count || 0),
    } : undefined;

    // Parse response based on format
    if (responseFormat === 'url') {
      const imageUrls: string[] = data?.data?.image_urls;
      if (!imageUrls || imageUrls.length === 0) {
        throw new Error('MiniMax Image API did not return any image URLs.');
      }
      // OSS 签名链接有 CORS 限制 + 502 瞬时故障，改写为本地代理 URL
      const proxiedUrls = imageUrls.map(u => this.rewriteOssUrl(u));
      return { imageUrls: proxiedUrls, metadata };
    }

    // base64 format
    const images: string[] = data?.data?.image_base64;
    if (!images || images.length === 0) {
      console.error('[MiniMaxImageAdapter] Unexpected response:', JSON.stringify(data));
      throw new Error('MiniMax Image API did not return any images.');
    }

    if (images.length === 1) {
      return {
        imageDataUri: `data:image/jpeg;base64,${images[0]}`,
        metadata,
      };
    }

    // Multiple base64 images — return first as imageDataUri, all as imageUrls with data URI prefix
    return {
      imageDataUri: `data:image/jpeg;base64,${images[0]}`,
      imageUrls: images.map(img => `data:image/jpeg;base64,${img}`),
      metadata,
    };
  }
}
