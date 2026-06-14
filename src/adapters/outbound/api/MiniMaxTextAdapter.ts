import type {
  ITextGenerationPort,
  TextGenerationContext,
  TextGenerationResult
} from '../../../domain/ports/OutboundPorts';
import { ApiConfigStore } from '../config/ApiConfigStore';
import { getMiniMaxErrorMessage } from './MiniMaxErrorUtils';
import axios from 'axios';

export class MiniMaxTextAdapter implements ITextGenerationPort {

  async chatCompletion(context: TextGenerationContext): Promise<TextGenerationResult> {
    const config = ApiConfigStore.load();
    if (!config.minimaxApiKey) {
      console.warn('[MiniMaxTextAdapter] No API Key configured — returning mock result');
      return {
        content: '[Mock] 请配置 MiniMax API Key 以使用文本生成功能。',
        usage: { promptTokens: 0, completionTokens: 0 },
      };
    }

    // Use Anthropic endpoint when explicitly requested or when systemBlocks with cache_control are provided
    const useAnthropic = context.useAnthropicEndpoint ||
      (context.systemBlocks && context.systemBlocks.some(b => b.cache_control));

    if (useAnthropic) {
      return this.chatCompletionAnthropic(context, config);
    }

    return this.chatCompletionOpenAI(context, config);
  }

