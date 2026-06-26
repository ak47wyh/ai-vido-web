import type {
  ITextGenerationPort, TextGenerationContext, TextGenerationResult,
  TextStreamCallbacks, TextContentBlock,
} from '../../../domain/ports/OutboundPorts';
import type { ApiConfig } from '../../config/ApiConfigStore';
import { VolcengineHttpClient } from './VolcengineHttpClient';
import { withRetry } from './VolcengineErrorUtils';

/**
 * 火山引擎文本生成适配器。
 *
 * 接口映射：
 *   ITextGenerationPort.chatCompletion       → POST /chat/completions
 *   ITextGenerationPort.chatCompletionStream  → POST /chat/completions (stream: true)
 *
 * 注意：与 MiniMaxTextAdapter 使用相同的 OpenAI 兼容格式，
 * 但 Base URL 和认证 Token 不同。
 */
export class VolcengineTextAdapter implements ITextGenerationPort {
  private http: VolcengineHttpClient;

  constructor(private config: ApiConfig) {
    this.http = new VolcengineHttpClient(config);
  }

  async chatCompletion(context: TextGenerationContext): Promise<TextGenerationResult> {
    const payload = this.buildPayload(context);
    const result = await withRetry(() =>
      this.http.post<VolcengineChatCompletionResponse>('/chat/completions', payload),
    );
    return {
      content: result.choices?.[0]?.message?.content ?? '',
      usage: result.usage ? {
        promptTokens: result.usage.prompt_tokens,
        completionTokens: result.usage.completion_tokens,
        cachedTokens: result.usage.prompt_tokens_details?.cached_tokens,
      } : undefined,
    };
  }

  chatCompletionStream(context: TextGenerationContext, callbacks: TextStreamCallbacks): AbortController {
    const abortController = new AbortController();
    this.runStream(context, callbacks, abortController);
    return abortController;
  }

  private async runStream(
    context: TextGenerationContext,
    callbacks: TextStreamCallbacks,
    abortController: AbortController,
  ): Promise<void> {
    try {
      const payload = { ...this.buildPayload(context), stream: true };
      const url = `${this.config.volcArkBaseUrl}/chat/completions`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.volcArkApiKey}`,
        },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法获取响应流');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') {
              callbacks.onComplete({ content: '' });
              return;
            }
            try {
              const chunk = JSON.parse(payload) as VolcengineChatCompletionResponse;
              const delta = chunk.choices?.[0]?.delta?.content ?? '';
              if (delta) callbacks.onTextDelta(delta);
            } catch { /* skip */ }
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private buildPayload(context: TextGenerationContext): Record<string, unknown> {
    return {
      model: context.model ?? 'doubao-pro-32k',
      messages: context.messages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : m.content.map(b => b.type === 'text' ? b.text : '').join(''),
      })),
      ...(context.temperature !== undefined && { temperature: context.temperature }),
      ...(context.maxTokens && { max_tokens: context.maxTokens }),
      ...(context.topP !== undefined && { top_p: context.topP }),
      ...(context.tools && { tools: context.tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })) }),
    };
  }
}

/** 火山引擎 Chat Completion API 响应结构（适配器内部类型，跨适配器复用） */
export interface VolcengineChatCompletionResponse {
  choices?: Array<{
    message?: { content: string };
    delta?: { content: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_tokens_details?: { cached_tokens: number };
  };
}