import type {
  IVideoGeneratorPort, VideoPromptContext, VideoTaskResult, VideoDownloadResult, VideoAgentContext, VideoAgentTaskResult,
} from '../../../domain/ports/OutboundPorts';
import type { ApiConfig } from '../../config/ApiConfigStore';
import { VolcengineHttpClient } from './VolcengineHttpClient';
import { withRetry } from './VolcengineErrorUtils';

/**
 * 火山引擎视频生成适配器（Seedance 系列模型）。
 *
 * 接口映射：
 *   IVideoGeneratorPort.submitVideoTask  → POST /contents/generations/tasks（返回 task_id 字符串）
 *   IVideoGeneratorPort.queryTaskStatus  → GET  /contents/generations/tasks/{task_id}
 *   IVideoGeneratorPort.downloadVideo    → 从 queryTask 结果中提取 video_url
 *
 * 注意：
 *   - 火山引擎无 createAgentTask / queryAgentTask 概念，这两个方法抛出 NotImplementedError
 *   - video_url 有效期 24 小时
 */
export class VolcengineVideoAdapter implements IVideoGeneratorPort {
  private http: VolcengineHttpClient;

  constructor(private config: ApiConfig) {
    this.http = new VolcengineHttpClient(config);
  }

  async submitVideoTask(context: VideoPromptContext): Promise<string> {
    const payload = this.buildPayload(context);
    const result = await withRetry(() =>
      this.http.post<{ id: string }>('/contents/generations/tasks', payload),
    );
    return result.id;
  }

  async queryTaskStatus(taskId: string): Promise<VideoTaskResult> {
    const result = await this.http.get<VolcengineTaskResponse>(`/contents/generations/tasks/${taskId}`);
    return {
      status: this.mapStatus(result.status),
      videoUrl: result.content?.video_url,
      errorMessage: result.error?.message,
    };
  }

  async downloadVideo(fileIdOrUrl: string): Promise<VideoDownloadResult> {
    // 火山引擎返回的是直接 video_url，无需额外下载接口
    return {
      downloadUrl: fileIdOrUrl,
      filename: `volc-video-${Date.now()}.mp4`,
      bytes: 0,
      createdAt: Date.now(),
    };
  }

  // 火山引擎不支持 Agent 模板模式
  async createAgentTask(_context: VideoAgentContext): Promise<string> {
    throw new Error('火山引擎视频生成不支持 Agent 模板模式');
  }

  async queryAgentTask(_taskId: string): Promise<VideoAgentTaskResult> {
    throw new Error('火山引擎视频生成不支持 Agent 模板模式');
  }

  // ===== 私有方法 =====

  /**
   * 将 VideoPromptContext 转换为火山引擎 API 请求体。
   * Seedance API 使用 content[] 数组格式（非 MiniMax 的扁平格式）。
   */
  private buildPayload(context: VideoPromptContext): Record<string, unknown> {
    const content: Array<Record<string, unknown>> = [];

    // 文本提示词
    if (context.prompt) {
      content.push({ type: 'text', text: context.prompt });
    }

    // 首帧图片
    if (context.firstFrameImage) {
      content.push({
        type: 'image_url',
        image_url: { url: context.firstFrameImage },
        role: 'first_frame',
      });
    }

    // 尾帧图片
    if (context.lastFrameImage) {
      content.push({
        type: 'image_url',
        image_url: { url: context.lastFrameImage },
        role: 'last_frame',
      });
    }

    // 参考图
    if (context.subjectReference && context.subjectReference.length > 0) {
      for (const ref of context.subjectReference) {
        if (ref.image && ref.image.length > 0) {
          content.push({
            type: 'image_url',
            image_url: { url: ref.image[0] },
            role: 'reference_image',
          });
        }
      }
    }

    return {
      model: context.model || 'doubao-seedance-2-pro',
      content,
    };
  }

  /** 状态映射：火山引擎 → 系统内部 */
  private mapStatus(volcStatus: string): VideoTaskResult['status'] {
    const mapping: Record<string, VideoTaskResult['status']> = {
      queued: 'PENDING',
      running: 'PROCESSING',
      succeeded: 'SUCCESS',
      failed: 'FAILED',
      expired: 'FAILED',
      cancelled: 'FAILED',
    };
    return mapping[volcStatus] || 'PENDING';
  }
}

/** 火山引擎任务查询 API 响应结构（适配器内部类型，跨适配器复用） */
export interface VolcengineTaskResponse {
  id: string;
  status: string;
  content?: {
    video_url?: string;
    model_url?: string;
    preview_image_url?: string;
    format?: string;
  };
  error?: {
    code: string;
    message: string;
  };
  created_at?: number;
  completed_at?: number;
}