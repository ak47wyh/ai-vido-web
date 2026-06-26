import type { IContextCachePort, ChatCompletionResult, ChatStreamChunk } from '../../../domain/ports/VolcenginePorts';
import type { CacheCreateParams, CacheResult, CacheChatParams } from '../../../domain/entities/models';
import type { ApiConfig } from '../../config/ApiConfigStore';
import { VolcengineHttpClient } from './VolcengineHttpClient';
import { withRetry } from './VolcengineErrorUtils';
import type { VolcengineChatCompletionResponse } from './VolcengineTextAdapter';

export class VolcengineCacheAdapter implements IContextCachePort {
  private http: VolcengineHttpClient;

  constructor(private config: ApiConfig) {
    this.http = new VolcengineHttpClient(config);
  }

  async createCache(params: CacheCreateParams): Promise<CacheResult> {
    const result = await withRetry(() =>
      this.http.post<{ id: string }>('/context/caches', {
        model: params.model,
        messages: params.messages,
        ...(params.ttl && { ttl: params.ttl }),
      }),
    );
    return {
      cacheId: result.id,
      model: params.model,
      createdAt: Date.now(),
      expiresAt: Date.now() + (params.ttl ?? 604800) * 1000,
    };
  }

  async chatWithCache(params: CacheChatParams): Promise<ChatCompletionResult> {
    const result = await withRetry(() =>
      this.http.post<VolcengineChatCompletionResponse>('/chat/completions', {
        model: params.model,
        messages: params.messages,
        context_id: params.cacheId,
      }),
    );
    return {
      content: result.choices?.[0]?.message?.content ?? '',
      usage: result.usage ? {
        promptTokens: result.usage.prompt_tokens,
        completionTokens: result.usage.completion_tokens,
        totalTokens: result.usage.total_tokens,
      } : undefined,
      finishReason: result.choices?.[0]?.finish_reason,
    };
  }

  async *chatWithCacheStream(params: CacheChatParams): AsyncIterable<ChatStreamChunk> {
    const payload = {
      model: params.model,
      messages: params.messages,
      context_id: params.cacheId,
      stream: true,
    };
    for await (const chunk of this.http.stream<VolcengineChatCompletionResponse>('/chat/completions', payload)) {
      yield {
        delta: chunk.choices?.[0]?.delta?.content ?? '',
        finishReason: chunk.choices?.[0]?.finish_reason,
      };
    }
  }
}