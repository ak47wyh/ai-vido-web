import type { IBotPort } from '../../../domain/ports/VolcenginePorts';
import type {
  BotCreateParams, BotResult, PublishResult,
  BotListFilter, BotListResult, BotDetailResult,
} from '../../../domain/entities/models';
import type { ApiConfig } from '../../config/ApiConfigStore';
import { CozeHttpClient } from './CozeHttpClient';

export class CozeBotAdapter implements IBotPort {
  private http: CozeHttpClient;

  constructor(private config: ApiConfig) {
    this.http = new CozeHttpClient(config);
  }

  async createBot(params: BotCreateParams): Promise<BotResult> {
    const result = await this.http.post<{ bot_id: string }>('/v1/bots/create', {
      space_id: this.config.cozeSpaceId,
      name: params.name,
      ...(params.description && { desc: params.description }),
      ...(params.systemPrompt && { prompt_info: { prompt: params.systemPrompt } }),
      ...(params.pluginIds && { plugins: params.pluginIds.map(id => ({ id })) }),
    });
    return { botId: result.bot_id, name: params.name };
  }

  async publishBot(botId: string): Promise<PublishResult> {
    const result = await this.http.post<{ version: string }>('/v1/bots/publish', {
      bot_id: botId,
    });
    return { botId, version: result.version };
  }

  async listBots(filters?: BotListFilter): Promise<BotListResult> {
    const result = await this.http.post<{
      bots: Array<{ bot_id: string; name: string; description: string; version: string }>;
      total: number;
    }>('/v1/space/published_bots_list', {
      space_id: this.config.cozeSpaceId,
      page_index: filters?.pageIndex ?? 1,
      page_size: filters?.pageSize ?? 20,
    });
    return {
      total: result.total,
      bots: result.bots.map(b => ({
        botId: b.bot_id,
        name: b.name,
        description: b.description,
        publishedVersion: b.version,
      })),
    };
  }

  async getBotDetail(botId: string): Promise<BotDetailResult> {
    const result = await this.http.get<{
      bot_id: string; name: string; description: string; version: string;
    }>(`/v1/bots/${botId}`);
    return {
      botId: result.bot_id,
      name: result.name,
      description: result.description,
      publishedVersion: result.version,
    };
  }
}