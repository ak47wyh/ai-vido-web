import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosError } from 'axios';
import type { ApiConfig } from '../../config/ApiConfigStore';
import { parseVolcengineError, VolcengineApiError } from './VolcengineErrorUtils';

export class VolcengineHttpClient {
  private client: AxiosInstance;

  constructor(private config: ApiConfig) {
    this.client = axios.create({
      baseURL: config.volcArkBaseUrl,
      timeout: 120_000, // 120s（视频/3D 生成可能耗时较长）
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.volcArkApiKey}`,
      },
    });

    // 响应拦截器：统一错误处理
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const parsed = parseVolcengineError(error);
        return Promise.reject(parsed);
      },
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

  async delete<T>(path: string): Promise<T> {
    const response = await this.client.delete<T>(path);
    return response.data;
  }

  /**
   * SSE 流式请求。
   * 使用原生 fetch + ReadableStream，返回 AsyncIterable。
   */
  async *stream<T>(path: string, data: unknown): AsyncIterable<T> {
    const url = `${this.config.volcArkBaseUrl}${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.volcArkApiKey}`,
      },
      body: JSON.stringify({ ...data as object, stream: true }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new VolcengineApiError(response.status, `HTTP ${response.status}`, errorBody);
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
      buffer = lines.pop() || ''; // 保留未完成的行

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6).trim();
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