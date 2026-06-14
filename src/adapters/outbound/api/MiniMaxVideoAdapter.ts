import type { IVideoGeneratorPort, VideoPromptContext, VideoTaskResult } from '../../../domain/ports/OutboundPorts';
import { ApiConfigStore } from '../config/ApiConfigStore';
import axios from 'axios';

/**
 * Adapter for MiniMax Video Generation API (video-01 model).
 * Reads the API Key and Group ID from ApiConfigStore (localStorage).
 * Falls back to mock mode when no API key is configured.
 *
 * MiniMax API Docs:
 *   - Submit task: POST /v1/video_generation
 *   - Query status: GET  /v1/query/video_generation?task_id={id}
 */
export class MiniMaxVideoAdapter implements IVideoGeneratorPort {

  private buildPrompt(context: VideoPromptContext): string {
    const parts: string[] = [];

    if (context.characters && context.characters.length > 0) {
      const charDescs = context.characters.map(c => {
        let desc = c.appearancePrompt;
        if (c.personalityPrompt) desc += `, ${c.personalityPrompt}`;
        return desc;
      });
      parts.push(charDescs.join(' and '));
    }
    if (context.background) {
      parts.push(`in ${context.background.environmentPrompt}`);
    }
    parts.push(context.actionContent);

    return parts.join(', ') + '.';
  }

  async submitVideoTask(context: VideoPromptContext): Promise<string> {
    const config = ApiConfigStore.load();
    const prompt = this.buildPrompt(context);

    // ── Mock mode (no API key configured) ──────────────────────────────────
    if (!config.minimaxApiKey) {
      console.warn('[MiniMaxVideoAdapter] No API key configured — running in mock mode.');
      await new Promise(resolve => setTimeout(resolve, 1000));
      return `mock-task-${Date.now()}`;
    }

    // ── Real API call ───────────────────────────────────────────────────────
    console.log('[MiniMaxVideoAdapter] Submitting task with prompt:', prompt);

    const response = await axios.post(
      `${config.minimaxBaseUrl}/video_generation`,
      { model: 'video-01', prompt },
      {
        headers: {
          Authorization: `Bearer ${config.minimaxApiKey}`,
          'Content-Type': 'application/json'
        },
        params: config.minimaxGroupId ? { group_id: config.minimaxGroupId } : undefined
      }
    );

    const taskId: string = response.data?.task_id;
    if (!taskId) throw new Error('MiniMax API did not return a task_id.');
    return taskId;
  }

  async queryTaskStatus(externalTaskId: string): Promise<VideoTaskResult> {
    const config = ApiConfigStore.load();

    // ── Mock mode ───────────────────────────────────────────────────────────
    if (!config.minimaxApiKey || externalTaskId.startsWith('mock-task-')) {
      await new Promise(resolve => setTimeout(resolve, 800));
      const isDone = Math.random() > 0.65;
      if (isDone) {
        return {
          status: 'SUCCESS',
          videoUrl: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4'
        };
      }
      return { status: 'PROCESSING' };
    }

    // ── Real API call ───────────────────────────────────────────────────────
    console.log(`[MiniMaxVideoAdapter] Polling status for task: ${externalTaskId}`);

    const response = await axios.get(
      `${config.minimaxBaseUrl}/query/video_generation`,
      {
        params: {
          task_id: externalTaskId,
          ...(config.minimaxGroupId ? { group_id: config.minimaxGroupId } : {})
        },
        headers: {
          Authorization: `Bearer ${config.minimaxApiKey}`
        }
      }
    );

    const data = response.data;
    const status: string = data?.status ?? '';

    if (status === 'Success') {
      return { status: 'SUCCESS', videoUrl: data?.file_id ? `${config.minimaxBaseUrl}/files/${data.file_id}` : undefined };
    }
    if (status === 'Fail') {
      return { status: 'FAILED' };
    }
    return { status: 'PROCESSING' };
  }
}
