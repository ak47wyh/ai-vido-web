import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosError } from 'axios';
import type { ApiConfig } from '../../config/ApiConfigStore';
import { parseWanError, WanApiError } from './WanErrorUtils';

/**
 * 通义万相（DashScope）HTTP 客户端。
 *
 * 鉴权：HTTP Header `Authorization: Bearer <API-Key>`
 * Base URL：https://dashscope.aliyuncs.com/api/v1
 *
 * 异步任务接口需附加 Header `X-DashScope-Async: enable`。
 * 兼容 OpenAI 格式：`/compatible-mode/v1/chat/completions`。
 */
export class WanHttpClient {
  private client: AxiosInstance;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: ApiConfig) {
    this.apiKey = config.wanApiKey;
    this.baseUrl = config.wanBaseUrl.replace(/\/+$/, '');
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 120_000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => Promise.reject(parseWanError(error)),
    );
  }

  async post<T>(path: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(path, data, config);
    return response.data;
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.client.get<T>(path, { params });
    return response.data;
  }

  /**
   * SSE 流式请求（OpenAI 兼容 chat/completions）。
   */
  async *stream<T>(path: string, data: unknown): AsyncIterable<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({ ...(data as object), stream: true }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new WanApiError(response.status, 'STREAM_ERROR', errorBody);
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
          if (payload === '[DONE]') return;
          try {
            yield JSON.parse(payload) as T;
          } catch {
            // 跳过无法解析的行
          }
        }
      }
    }
  }
}