  /**
   * OpenAI-compatible endpoint: POST /v1/chat/completions
   */
  private async chatCompletionOpenAI(
    context: TextGenerationContext,
    config: ReturnType<typeof ApiConfigStore.load>
  ): Promise<TextGenerationResult> {
    const baseUrl = config.minimaxBaseUrl.replace(/\/+$/, '');
    const model = context.model || 'MiniMax-M2.5';

    const payload: Record<string, unknown> = {
      model,
      messages: context.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: context.maxTokens ?? 4096,
      temperature: context.temperature ?? 0.7,
    };

    if (context.tools && context.tools.length > 0) {
      payload.tools = context.tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    payload.reasoning_split = true;

    console.log(`[MiniMaxTextAdapter] OpenAI endpoint, model: ${model}, messages: ${context.messages.length}`);

    const response = await axios.post(`${baseUrl}/chat/completions`, payload, {
      headers: {
        Authorization: `Bearer ${config.minimaxApiKey}`,
        'Content-Type': 'application/json',
      },
      params: config.minimaxGroupId ? { group_id: config.minimaxGroupId } : undefined,
      timeout: 60000,
    });

    return this.parseOpenAIResponse(response.data);
  }

  /**
   * Anthropic-compatible endpoint: POST /anthropic/v1/messages
   * Supports cache_control for active prompt caching.
   */
  private async chatCompletionAnthropic(
    context: TextGenerationContext,
    config: ReturnType<typeof ApiConfigStore.load>
  ): Promise<TextGenerationResult> {
    const baseUrl = (config.minimaxAnthropicBaseUrl || 'https://api.minimaxi.com/anthropic').replace(/\/+$/, '');
    const model = context.model || 'MiniMax-M2.5';

    // Build system blocks
    const systemBlocks = context.systemBlocks || [];
    // If no systemBlocks but there's a system message, convert it
    if (systemBlocks.length === 0) {
      const systemMsg = context.messages.find(m => m.role === 'system');
      if (systemMsg) {
        systemBlocks.push({
          type: 'text',
          text: systemMsg.content,
          cache_control: systemMsg.cache_control,
        });
      }
    }

    // Build messages (exclude system role — it goes into system field)
    const anthropicMessages = context.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: [{ type: 'text' as const, text: m.content }],
      }));

    const payload: Record<string, unknown> = {
      model,
      max_tokens: context.maxTokens ?? 4096,
      messages: anthropicMessages,
    };

    if (systemBlocks.length > 0) {
      payload.system = systemBlocks;
    }

    if (context.temperature !== undefined) {
      payload.temperature = context.temperature;
    }

    if (context.tools && context.tools.length > 0) {
      payload.tools = context.tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    console.log(`[MiniMaxTextAdapter] Anthropic endpoint, model: ${model}, messages: ${anthropicMessages.length}`);

    const response = await axios.post(`${baseUrl}/v1/messages`, payload, {
      headers: {
        'x-api-key': config.minimaxApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    });

    return this.parseAnthropicResponse(response.data);
  }

  /**
   * Parse OpenAI-compatible response format.
   */
  private parseOpenAIResponse(data: Record<string, unknown>): TextGenerationResult {
    const statusCode = data?.base_resp?.status_code;
    const error = getMiniMaxErrorMessage(statusCode as number | undefined, data?.base_resp?.status_msg as string, 'MiniMax Text Generation error');
    if (error) throw new Error(error);

    const choice = (data?.choices as Array<Record<string, unknown>>)?.[0];
    const message = (choice?.message || {}) as Record<string, unknown>;

    const content = String(message.content || '');

    // Extract thinking from reasoning_details (M3/M2.5 with reasoning_split=true)
    let thinking: string | undefined;
    const reasoningDetails = message.reasoning_details;
    if (Array.isArray(reasoningDetails)) {
      thinking = reasoningDetails
        .map((r: Record<string, unknown>) => String(r.summary || r.thinking || r.text || ''))
        .filter(Boolean)
        .join('\n');
    }

    // Extract tool calls
    let toolCalls: TextGenerationResult['toolCalls'];
    const rawToolCalls = message.tool_calls;
    if (Array.isArray(rawToolCalls)) {
      toolCalls = rawToolCalls.map((tc: Record<string, unknown>) => {
        const fn = tc.function as Record<string, unknown> | undefined;
        return {
          id: String(tc.id || ''),
          name: String(fn?.name || ''),
          arguments: String(fn?.arguments || ''),
        };
      });
    }

    // Extract usage with cache info
    const usage = data?.usage as Record<string, number> | undefined;
    const promptDetails = usage?.prompt_tokens_details as Record<string, number> | undefined;

    return {
      content,
      thinking,
      toolCalls,
      usage: usage ? {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        cachedTokens: promptDetails?.cached_tokens,
      } : undefined,
    };
  }

  /**
   * Parse Anthropic-compatible response format.
   */
  private parseAnthropicResponse(data: Record<string, unknown>): TextGenerationResult {
    const contentBlocks = data?.content as Array<Record<string, unknown>> | undefined;

    let content = '';
    let thinking: string | undefined;
    let toolCalls: TextGenerationResult['toolCalls'];

    if (Array.isArray(contentBlocks)) {
      const textParts: string[] = [];
      const thinkingParts: string[] = [];
      const tcList: NonNullable<TextGenerationResult['toolCalls']> = [];

      for (const block of contentBlocks) {
        const type = block.type as string;
        if (type === 'text') {
          textParts.push(String(block.text || ''));
        } else if (type === 'thinking') {
          thinkingParts.push(String(block.thinking || ''));
        } else if (type === 'tool_use') {
          tcList.push({
            id: String(block.id || ''),
            name: String(block.name || ''),
            arguments: typeof block.input === 'string' ? block.input : JSON.stringify(block.input || {}),
          });
        }
      }

      content = textParts.join('\n');
      if (thinkingParts.length > 0) thinking = thinkingParts.join('\n');
      if (tcList.length > 0) toolCalls = tcList;
    }

    // Extract usage with cache info
    const usage = data?.usage as Record<string, number> | undefined;

    return {
      content,
      thinking,
      toolCalls,
      usage: usage ? {
        promptTokens: (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0),
        completionTokens: usage.output_tokens || 0,
        cachedTokens: usage.cache_read_input_tokens,
        cacheCreationTokens: usage.cache_creation_input_tokens,
      } : undefined,
    };
  }
}
