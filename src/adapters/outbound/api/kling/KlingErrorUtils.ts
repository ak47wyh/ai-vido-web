import type { AxiosError } from 'axios';

/**
 * 可灵 Kling API 错误类。
 */
export class KlingApiError extends Error {
  public readonly httpStatus: number;
  public readonly errorCode: string;
  public readonly rawMessage: string;

  constructor(
    httpStatus: number,
    errorCode: string,
    rawMessage: string,
  ) {
    super(KlingApiError.toUserMessage(httpStatus, errorCode, rawMessage));
    this.name = 'KlingApiError';
    this.httpStatus = httpStatus;
    this.errorCode = errorCode;
    this.rawMessage = rawMessage;
  }

  private static toUserMessage(status: number, _code: string, raw: string): string {
    switch (status) {
      case 400:
        return `请求参数错误：${raw}。请检查输入内容是否符合可灵接口要求。`;
      case 401:
        return '可灵鉴权失败：请检查 AccessKey/SecretKey 配置。';
      case 403:
        return '当前 Token 无权访问此功能，请检查可灵 API 权限配置。';
      case 429:
        return '请求过于频繁或并发达到上限，请稍后重试。';
      case 500:
      case 502:
      case 503:
        return '可灵服务暂时不可用，请稍后重试。';
      default:
        return `可灵请求失败 (${status}): ${raw}`;
    }
  }

  get isRetryable(): boolean {
    return this.httpStatus === 429;
  }
}

export function parseKlingError(error: AxiosError): KlingApiError {
  const status = error.response?.status ?? 0;
  const data = error.response?.data as KlingErrorBody | undefined;
  const errorCode = data?.code ?? 'UNKNOWN';
  const rawMessage = data?.message ?? error.message ?? 'Unknown error';
  return new KlingApiError(status, errorCode, rawMessage);
}

interface KlingErrorBody {
  code?: string;
  message?: string;
  request_id?: string;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (error instanceof KlingApiError && error.isRetryable && attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}
