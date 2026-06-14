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

    const baseUrl = config.minimaxBaseUrl.replace(/\/+$/, '');
    const model = context.model || 'MiniMax-M2.7';

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

    // Enable reasoning_split to separate thinking from content
    payload.reasoning_split = true;

    console.log(`[MiniMaxTextAdapter] Chat completion, model: ${model}, messages: ${context.messages.length}`);

    const response = await axios.post(`${baseUrl}/chat/completions`, payload, {
      headers: {
        Authorization: `Bearer ${config.minimaxApiKey}`,
        'Content-Type': 'application/json',
      },
      params: config.minimaxGroupId ? { group_id: config.minimaxGroupId } : undefined,
      timeout: 60000,
    });

    const data = response.data;

    // Check for API errors
    const statusCode = data?.base_resp?.status_code;
    const error = getMiniMaxErrorMessage(statusCode, data?.base_resp?.status_msg, 'MiniMax Text Generation error');
    if (error) throw new Error(error);

    const choice = data?.choices?.[0];
    const message = choice?.message || {};

    // Extract content
    const content = message.content || '';

    // Extract thinking (from reasoning_details when reasoning_split=true)
    let thinking: string | undefined;
    if (message.reasoning_details && Array.isArray(message.reasoning_details)) {
      thinking = message.reasoning_details
        .map((r: { summary?: string; thinking?: string }) => r.summary || r.thinking || '')
        .filter(Boolean)
        .join('\n');
    }

    // Extract tool calls
    let toolCalls: TextGenerationResult['toolCalls'];
    if (message.tool_calls && Array.isArray(message.tool_calls)) {
      toolCalls = message.tool_calls.map((tc: { id?: string; function?: { name?: string; arguments?: string } }) => ({
        id: tc.id || '',
        name: tc.function?.name || '',
        arguments: tc.function?.arguments || '',
      }));
    }

    // Extract usage
    const usage = data?.usage;
    const cachedTokens = usage?.prompt_tokens_details?.cached_tokens;

    return {
      content,
      thinking,
      toolCalls,
      usage: usage ? {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        cachedTokens,
      } : undefined,
    };
  }
}
