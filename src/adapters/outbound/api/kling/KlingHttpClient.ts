import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosError } from 'axios';
import type { ApiConfig } from '../../config/ApiConfigStore';
import { parseKlingError } from './KlingErrorUtils';

/**
 * 可灵 Kling HTTP 客户端。
 *
 * 鉴权：AccessKey + SecretKey → 按 HS256 生成 JWT
 *   - header:  { alg: 'HS256', typ: 'JWT' }
 *   - payload: { iss: AccessKey, exp: now+30min, nbf: now-5s }
 *   - HTTP Header: Authorization: Bearer <JWT>
 *
 * JWT 缓存于内存，过期（30min）后自动重新生成。
 *
 * Base URL: https://api.klingai.com
 */
export class KlingHttpClient {
  private client: AxiosInstance;
  private readonly accessKey: string;
  private readonly secretKey: string;
  /** 缓存的 JWT 与过期时间戳（毫秒） */
  private cachedJwt: string | null = null;
  private cachedJwtExpireAt = 0;

  constructor(config: ApiConfig) {
    this.accessKey = config.klingAccessKey;
    this.secretKey = config.klingSecretKey;

    this.client = axios.create({
      baseURL: config.klingBaseUrl.replace(/\/+$/, ''),
      timeout: 120_000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 请求拦截器：注入最新 JWT
    this.client.interceptors.request.use(async (reqConfig) => {
      reqConfig.headers = reqConfig.headers || {};
      reqConfig.headers['Authorization'] = `Bearer ${await this.getJwt()}`;
      return reqConfig;
    });

    // 响应拦截器：统一错误处理
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => Promise.reject(parseKlingError(error)),
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

  // ===== JWT 生成（HS256 via WebCrypto） =====

  /**
   * 获取有效 JWT，过期时自动重新生成。
   * 预留 60 秒缓冲，避免请求途中过期。
   */
  private async getJwt(): Promise<string> {
    const now = Date.now();
    if (this.cachedJwt && now < this.cachedJwtExpireAt - 60_000) {
      return this.cachedJwt;
    }
    this.cachedJwt = await this.generateJwt();
    // exp 设为 now + 30min，缓存过期时间同步
    this.cachedJwtExpireAt = now + 30 * 60 * 1000;
    return this.cachedJwt;
  }

  /**
   * 按 HS256 算法生成 JWT。
   * 1. header  = { alg: 'HS256', typ: 'JWT' }
   * 2. payload = { iss: AccessKey, exp: now+30min, nbf: now-5s }
   * 3. signature = HMAC-SHA256(base64url(header)+'.'+base64url(payload), SecretKey)
   * 4. jwt = header.payload.signature
   */
  private async generateJwt(): Promise<string> {
    const header = { alg: 'HS256', typ: 'JWT' };
    const nowSec = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.accessKey,
      exp: nowSec + 30 * 60,    // 30 分钟后过期
      nbf: nowSec - 5,          // 5 秒前生效（容忍时钟漂移）
      iat: nowSec,
    };

    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const signature = await this.hmacSha256(signingInput, this.secretKey);
    const encodedSignature = this.base64UrlEncodeBytes(signature);

    return `${signingInput}.${encodedSignature}`;
  }

  /** HMAC-SHA256 签名（返回 ArrayBuffer） */
  private async hmacSha256(message: string, secret: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const data = encoder.encode(message);
    return crypto.subtle.sign('HMAC', key, data);
  }

  /** 字符串 → base64url（无 padding） */
  private base64UrlEncode(str: string): string {
    const bytes = new TextEncoder().encode(str);
    return this.base64UrlEncodeBytes(bytes.buffer);
  }

  /** ArrayBuffer/Uint8Array → base64url（无 padding） */
  private base64UrlEncodeBytes(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    // base64 → base64url：+ → -，/ → _，去掉 = padding
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}
