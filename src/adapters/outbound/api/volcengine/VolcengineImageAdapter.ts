import type { IImageGeneratorPort, ImageGenerationContext, ImageGenerationResult } from '../../../../domain/ports/OutboundPorts';
import type { ApiConfig } from '../../config/ApiConfigStore';
import { VolcengineHttpClient } from './VolcengineHttpClient';
import { withRetry } from './VolcengineErrorUtils';

/**
 * 火山引擎图片生成适配器（Seedream 系列模型）。
 *
 * 接口映射：
 *   IImageGeneratorPort.generateImage → POST /images/generations
 *
 * 支持标准模式和流式模式。
 */
export class VolcengineImageAdapter implements IImageGeneratorPort {
  private http: VolcengineHttpClient;

  constructor(config: ApiConfig) {
    this.http = new VolcengineHttpClient(config);
  }

  async generateImage(context: ImageGenerationContext): Promise<ImageGenerationResult> {
    const payload = this.buildPayload(context);

    const result = await withRetry(() =>
      this.http.post<{
        created: number;
        data: Array<{ url?: string; b64_json?: string; size?: string }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      }>('/images/generations', payload),
    );

    return {
      imageUrls: result.data.filter(item => item.url).map(item => item.url!),
      imageDataUri: result.data.find(item => item.b64_json)?.b64_json
        ? `data:image/png;base64,${result.data.find(item => item.b64_json)!.b64_json}`
        : undefined,
      metadata: {
        successCount: result.data.filter(item => item.url || item.b64_json).length,
        failedCount: result.data.length - result.data.filter(item => item.url || item.b64_json).length,
      },
    };
  }

  /**
   * 流式图片生成（扩展方法，不在 IImageGeneratorPort 中，供新 UI 使用）。
   */
  async *generateImageStream(context: ImageGenerationContext): AsyncIterable<VolcengineImageStreamEvent> {
    const payload = { ...this.buildPayload(context), stream: true };
    yield* this.http.stream<VolcengineImageStreamEvent>('/images/generations', payload);
  }

  private buildPayload(context: ImageGenerationContext): Record<string, unknown> {
    return {
      model: 'doubao-seedream-4-5-251128',
      prompt: context.prompt,
      ...(context.subjectReferenceUrl && { image: [context.subjectReferenceUrl] }),
      ...(context.width && context.height && { size: `${context.width}x${context.height}` }),
      ...(context.n && { n: context.n }),
      ...(context.seed !== undefined && { seed: context.seed }),
      response_format: context.responseFormat === 'base64' ? 'b64_json' : 'url',
    };
  }
}

/** 流式图片生成事件（适配器内部类型） */
interface VolcengineImageStreamEvent {
  type: 'partial_success' | 'partial_failure' | 'completion';
  data?: { url?: string; b64_json?: string };
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}