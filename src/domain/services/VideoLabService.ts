import type {
  IVideoGeneratorPort,
  VideoPromptContext,
  VideoTaskResult,
  VideoDownloadResult,
  VideoAgentContext,
  VideoAgentTaskResult,
} from '../ports/OutboundPorts';

export class VideoLabService {
  private videoPort: IVideoGeneratorPort;
  private activePollers = new Map<string, ReturnType<typeof setInterval>>();

  constructor(videoPort: IVideoGeneratorPort) {
    this.videoPort = videoPort;
  }

  async submitTask(context: VideoPromptContext): Promise<string> {
    return this.videoPort.submitVideoTask(context);
  }

  async submitAgentTask(context: VideoAgentContext): Promise<string> {
    return this.videoPort.createAgentTask(context);
  }

  async queryTask(taskId: string): Promise<VideoTaskResult> {
    return this.videoPort.queryTaskStatus(taskId);
  }

  async queryAgentTask(taskId: string): Promise<VideoAgentTaskResult> {
    return this.videoPort.queryAgentTask(taskId);
  }

  async downloadVideo(fileId: string): Promise<VideoDownloadResult> {
    return this.videoPort.downloadVideo(fileId);
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
