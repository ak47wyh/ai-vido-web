import type { IModelResponsePort } from '../../../../domain/ports/VolcenginePorts';
import type {
  ResponseCreateParams, ResponseResult, ResponseStreamChunk, ResponseContextResult,
} from '../../../../domain/entities/models';
import type { ApiConfig } from '../../config/ApiConfigStore';
import { VolcengineHttpClient } from './VolcengineHttpClient';
import { withRetry } from './VolcengineErrorUtils';

export class VolcengineResponseAdapter implements IModelResponsePort {
  private http: VolcengineHttpClient;

  constructor(config: ApiConfig) {
    this.http = new VolcengineHttpClient(config);
  }

  async createResponse(params: ResponseCreateParams): Promise<ResponseResult> {
    return withRetry(() =>
      this.http.post<ResponseResult>('/responses', this.buildPayload(params)),
    );
  }

  async *createResponseStream(params: ResponseCreateParams): AsyncIterable<ResponseStreamChunk> {
    yield* this.http.stream<ResponseStreamChunk>('/responses', {
      ...this.buildPayload(params),
      stream: true,
    });
  }

  async getResponse(responseId: string): Promise<ResponseResult> {
    return this.http.get<ResponseResult>(`/responses/${responseId}`);
  }

  async getResponseContext(responseId: string): Promise<ResponseContextResult> {
    return this.http.get<ResponseContextResult>(`/responses/${responseId}/context`);
  }

  async deleteResponse(responseId: string): Promise<void> {
    await this.http.delete(`/responses/${responseId}`);
  }

  private buildPayload(params: ResponseCreateParams): Record<string, unknown> {
    return {
      model: params.model,
      input: params.input,
      ...(params.previousResponseId && { previous_response_id: params.previousResponseId }),
      ...(params.caching && { caching: params.caching }),
      ...(params.store !== undefined && { store: params.store }),
      ...(params.thinking && { thinking: params.thinking }),
      ...(params.temperature !== undefined && { temperature: params.temperature }),
      ...(params.expireAt !== undefined && { expire_at: params.expireAt }),
    };
  }
}