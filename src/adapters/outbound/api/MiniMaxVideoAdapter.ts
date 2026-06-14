import type { IVideoGeneratorPort, VideoPromptContext, VideoTaskResult } from '../../../domain/ports/OutboundPorts';
import { ApiConfigStore } from '../config/ApiConfigStore';
import axios from 'axios';

/**
 * Adapter for MiniMax Video Generation API.
 * Reads the API Key and Group ID from ApiConfigStore (localStorage).
 * Falls back to mock mode when no API key is configured.
 *
 * MiniMax API Docs (2025):
 *   - Submit task: POST https://api.minimaxi.com/v1/video_generation
 *   - Query status: GET  https://api.minimaxi.com/v1/query/video_generation?task_id={id}
 *   - Download file: GET  https://api.minimaxi.com/v1/files/{file_id}
 *
 * Response codes (base_resp.status_code):
 *   0: success | 1002: rate limit | 1004: auth failed
 *   1008: insufficient balance | 1026: sensitive content | 2013: invalid params
 *   2049: invalid api key
 *
 * Task statuses: Preparing → Queueing → Processing → Success / Fail
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

    const baseUrl = config.minimaxBaseUrl.replace(/\/+$/, '');
    const response = await axios.post(
      `${baseUrl}/video_generation`,
      {
        model: 'T2V-01-Director',
        prompt,
        prompt_optimizer: true
      },
      {
        headers: {
          Authorization: `Bearer ${config.minimaxApiKey}`,
          'Content-Type': 'application/json'
        },
        params: config.minimaxGroupId ? { group_id: config.minimaxGroupId } : undefined
      }
    );

    const data = response.data;

    // Check base_resp for error codes
    const statusCode = data?.base_resp?.status_code;
    const statusMsg = data?.base_resp?.status_msg || '';

    if (statusCode !== undefined && statusCode !== 0) {
      const errorMessages: Record<number, string> = {
        1002: 'Rate limited — please try again later',
        1004: 'Authentication failed — check your API Key',
        1008: 'Insufficient account balance',
        1026: 'Prompt contains sensitive content — please revise',
        2013: 'Invalid parameters — check your request',
        2049: 'Invalid API Key'
      };
      const msg = errorMessages[statusCode] || statusMsg || `API error (code ${statusCode})`;
      throw new Error(`MiniMax API error: ${msg}`);
    }

    const taskId: string = data?.task_id;
    if (!taskId) {
      // Log full response for debugging
      console.error('[MiniMaxVideoAdapter] Unexpected response:', JSON.stringify(data));
      throw new Error('MiniMax API did not return a task_id. Please check your API Key and Group ID configuration.');
    }
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

    const baseUrl = config.minimaxBaseUrl.replace(/\/+$/, '');
    const response = await axios.get(
      `${baseUrl}/query/video_generation`,
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

    // Check for API-level errors
    const statusCode = data?.base_resp?.status_code;
    if (statusCode !== undefined && statusCode !== 0) {
      // 1002 = rate limit, treat as still processing (will retry)
      if (statusCode === 1002) {
        return { status: 'PROCESSING' };
      }
      // Other errors = fail the task
      const statusMsg = data?.base_resp?.status_msg || `API error (code ${statusCode})`;
      return { status: 'FAILED', errorMessage: statusMsg };
    }

    if (status === 'Success') {
      const fileId = data?.file_id;
      // Build video URL via File API
      const videoUrl = fileId ? `${baseUrl}/files/${fileId}` : undefined;
      return { status: 'SUCCESS', videoUrl };
    }
    if (status === 'Fail') {
      const failMsg = data?.base_resp?.status_msg || 'Video generation failed';
      return { status: 'FAILED', errorMessage: failMsg };
    }
    // Preparing / Queueing / Processing → all map to PROCESSING
    return { status: 'PROCESSING' };
  }
}
