import type {
  IVideoGeneratorPort,
  VideoPromptContext,
  VideoTaskResult,
  VideoDownloadResult,
  VideoAgentContext,
  VideoAgentTaskResult,
} from '../ports/OutboundPorts';
import type { PlatformRouter } from './PlatformRouter';
import { ApiConfigStore } from '../../adapters/outbound/config/ApiConfigStore';

export class VideoLabService {
  private router: PlatformRouter;
  private activePollers = new Map<string, ReturnType<typeof setInterval>>();

  constructor(router: PlatformRouter) {
    this.router = router;
  }

  /** 获取当前配置对应的视频生成适配器 */
  private getVideoPort(): IVideoGeneratorPort {
    return this.router.resolveVideo(ApiConfigStore.load());
  }

  async submitTask(context: VideoPromptContext): Promise<string> {
    return this.getVideoPort().submitVideoTask(context);
  }

  async submitAgentTask(context: VideoAgentContext): Promise<string> {
    return this.getVideoPort().createAgentTask(context);
  }

  async queryTask(taskId: string): Promise<VideoTaskResult> {
    return this.getVideoPort().queryTaskStatus(taskId);
  }

  async queryAgentTask(taskId: string): Promise<VideoAgentTaskResult> {
    return this.getVideoPort().queryAgentTask(taskId);
  }

  async downloadVideo(fileId: string): Promise<VideoDownloadResult> {
    return this.getVideoPort().downloadVideo(fileId);
  }

  startPolling(
    taskId: string,
    isAgent: boolean,
    onUpdate: (result: VideoTaskResult | VideoAgentTaskResult) => void,
  ): () => void {
    const interval = setInterval(async () => {
      try {
        const result = isAgent
          ? await this.queryAgentTask(taskId)
          : await this.queryTask(taskId);

        const status = result.status.toUpperCase();
        if (status === 'SUCCESS' || status === 'FAIL' || status === 'FAILED') {
          clearInterval(interval);
          this.activePollers.delete(taskId);
        }
        onUpdate(result);
      } catch {
        clearInterval(interval);
        this.activePollers.delete(taskId);
        onUpdate({ status: 'FAILED', errorMessage: 'Polling error' });
      }
    }, 5000);

    this.activePollers.set(taskId, interval);
    return () => {
      clearInterval(interval);
      this.activePollers.delete(taskId);
    };
  }

  cancelAllPolling(): void {
    for (const [, interval] of this.activePollers) clearInterval(interval);
    this.activePollers.clear();
  }
}
