import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosError } from 'axios';
import type { ApiConfig } from '../../config/ApiConfigStore';
import { parseViduError } from './ViduErrorUtils';

/**
 * Vidu HTTP 客户端。
 *
 * 鉴权：HTTP Header `Authorization: Token <API-Key>`
 * Base URL：https://api.vidu.cn
 */
export class ViduHttpClient {
  private client: AxiosInstance;
  private readonly apiKey: string;

  constructor(config: ApiConfig) {
    this.apiKey = config.viduApiKey;
    this.client = axios.create({
      baseURL: config.viduBaseUrl.replace(/\/+$/, ''),
      timeout: 120_000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${this.apiKey}`,
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => Promise.reject(parseViduError(error)),
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
}
