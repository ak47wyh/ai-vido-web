import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosError } from 'axios';
import type { ApiConfig } from '../../config/ApiConfigStore';
import { parseZhipuError, ZhipuApiError } from './ZhipuErrorUtils';

/**
 * 智谱 AI HTTP 客户端。
 *
 * 鉴权：Bearer API-Key
 * Base URL：https://open.bigmodel.cn/api/paas/v4
 *
 * 支持视频/图片/文本/语音模态。
 */
export class ZhipuHttpClient {
  private client: AxiosInstance;
  private readonly apiKey: string;
  private config: ApiConfig;

  constructor(config: ApiConfig) {
    this.config = config;
    this.apiKey = config.zhipuApiKey;
    this.client = axios.create({
      baseURL: config.zhipuBaseUrl.replace(/\/+$/, ''),
      timeout: 120_000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => Promise.reject(parseZhipuError(error)),
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
   * SSE 流式请求（用于文本 chatCompletionStream）。
   * 返回 AsyncIterable<T>，每个 yield 是一个 SSE 事件 payload。
   */
  async *stream<T>(path: string, data: unknown): AsyncIterable<T> {
    const url = `${this.config.zhipuBaseUrl.replace(/\/+$/, '')}${path}`;
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
      throw new ZhipuApiError(response.status, 'STREAM_ERROR', errorBody);
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
