import type { AxiosError } from 'axios';

/**
 * 火山引擎 API 错误类。
 * 携带 HTTP 状态码和平台错误信息，供 UI 层展示。
 */
export class VolcengineApiError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly errorCode: string,
    public readonly rawMessage: string,
  ) {
    super(VolcengineApiError.toUserMessage(httpStatus, errorCode, rawMessage));
    this.name = 'VolcengineApiError';
  }

  /** 生成用户可读的错误信息 */
  private static toUserMessage(status: number, code: string, raw: string): string {
    switch (status) {
      case 400:
        return `请求参数错误：${raw}。请检查输入内容是否符合接口要求。`;
      case 401:
        return '火山引擎 API Key 无效或已过期，请前往配置中心重新配置。';
      case 403:
        return '当前 Token 无权访问此功能，请检查 Token 权限配置。';
      case 429:
        return '请求过于频繁，请稍后重试。';
      case 503:
        return '火山引擎服务暂时不可用，请稍后重试。';
      default:
        return `火山引擎请求失败 (${status}): ${raw}`;
    }
  }

  /** 是否可重试（仅 429 允许重试） */
  get isRetryable(): boolean {
    return this.httpStatus === 429;
  }
}

/** 从 AxiosError 解析为 VolcengineApiError */
export function parseVolcengineError(error: AxiosError): VolcengineApiError {
  const status = error.response?.status ?? 0;
  const data = error.response?.data as VolcengineErrorBody | undefined;
  const errorCode = data?.error?.code ?? data?.error?.type ?? 'UNKNOWN';
  const rawMessage = data?.error?.message ?? error.message ?? 'Unknown error';
  return new VolcengineApiError(status, errorCode, rawMessage);
}

/** 火山引擎错误响应体结构 */
interface VolcengineErrorBody {
  error?: {
    code?: string;
    type?: string;
    message?: string;
  };
}

/**
 * 带指数退避的重试包装器。
 * 仅对 429 错误重试，其他错误直接抛出。
 */
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
      if (error instanceof VolcengineApiError && error.isRetryable && attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}