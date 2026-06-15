import type {
  IVoicePort,
  VoiceCloneContext,
  VoiceCloneResult,
  T2AAsyncContext,
  T2AAsyncResult,
  T2AAsyncStatus,
  T2ASyncContext,
  T2ASyncResult,
  VoiceDesignResult,
  VoiceType,
  VoiceListResult,
  FileUploadResult,
  T2AStreamCallbacks,
  T2AStreamHandle
} from '../../../domain/ports/OutboundPorts';
import { ApiConfigStore } from '../config/ApiConfigStore';
import { getMiniMaxErrorMessage } from './MiniMaxErrorUtils';
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
    const error = getMiniMaxErrorMessage(statusCode, data?.base_resp?.status_msg, 'MiniMax Voice Clone error');
    if (error) throw new Error(error);

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
    const error = getMiniMaxErrorMessage(statusCode, data?.base_resp?.status_msg, 'MiniMax T2A error');
    if (error) throw new Error(error);

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
    const apiError = getMiniMaxErrorMessage(statusCode, data?.base_resp?.status_msg);
    if (apiError) {
      return {
        status: 'failed',
        errorMessage: apiError,
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

  // --- Synchronous T2A ---

  async synthesizeSpeechSync(context: T2ASyncContext): Promise<T2ASyncResult> {
    const config = ApiConfigStore.load();
    if (!config.minimaxApiKey) {
      throw new Error('API Key not configured — cannot synthesize speech');
    }

    const baseUrl = config.minimaxBaseUrl.replace(/\/+$/, '');
    const model = context.model || 'speech-2.8-turbo';

    // speech-2.8 uses OpenAI-compatible /v1/audio/speech (binary response)
    // speech-02 / speech-01 uses /v1/t2a_v2 (JSON response)
    if (model.startsWith('speech-2.8')) {
      return this.synthesizeSpeechV28(baseUrl, config, context, model);
    }

    return this.synthesizeSpeechV2(baseUrl, config, context, model);
  }

  /**
   * speech-2.8 — OpenAI-compatible endpoint, returns binary audio
   */
  private async synthesizeSpeechV28(
    baseUrl: string,
    config: ReturnType<typeof ApiConfigStore.load>,
    context: T2ASyncContext,
    model: string,
  ): Promise<T2ASyncResult> {
    const payload: Record<string, unknown> = {
      model,
      input: context.text,
      voice: context.voiceId,
      speed: context.speed ?? 1,
      pitch: context.pitch ?? 0,
      volume: context.volume ?? 1,
      response_format: context.audioFormat || 'mp3',
      sample_rate: context.sampleRate ?? 32000,
    };

    console.log('[MiniMaxVoiceAdapter] speech-2.8 Sync T2A, voice:', context.voiceId, 'text length:', context.text.length);

    const response = await axios.post(`${baseUrl}/audio/speech`, payload, {
      headers: {
        Authorization: `Bearer ${config.minimaxApiKey}`,
        'Content-Type': 'application/json',
      },
      params: config.minimaxGroupId ? { GroupId: config.minimaxGroupId } : undefined,
      responseType: 'arraybuffer',
    });

    const contentType = String(response.headers?.['content-type'] || '');

    // If the response is JSON, it's an error
    if (contentType.includes('application/json')) {
      const text = new TextDecoder().decode(response.data);
      let parsed: Record<string, unknown>;
      try { parsed = JSON.parse(text); } catch { throw new Error(`speech-2.8 error: ${text}`); }
      const statusCode = (parsed?.base_resp as Record<string, unknown>)?.status_code;
      const statusMsg = (parsed?.base_resp as Record<string, unknown>)?.status_msg;
      const error = getMiniMaxErrorMessage(statusCode as number, statusMsg as string, 'MiniMax speech-2.8 error');
      throw new Error(error || `speech-2.8 error: ${text}`);
    }

    // Binary audio response — convert to blob URL
    const blob = new Blob([response.data], { type: `audio/${context.audioFormat || 'mp3'}` });
    const audioUrl = URL.createObjectURL(blob);

    return {
      audioUrl,
      audioHex: undefined,
    };
  }

  /**
   * speech-02 / speech-01 — /v1/t2a_v2 endpoint, returns JSON
   */
  private async synthesizeSpeechV2(
    baseUrl: string,
    config: ReturnType<typeof ApiConfigStore.load>,
    context: T2ASyncContext,
    model: string,
  ): Promise<T2ASyncResult> {
    const payload: Record<string, unknown> = {
      model,
      text: context.text,
      voice_setting: {
        voice_id: context.voiceId,
        speed: context.speed ?? 1,
        vol: context.volume ?? 1,
        pitch: context.pitch ?? 0,
      },
      audio_setting: {
        audio_sample_rate: context.sampleRate ?? 32000,
        bitrate: 128000,
        format: context.audioFormat || 'mp3',
        channel: 1,
      },
      output_format: context.outputFormat || 'url',
      ...(context.languageBoost ? { language_boost: context.languageBoost } : { language_boost: 'auto' }),
      ...(context.aigcWatermark !== undefined ? { aigc_watermark: context.aigcWatermark } : {}),
    };

    console.log('[MiniMaxVoiceAdapter] Sync T2A v2, voice:', context.voiceId, 'text length:', context.text.length);

    const response = await axios.post(`${baseUrl}/t2a_v2`, payload, {
      headers: {
        Authorization: `Bearer ${config.minimaxApiKey}`,
        'Content-Type': 'application/json',
      },
      params: config.minimaxGroupId ? { group_id: config.minimaxGroupId } : undefined,
    });

    const data = response.data;

    const statusCode = data?.base_resp?.status_code;
    const error = getMiniMaxErrorMessage(statusCode, data?.base_resp?.status_msg, 'MiniMax Sync T2A error');
    if (error) throw new Error(error);

    const audioUrl = data?.data?.audio_url;
    const audioHex = data?.data?.audio;
    const extraInfo = data?.extra_info;

    return {
      audioUrl,
      audioHex,
      audioLength: extraInfo?.audio_length,
      audioSize: extraInfo?.audio_size,
      usageCharacters: extraInfo?.usage_characters,
    };
  }

  // --- WebSocket Streaming T2A ---

  synthesizeSpeechStream(context: T2ASyncContext, callbacks: T2AStreamCallbacks): T2AStreamHandle {
    const config = ApiConfigStore.load();
    if (!config.minimaxApiKey) {
      const error = new Error('API Key not configured — cannot stream speech');
      callbacks.onError?.(error);
      return { close: () => {} };
    }

    // Convert https://... to wss://...
    const baseUrl = config.minimaxBaseUrl.replace(/\/+$/, '').replace(/^https?:/, (m) => m === 'https:' ? 'wss:' : 'ws:');
    const wsUrl = `${baseUrl}/t2a_v2`;

    let ws: WebSocket | null = null;
    let closed = false;

    const close = () => {
      if (closed) return;
      closed = true;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.close();
        } catch {
          // ignore
        }
      }
      ws = null;
    };

    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      callbacks.onError?.(e instanceof Error ? e : new Error(String(e)));
      return { close };
    }

    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      if (closed || !ws) return;
      const payload = {
        model: context.model || 'speech-2.8-turbo',
        text: context.text,
        voice_setting: {
          voice_id: context.voiceId,
          speed: context.speed ?? 1,
          vol: context.volume ?? 1,
          pitch: context.pitch ?? 0,
        },
        audio_setting: {
          audio_sample_rate: context.sampleRate ?? 32000,
          bitrate: 128000,
          format: context.audioFormat || 'mp3',
          channel: 1,
        },
        stream: true,
        ...(context.languageBoost ? { language_boost: context.languageBoost } : { language_boost: 'auto' }),
      };
      try {
        ws.send(JSON.stringify(payload));
      } catch (e) {
        callbacks.onError?.(e instanceof Error ? e : new Error(String(e)));
        close();
      }
    };

    ws.onmessage = (event) => {
      if (closed) return;
      // Server may send binary audio chunks or JSON control messages
      if (event.data instanceof ArrayBuffer) {
        callbacks.onAudioChunk(event.data);
      } else if (event.data instanceof Blob) {
        event.data.arrayBuffer().then(buf => callbacks.onAudioChunk(buf)).catch(() => {});
      } else if (typeof event.data === 'string') {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.base_resp?.status_code && parsed.base_resp.status_code !== 0) {
            const msg = getMiniMaxErrorMessage(parsed.base_resp.status_code, parsed.base_resp.status_msg, 'T2A Stream error');
            if (msg) {
              callbacks.onError?.(new Error(msg));
              close();
            }
          } else if (parsed.type === 'done' || parsed.audio_length) {
            callbacks.onComplete?.(parsed.audio_length);
            close();
          }
        } catch {
          // ignore non-JSON messages
        }
      }
    };

    ws.onerror = (event) => {
      if (closed) return;
      const message = (event as ErrorEvent).message || 'WebSocket error';
      callbacks.onError?.(new Error(message));
    };

    ws.onclose = () => {
      if (closed) return;
      closed = true;
      callbacks.onComplete?.();
    };

    return { close };
  }

  // --- Voice Design ---

  async designVoice(prompt: string, previewText: string, voiceId?: string): Promise<VoiceDesignResult> {
    const config = ApiConfigStore.load();
    if (!config.minimaxApiKey) {
      throw new Error('API Key not configured — cannot design voice');
    }

    const baseUrl = config.minimaxBaseUrl.replace(/\/+$/, '');

    const payload: Record<string, unknown> = {
      prompt,
      preview_text: previewText,
      model: 'speech-02-turbo',
    };

    if (voiceId) {
      payload.voice_id = voiceId;
    }

    console.log('[MiniMaxVoiceAdapter] Designing voice, prompt:', prompt.substring(0, 50));

    const response = await axios.post(`${baseUrl}/voice_design`, payload, {
      headers: {
        Authorization: `Bearer ${config.minimaxApiKey}`,
        'Content-Type': 'application/json',
      },
      params: config.minimaxGroupId ? { group_id: config.minimaxGroupId } : undefined,
    });

    const data = response.data;

    const statusCode = data?.base_resp?.status_code;
    const error = getMiniMaxErrorMessage(statusCode, data?.base_resp?.status_msg, 'MiniMax Voice Design error');
    if (error) throw new Error(error);

    const resultVoiceId = data?.data?.voice_id || data?.voice_id;
    const trialAudioHex = data?.data?.trial_audio || data?.trial_audio;

    if (!resultVoiceId) {
      console.error('[MiniMaxVoiceAdapter] Voice Design response:', JSON.stringify(data));
      throw new Error('Voice Design failed — no voice_id returned');
    }

    return {
      voiceId: resultVoiceId,
      trialAudioHex: trialAudioHex || '',
    };
  }

  // --- Get Available Voices ---

  async getAvailableVoices(voiceType: VoiceType): Promise<VoiceListResult> {
    const config = ApiConfigStore.load();
    if (!config.minimaxApiKey) {
      throw new Error('API Key not configured — cannot get voices');
    }

    const baseUrl = config.minimaxBaseUrl.replace(/\/+$/, '');

    const payload: Record<string, unknown> = {
      voice_type: voiceType,
    };

    console.log('[MiniMaxVoiceAdapter] Getting available voices, type:', voiceType);

    const response = await axios.post(`${baseUrl}/get_voice`, payload, {
      headers: {
        Authorization: `Bearer ${config.minimaxApiKey}`,
        'Content-Type': 'application/json',
      },
      params: config.minimaxGroupId ? { group_id: config.minimaxGroupId } : undefined,
    });

    const data = response.data;

    const statusCode = data?.base_resp?.status_code;
    const error = getMiniMaxErrorMessage(statusCode, data?.base_resp?.status_msg, 'MiniMax Get Voice error');
    if (error) throw new Error(error);

    const result: VoiceListResult = {};

    const systemVoices = data?.data?.system_voice || data?.system_voice;
    if (systemVoices && Array.isArray(systemVoices)) {
      result.systemVoices = systemVoices.map((v: Record<string, unknown>) => ({
        voiceId: v.voice_id as string,
        description: (v.description || v.voice_desc || '') as string,
        voiceName: (v.voice_name || v.name || v.voice_id) as string,
      }));
    }

    const clonedVoices = data?.data?.voice_cloning || data?.voice_cloning;
    if (clonedVoices && Array.isArray(clonedVoices)) {
      result.clonedVoices = clonedVoices.map((v: Record<string, unknown>) => ({
        voiceId: v.voice_id as string,
        description: (v.description || v.voice_desc || '') as string,
        voiceName: (v.voice_name || v.name || v.voice_id) as string,
        createdTime: (v.created_time || v.create_time) as string | undefined,
      }));
    }

    const designedVoices = data?.data?.voice_generation || data?.voice_generation;
    if (designedVoices && Array.isArray(designedVoices)) {
      result.designedVoices = designedVoices.map((v: Record<string, unknown>) => ({
        voiceId: v.voice_id as string,
        description: (v.description || v.voice_desc || '') as string,
        voiceName: (v.voice_name || v.name || v.voice_id) as string,
        createdTime: (v.created_time || v.create_time) as string | undefined,
      }));
    }

    return result;
  }

  // --- Delete Voice ---

  async deleteVoice(voiceType: 'voice_cloning' | 'voice_generation', voiceId: string): Promise<void> {
    const config = ApiConfigStore.load();
    if (!config.minimaxApiKey) {
      throw new Error('API Key not configured — cannot delete voice');
    }

    const baseUrl = config.minimaxBaseUrl.replace(/\/+$/, '');

    const payload = {
      voice_type: voiceType,
      voice_id: voiceId,
    };

    console.log('[MiniMaxVoiceAdapter] Deleting voice:', voiceId, 'type:', voiceType);

    const response = await axios.post(`${baseUrl}/delete_voice`, payload, {
      headers: {
        Authorization: `Bearer ${config.minimaxApiKey}`,
        'Content-Type': 'application/json',
      },
      params: config.minimaxGroupId ? { group_id: config.minimaxGroupId } : undefined,
    });

    const data = response.data;

    const statusCode = data?.base_resp?.status_code;
    const error = getMiniMaxErrorMessage(statusCode, data?.base_resp?.status_msg, 'MiniMax Delete Voice error');
    if (error) throw new Error(error);
  }
}
