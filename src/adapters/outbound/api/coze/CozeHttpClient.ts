import axios, { type AxiosInstance, type AxiosError } from 'axios';
import type { ApiConfig } from '../../config/ApiConfigStore';

/**
 * Coze 平台 HTTP 客户端。
 * 认证方式：Authorization: Bearer {cozePatToken}
 * 错误格式与火山方舟不同，需独立处理。
 */
export class CozeHttpClient {
  private client: AxiosInstance;
  private readonly config: ApiConfig;

  constructor(config: ApiConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.cozeBaseUrl,
      timeout: 60_000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.cozePatToken}`,
      },
    });

    this.client.interceptors.response.use(
      (response) => {
        // Coze 返回 { code, msg, data } 格式，需检查 code
        const body = response.data;
        if (body?.code && body.code !== 0) {
          return Promise.reject(new CozeApiError(body.code, body.msg ?? 'Unknown Coze error'));
        }
        return response;
      },
      (error: AxiosError) => Promise.reject(new CozeApiError(error.response?.status ?? 0, error.message)),
    );
  }

  async post<T>(path: string, data?: unknown): Promise<T> {
    const response = await this.client.post<{ code: number; msg: string; data: T }>(path, data);
    return response.data.data;
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.client.get<{ code: number; msg: string; data: T }>(path, { params });
    return response.data.data;
  }

  /** SSE 流式请求（Coze /v3/chat 流式模式） */
  async *stream(path: string, data: unknown): AsyncIterable<CozeStreamEvent> {
    const url = `${this.config.cozeBaseUrl}${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.cozePatToken}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new CozeApiError(response.status, `HTTP ${response.status}`);
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
        if (line.startsWith('data:')) {
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            yield {
              event: parsed.event ?? parsed.type ?? '',
              data: parsed,
            };
          } catch { /* skip */ }
        }
      }
    }
  }
}

export interface CozeStreamEvent {
  event: string;
  data: CozeStreamData;
}

/** Coze SSE 流式事件数据（适配器内部类型） */
export interface CozeStreamData {
  event?: string;
  type?: string;
  chat_id?: string;
  conversation_id?: string;
  content?: string;
  role?: string;
  [key: string]: unknown;
}

export class CozeApiError extends Error {
  readonly code: number;
  readonly rawMessage: string;

  constructor(
    code: number,
    rawMessage: string,
  ) {
    super(`Coze API 错误 (${code}): ${rawMessage}`);
    this.name = 'CozeApiError';
    this.code = code;
    this.rawMessage = rawMessage;
  }
}