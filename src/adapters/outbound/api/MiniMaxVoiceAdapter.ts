import type {
  IVoicePort,
  VoiceCloneContext,
  VoiceCloneResult,
  T2AAsyncContext,
  T2AAsyncResult,
  T2AAsyncStatus,
  FileUploadResult
} from '../../../domain/ports/OutboundPorts';
import { ApiConfigStore } from '../config/ApiConfigStore';
import axios from 'axios';

export class MiniMaxVoiceAdapter implements IVoicePort {

  async uploadFile(file: File, purpose: 'voice_clone' | 'prompt_audio' | 't2a_async_input'): Promise<FileUploadResult> {
    const config = ApiConfigStore.load();
    if (!config.minimaxApiKey) {
      throw new Error('API Key not configured — cannot upload file');
    }

    const baseUrl = config.minimaxBaseUrl.replace(/\/+$/, '');
    const formData = new FormData();
    formData.append('purpose', purpose);
    formData.append('file', file);

    const response = await axios.post(`${baseUrl}/files/upload`, formData, {
      headers: {
        Authorization: `Bearer ${config.minimaxApiKey}`,
      },
      params: config.minimaxGroupId ? { group_id: config.minimaxGroupId } : undefined,
    });

    const fileId = response.data?.file?.file_id;
    if (!fileId) {
      console.error('[MiniMaxVoiceAdapter] Upload response:', JSON.stringify(response.data));
      throw new Error('Failed to upload file — no file_id returned');
    }

    return { fileId };
  }

  async cloneVoice(context: VoiceCloneContext): Promise<VoiceCloneResult> {
    const config = ApiConfigStore.load();
    if (!config.minimaxApiKey) {
      throw new Error('API Key not configured — cannot clone voice');
    }

    const baseUrl = config.minimaxBaseUrl.replace(/\/+$/, '');

    const payload: Record<string, unknown> = {
      file_id: context.fileId,
      voice_id: context.voiceId,
      text: context.text,
      model: 'speech-2.8-hd',
    };

    if (context.promptAudioFileId) {
      payload.clone_prompt = {
        prompt_audio: context.promptAudioFileId,
        ...(context.promptText ? { prompt_text: context.promptText } : {}),
      };
    }

    console.log('[MiniMaxVoiceAdapter] Cloning voice:', context.voiceId);

    const response = await axios.post(`${baseUrl}/voice_clone`, payload, {
      headers: {
        Authorization: `Bearer ${config.minimaxApiKey}`,
        'Content-Type': 'application/json',
      },
      params: config.minimaxGroupId ? { group_id: config.minimaxGroupId } : undefined,
    });

    const data = response.data;

    const statusCode = data?.base_resp?.status_code;
    if (statusCode !== undefined && statusCode !== 0) {
      const statusMsg = data?.base_resp?.status_msg || `Voice clone error (code ${statusCode})`;
      throw new Error(`MiniMax Voice Clone error: ${statusMsg}`);
    }

    const previewAudioUrl = data?.data?.audio_url || data?.extra_info?.audio_url;

    return {
      voiceId: context.voiceId,
      previewAudioUrl,
    };
  }

  async createT2ATask(context: T2AAsyncContext): Promise<T2AAsyncResult> {
    const config = ApiConfigStore.load();
    if (!config.minimaxApiKey) {
      throw new Error('API Key not configured — cannot create T2A task');
    }

    const baseUrl = config.minimaxBaseUrl.replace(/\/+$/, '');

    const payload = {
      model: context.model || 'speech-2.8-hd',
      text: context.text,
      voice_setting: {
        voice_id: context.voiceId,
        speed: context.speed ?? 1,
        vol: context.vol ?? 1,
        pitch: context.pitch ?? 0,
      },
      audio_setting: {
        audio_sample_rate: context.sampleRate ?? 32000,
        bitrate: 128000,
        format: context.audioFormat || 'mp3',
        channel: 1,
      },
      language_boost: 'auto',
    };

    console.log('[MiniMaxVoiceAdapter] Creating T2A task, voice:', context.voiceId, 'text length:', context.text.length);

    const response = await axios.post(`${baseUrl}/t2a_async_v2`, payload, {
      headers: {
        Authorization: `Bearer ${config.minimaxApiKey}`,
        'Content-Type': 'application/json',
      },
      params: config.minimaxGroupId ? { group_id: config.minimaxGroupId } : undefined,
    });

    const data = response.data;

    const statusCode = data?.base_resp?.status_code;
    if (statusCode !== undefined && statusCode !== 0) {
      const statusMsg = data?.base_resp?.status_msg || `T2A error (code ${statusCode})`;
      throw new Error(`MiniMax T2A error: ${statusMsg}`);
    }

    const taskId = data?.data?.task_id || data?.task_id;
    if (!taskId) {
      console.error('[MiniMaxVoiceAdapter] T2A response:', JSON.stringify(data));
      throw new Error('T2A task creation failed — no task_id returned');
    }

    return { taskId };
  }

  async queryT2ATask(taskId: string): Promise<T2AAsyncStatus> {
    const config = ApiConfigStore.load();
    if (!config.minimaxApiKey) {
      throw new Error('API Key not configured');
    }

    const baseUrl = config.minimaxBaseUrl.replace(/\/+$/, '');

    const response = await axios.get(`${baseUrl}/query/t2a_async_query_v2`, {
      params: {
        task_id: taskId,
        ...(config.minimaxGroupId ? { group_id: config.minimaxGroupId } : {}),
      },
      headers: {
        Authorization: `Bearer ${config.minimaxApiKey}`,
      },
    });

    const data = response.data;

    const statusCode = data?.base_resp?.status_code;
    if (statusCode !== undefined && statusCode !== 0) {
      return {
        status: 'failed',
        errorMessage: data?.base_resp?.status_msg || `Query error (code ${statusCode})`,
      };
    }

    const taskStatus = data?.data?.status || data?.status || '';

    if (taskStatus === 'done' || taskStatus === 'Success') {
      const audioFileId = data?.data?.audio_file_id || data?.file_id;
      const audioUrl = audioFileId ? this.getFileUrl(audioFileId) : undefined;
      const audioDuration = data?.data?.audio_duration;

      return {
        status: 'done',
        audioFileId,
        audioUrl,
        audioDuration,
      };
    }

    if (taskStatus === 'failed' || taskStatus === 'Fail') {
      return {
        status: 'failed',
        errorMessage: data?.data?.error_msg || 'T2A task failed',
      };
    }

    return { status: 'running' };
  }

  getFileUrl(fileId: string): string {
    const config = ApiConfigStore.load();
    const baseUrl = config.minimaxBaseUrl.replace(/\/+$/, '');
    return `${baseUrl}/files/retrieve_content?file_id=${fileId}`;
  }
}
