import type { IDialogPort } from '../../../../domain/ports/VolcenginePorts';
import type {
  DialogChatParams, DialogChatResult, DialogStreamChunk,
  ConversationResult, MessageListResult, DialogMessage,
} from '../../../../domain/entities/models';
import type { ApiConfig } from '../../config/ApiConfigStore';
import { CozeHttpClient } from './CozeHttpClient';

export class CozeDialogAdapter implements IDialogPort {
  private http: CozeHttpClient;

  constructor(config: ApiConfig) {
    this.http = new CozeHttpClient(config);
  }

  async createConversation(botId: string): Promise<ConversationResult> {
    const result = await this.http.post<{ id: string }>('/v1/conversations/create', {
      bot_id: botId,
    });
    return { conversationId: result.id };
  }

  async chat(params: DialogChatParams): Promise<DialogChatResult> {
    const result = await this.http.post<{
      chat_id: string;
      conversation_id: string;
      status: string;
      usage: { token_count: number };
    }>('/v3/chat', {
      bot_id: params.botId,
      user_id: params.userId,
      stream: false,
      auto_save_history: params.autoSaveHistory ?? true,
      additional_messages: params.messages.map((m: DialogMessage) => ({
        role: m.role,
        content: m.content,
        content_type: m.contentType ?? 'text',
      })),
    });

    return {
      chatId: result.chat_id,
      conversationId: result.conversation_id,
      status: result.status as DialogChatResult['status'],
      usage: { tokenCount: result.usage?.token_count ?? 0 },
    };
  }

  async *chatStream(params: DialogChatParams): AsyncIterable<DialogStreamChunk> {
    for await (const event of this.http.stream('/v3/chat', {
      bot_id: params.botId,
      user_id: params.userId,
      stream: true,
      auto_save_history: params.autoSaveHistory ?? true,
      additional_messages: params.messages.map((m: DialogMessage) => ({
        role: m.role,
        content: m.content,
        content_type: m.contentType ?? 'text',
      })),
    })) {
      yield {
        event: event.event,
        data: JSON.stringify(event.data),
        chatId: event.data.chat_id,
        conversationId: event.data.conversation_id,
      };
    }
  }

  async listMessages(conversationId: string, chatId: string): Promise<MessageListResult> {
    const result = await this.http.get<{
      messages: Array<{ role: string; content: string; type: string }>;
    }>('/v3/chat/message/list', {
      conversation_id: conversationId,
      chat_id: chatId,
    });
    return {
      messages: result.messages.map(m => ({
        role: m.role as DialogMessage['role'],
        content: m.content,
        contentType: 'text' as const,
      })),
    };
  }
}