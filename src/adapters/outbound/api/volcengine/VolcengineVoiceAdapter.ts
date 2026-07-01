import type {
  IVoicePort, T2ASyncContext, T2ASyncResult, T2AAsyncContext, T2AAsyncResult, T2AAsyncStatus,
  VoiceCloneContext, VoiceCloneResult, VoiceDesignResult, VoiceListResult, VoiceType,
  FileUploadResult, T2AStreamCallbacks, T2AStreamHandle
} from '../../../../domain/ports/OutboundPorts';
import type { ApiConfig } from '../../config/ApiConfigStore';
import { VolcengineHttpClient } from './VolcengineHttpClient';
import { withRetry } from './VolcengineErrorUtils';
import { ADAPTER_TEXT_LIMITS } from '../../../../domain/constants/textLimits';

/**
 * 火山引擎语音合成适配器（豆包 TTS）。
 *
 * Endpoint：
 *   - 同步：POST /audio/speech（OpenAI 兼容协议）
 *     Body: { model, input, voice }
 *   - 异步：POST /audio/async/create + /audio/async/retrieve
 *     适合长文本 + 流式场景
 *
 * Model 映射：
 *   - 同步：doubao-tts-base / doubao-tts-pro / doubao-tts-pro-max
 *   - 异步：speech-2.8-hd / speech-2.8-turbo（与 MiniMax 命名一致）
 *
 * 限制：
 *   - Voice Clone 暂不支持（火山引擎豆包 TTS 不提供克隆能力）
 *   - Voice Design 暂不支持
 *   - 流式 TTS 需要 WebSocket，暂不实现
 *
 * 未实现的方法统一抛 NotImplementedError，调用方应通过 UI 入口判断能力可用性。
 */
export class VolcengineVoiceAdapter implements IVoicePort {
  readonly voiceCapabilities: import('../../../../domain/ports/OutboundPorts').VoiceCapabilities = {
    supportsClone: false,
    supportsDesign: false,
    supportsDelete: false,
    supportsStream: false,
  };

  private http: VolcengineHttpClient;
  private config: ApiConfig;

  constructor(config: ApiConfig) {
    this.config = config;
    this.http = new VolcengineHttpClient(config);
  }

  // ==================== 同步合成（OpenAI 兼容）====================

  async synthesizeSpeechSync(context: T2ASyncContext): Promise<T2ASyncResult> {
    if (!this.config.volcArkApiKey) {
      return this.mockTtsResult();
    }

    const result = await withRetry(() =>
      this.http.post<ArrayBuffer>('/audio/speech', {
        model: context.model ?? 'doubao-tts-base',
        input: context.text,
        voice: context.voiceId ?? 'zh_male_narration',
        response_format: 'mp3',
      }, { responseType: 'arraybuffer' }),
    );

    return {
      audioUrl: URL.createObjectURL(new Blob([result], { type: 'audio/mpeg' })),
      audioSize: result.byteLength,
      usageCharacters: context.text.length,
    };
  }

  synthesizeSpeechStream(_context: T2ASyncContext, _callbacks: T2AStreamCallbacks): T2AStreamHandle {
    // 流式 TTS（火山引擎）需要 WebSocket，暂不实现
    return { close: () => {} };
  }

  // ==================== 异步合成 ====================

  async createT2ATask(context: T2AAsyncContext): Promise<T2AAsyncResult> {
    if (!this.config.volcArkApiKey) {
      return {
        taskId: `mock-volc-tts-${Date.now()}`,
        usageCharacters: (context.text ?? '').length,
      };
    }

    // 火山异步长文本上限：100000 字符
    const rawText = context.text ?? '';
    const text = rawText.length > ADAPTER_TEXT_LIMITS.VOLC_TTS_ASYNC_MAX
      ? rawText.slice(0, ADAPTER_TEXT_LIMITS.VOLC_TTS_ASYNC_MAX)
      : rawText;

    const result = await withRetry(() =>
      this.http.post<{ id: string }>('/audio/async/create', {
        model: context.model ?? 'doubao-tts-pro',
        input: text,
        voice: context.voiceId ?? 'zh_male_narration',
        response_format: 'mp3',
      }),
    );
    return {
      taskId: result.id,
      usageCharacters: text.length,
    };
  }

  async queryT2ATask(taskId: string): Promise<T2AAsyncStatus> {
    const result = await withRetry(() =>
      this.http.get<{ id: string; status: string; audio_url?: string; error?: string }>(
        `/audio/async/retrieve?task_id=${encodeURIComponent(taskId)}`,
      ),
    );
    const statusMap: Record<string, T2AAsyncStatus['status']> = {
      'processing': 'processing',
      'success': 'success',
      'failed': 'failed',
    };
    return {
      status: statusMap[result.status] ?? 'processing',
      audioUrl: result.audio_url,
      errorMessage: result.error,
    };
  }

  // ==================== 不支持的能力 ====================

  async uploadFile(_file: File, _purpose: 'voice_clone' | 'prompt_audio' | 't2a_async_input'): Promise<FileUploadResult> {
    throw new Error('VolcengineVoiceAdapter: voice_clone/prompt_audio upload not supported by Doubao TTS');
  }

  async cloneVoice(_context: VoiceCloneContext): Promise<VoiceCloneResult> {
    throw new Error('VolcengineVoiceAdapter: voice cloning is not supported by Doubao TTS');
  }

  getFileUrl(_fileId: string): string {
    throw new Error('VolcengineVoiceAdapter: file URL retrieval not supported by Doubao TTS');
  }

  async fetchAudioAsBlobUrl(audioUrl: string): Promise<string> {
    // 直接返回 URL（已经是公网 URL）
    return audioUrl;
  }

  async designVoice(_prompt: string, _previewText: string, _voiceId?: string, _aigcWatermark?: boolean): Promise<VoiceDesignResult> {
    throw new Error('VolcengineVoiceAdapter: voice design not supported by Doubao TTS');
  }

  async getAvailableVoices(_voiceType: VoiceType): Promise<VoiceListResult> {
    // 提供预定义的几个常用声音
    return {
      systemVoices: [
        { voiceId: 'zh_male_narration', voiceName: '中文男声 - 旁白', description: '中文男声，旁白风格', type: 'system' as const },
        { voiceId: 'zh_female_gentle', voiceName: '中文女声 - 温柔', description: '中文女声，温柔风格', type: 'system' as const },
        { voiceId: 'en_male_narration', voiceName: 'English Male - Narration', description: 'English male, narration style', type: 'system' as const },
        { voiceId: 'en_female_gentle', voiceName: 'English Female - Gentle', description: 'English female, gentle style', type: 'system' as const },
      ],
    };
  }

  async deleteVoice(_voiceType: 'voice_cloning' | 'voice_generation', _voiceId: string): Promise<void> {
    throw new Error('VolcengineVoiceAdapter: voice deletion not supported by Doubao TTS');
  }

  // ==================== 内部工具 ====================

  private async mockTtsResult(): Promise<T2ASyncResult> {
    const mockBase64 = 'SUQzAwAAAAABslBTRkEAAAAQAAAAHAAABVNC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0=';
    const blob = await (await fetch(`data:audio/mp3;base64,${mockBase64}`)).blob();
    return {
      audioUrl: URL.createObjectURL(blob),
      audioSize: blob.size,
    };
  }
}