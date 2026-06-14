import type { IImageGeneratorPort, ImageGenerationContext, ImageGenerationResult } from '../../../domain/ports/OutboundPorts';
import { ApiConfigStore } from '../config/ApiConfigStore';
import { getMiniMaxErrorMessage } from './MiniMaxErrorUtils';
import axios from 'axios';

/**
 * Adapter for MiniMax Image Generation API.
 * Uses the same API Key / Group ID / Base URL as the video adapter.
 *
 * API Docs: https://platform.minimaxi.com/docs/guides/image-generation
 * Endpoint: POST https://api.minimaxi.com/v1/image_generation
 * Model: image-01
 * Response: { data: { image_base64: ["..."] } }
 */
export class MiniMaxImageAdapter implements IImageGeneratorPort {

  async generateImage(context: ImageGenerationContext): Promise<ImageGenerationResult> {
    const config = ApiConfigStore.load();

    // ── Mock mode ─────────────────────────────────────────────────────────
    if (!config.minimaxApiKey) {
      console.warn('[MiniMaxImageAdapter] No API key — returning placeholder image.');
      const mockBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      return { imageDataUri: `data:image/png;base64,${mockBase64}` };
    }

    // ── Real API call ─────────────────────────────────────────────────────
    const baseUrl = config.minimaxBaseUrl.replace(/\/+$/, '');

    const payload: Record<string, unknown> = {
      model: 'image-01',
      prompt: context.prompt,
      aspect_ratio: context.aspectRatio,
      response_format: 'base64',
    };

    // 图生图：添加 subject_reference
    if (context.subjectReferenceUrl) {
      payload.subject_reference = [
        {
          type: 'character',
          image_file: context.subjectReferenceUrl,
        },
      ];
    }

    console.log('[MiniMaxImageAdapter] Generating image with prompt:', context.prompt);

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

    // 检查 base_resp 错误码
    const statusCode = data?.base_resp?.status_code;
    const error = getMiniMaxErrorMessage(statusCode, data?.base_resp?.status_msg, 'MiniMax Image Generation error');
    if (error) throw new Error(error);

    const images: string[] = data?.data?.image_base64;
    if (!images || images.length === 0) {
      console.error('[MiniMaxImageAdapter] Unexpected response:', JSON.stringify(data));
      throw new Error('MiniMax Image API did not return any images.');
    }

    return {
      imageDataUri: `data:image/jpeg;base64,${images[0]}`,
    };
  }
}
