import type { IVoicePort, T2AAsyncContext, T2AAsyncStatus, T2ASyncContext, T2ASyncResult, T2AStreamCallbacks, T2AStreamHandle, VoiceDesignResult, VoiceType, VoiceListResult } from '../ports/OutboundPorts';
import type { ICharacterRepository } from '../ports/OutboundPorts';
import type { StorySegment } from '../entities/models';
import type { PlatformRouter } from './PlatformRouter';
import { ApiConfigStore } from '../../adapters/outbound/config/ApiConfigStore';

/** Max text length for synchronous T2A (short text = instant response) */
const SYNC_T2A_MAX_LENGTH = 500;

/** Clone voice options */
export interface CloneVoiceOptions {
  needNoiseReduction?: boolean;
  needVolumeNormalization?: boolean;
  languageBoost?: string;
  model?: string;
  aigcWatermark?: boolean;
}

export class VoiceService {
  private router: PlatformRouter;
  characterRepo: ICharacterRepository;

  constructor(
    router: PlatformRouter,
    characterRepo: ICharacterRepository
  ) {
    this.router = router;
    this.characterRepo = characterRepo;
  }

  /** 获取当前配置对应的语音合成适配器 */
  private getVoicePort(): IVoicePort {
    return this.router.resolveVoice(ApiConfigStore.load());
  }

  /**
   * Clone a voice from an audio file and bind it to an existing character.
   */
  async cloneVoiceForCharacter(
    characterId: string,
    audioFile: File,
    customVoiceId: string,
    text?: string,
    promptAudioFile?: File,
    promptText?: string,
    options?: CloneVoiceOptions
  ): Promise<string> {
    const character = await this.characterRepo.findById(characterId);
    if (!character) throw new Error('Character not found');

    const voiceId = await this.cloneVoice(
      audioFile,
      customVoiceId,
      text || character.personalityPrompt || character.appearancePrompt || '你好，我是' + character.name,
      promptAudioFile,
      promptText,
      options
    );

    character.voiceId = voiceId;
    await this.characterRepo.save(character);

    return voiceId;
  }

  /**
   * Clone a voice from an audio file without binding to a character.
   */
  async cloneVoice(
    audioFile: File,
    customVoiceId: string,
    text?: string,
    promptAudioFile?: File,
    promptText?: string,
    options?: CloneVoiceOptions
  ): Promise<string> {
    const { fileId } = await this.getVoicePort().uploadFile(audioFile, 'voice_clone');

    let promptAudioFileId: string | undefined;
    if (promptAudioFile) {
      const result = await this.getVoicePort().uploadFile(promptAudioFile, 'prompt_audio');
      promptAudioFileId = result.fileId;
    }

    const cloneResult = await this.getVoicePort().cloneVoice({
      fileId,
      voiceId: customVoiceId,
      text,
      promptAudioFileId,
      promptText,
      ...options,
    });

    // 风控检测
    if (cloneResult.inputSensitive) {
      console.warn('[VoiceService] Cloned audio triggered content moderation');
    }

    return cloneResult.voiceId;
  }

  /**
   * Bind a voiceId to an existing character.
   */
  async bindVoiceToCharacter(characterId: string, voiceId: string): Promise<void> {
    const character = await this.characterRepo.findById(characterId);
    if (!character) throw new Error('Character not found');
    character.voiceId = voiceId;
    await this.characterRepo.save(character);
  }

  async setSystemVoiceForCharacter(characterId: string, voiceId: string): Promise<void> {
    const character = await this.characterRepo.findById(characterId);
    if (!character) throw new Error('Character not found');

    character.voiceId = voiceId;
    await this.characterRepo.save(character);
  }

  /**
   * Smart narration generation: short text uses sync T2A (instant),
   * long text uses async T2A (polling required).
   */
  async generateNarrationAudio(text: string, voiceId: string): Promise<{ taskId?: string; audioUrl?: string }> {
    if (text.length <= SYNC_T2A_MAX_LENGTH) {
      const result = await this.synthesizeSync(text, voiceId);
      return { audioUrl: result.audioUrl };
    }

    const taskId = await this.createAsyncTask(text, voiceId);
    return { taskId };
  }

  /**
   * Synchronous T2A — instant response, best for short text (≤500 chars).
   */
  async synthesizeSync(
    text: string,
    voiceId: string,
    model?: T2ASyncContext['model'],
    options?: Partial<Omit<T2ASyncContext, 'text' | 'voiceId' | 'model'>>
  ): Promise<T2ASyncResult> {
    const context: T2ASyncContext = {
      model: model || 'speech-2.8-turbo',
      text,
      voiceId,
      speed: options?.speed ?? 1,
      volume: options?.volume ?? 1,
      audioFormat: options?.audioFormat || 'mp3',
      sampleRate: options?.sampleRate ?? 32000,
      outputFormat: options?.outputFormat || 'url',
      languageBoost: options?.languageBoost || 'auto',
      ...options,
    };

    return this.getVoicePort().synthesizeSpeechSync(context);
  }

  /**
   * WebSocket 流式 T2A — 边生成边播放，最佳实时体验。
   */
  synthesizeStream(
    text: string,
    voiceId: string,
    callbacks: T2AStreamCallbacks,
    options?: Partial<Omit<T2ASyncContext, 'text' | 'voiceId'>>
  ): T2AStreamHandle {
    const context: T2ASyncContext = {
      model: options?.model || 'speech-2.8-turbo',
      text,
      voiceId,
      speed: options?.speed ?? 1,
      volume: options?.volume ?? 1,
      audioFormat: options?.audioFormat || 'mp3',
      sampleRate: options?.sampleRate ?? 32000,
      stream: true,
      outputFormat: options?.outputFormat || 'hex',
      languageBoost: options?.languageBoost || 'auto',
      ...options,
    };
    return this.getVoicePort().synthesizeSpeechStream(context, callbacks);
  }

  /**
   * Async T2A — create task, then poll for result.
   */
  async createAsyncTask(
    text: string,
    voiceId: string,
    options?: Partial<Omit<T2AAsyncContext, 'text' | 'voiceId'>>
  ): Promise<string> {
    const context: T2AAsyncContext = {
      text,
      voiceId,
      model: options?.model || 'speech-2.8-hd',
      speed: options?.speed ?? 1,
      audioFormat: options?.audioFormat || 'mp3',
      sampleRate: options?.sampleRate ?? 32000,
      ...options,
    };

    const result = await this.getVoicePort().createT2ATask(context);
    return result.taskId;
  }

  /**
   * 从文件创建异步 T2A 任务
   */
  async createAsyncTaskFromFile(
    fileId: string,
    voiceId: string,
    options?: Partial<Omit<T2AAsyncContext, 'textFileId' | 'voiceId'>>
  ): Promise<string> {
    const context: T2AAsyncContext = {
      textFileId: fileId,
      voiceId,
      model: options?.model || 'speech-2.8-hd',
      speed: options?.speed ?? 1,
      audioFormat: options?.audioFormat || 'mp3',
      sampleRate: options?.sampleRate ?? 32000,
      ...options,
    };

    const result = await this.getVoicePort().createT2ATask(context);
    return result.taskId;
  }

  async queryNarrationStatus(taskId: string): Promise<T2AAsyncStatus> {
    return this.getVoicePort().queryT2ATask(taskId);
  }

  /**
   * Design a new voice using text description.
   */
  async designVoice(prompt: string, previewText: string, voiceId?: string, aigcWatermark?: boolean): Promise<VoiceDesignResult> {
    return this.getVoicePort().designVoice(prompt, previewText, voiceId, aigcWatermark);
  }

  /**
   * Design a voice and bind it to a character.
   */
  async designVoiceForCharacter(characterId: string, prompt: string, previewText: string): Promise<string> {
    const character = await this.characterRepo.findById(characterId);
    if (!character) throw new Error('Character not found');

    const voiceId = `design_${Date.now()}`;
    const result = await this.getVoicePort().designVoice(prompt, previewText, voiceId);

    character.voiceId = result.voiceId;
    await this.characterRepo.save(character);

    return result.voiceId;
  }

  /**
   * 激活克隆/设计音色（用该音色调用一次 T2A）
   */
  async activateVoice(voiceId: string): Promise<void> {
    await this.synthesizeSync('音色激活测试', voiceId, 'speech-2.8-turbo');
  }

  /**
   * 试听音色（使用指定音色合成短文本）
   * 返回可直接播放的 Blob URL
   */
  async previewVoice(voiceId: string, text?: string): Promise<string> {
    const previewText = text || '这是一段试听文本，用于展示该音色的效果。';
    const result = await this.synthesizeSync(previewText, voiceId);
    return this.resolveAudioUrl(result);
  }

  /**
   * 将 T2ASyncResult 解析为可播放的 Blob URL
   * - 如果返回的是 hex 编码，直接转 Blob URL
   * - 如果返回的是 URL，通过 fetchAudioAsBlobUrl 带 auth 下载后转 Blob URL
   */
  async resolveAudioUrl(result: T2ASyncResult): Promise<string> {
    if (result.audioHex) {
      return this.hexToBlobUrl(result.audioHex);
    }
    if (result.audioUrl) {
      return this.getVoicePort().fetchAudioAsBlobUrl(result.audioUrl);
    }
    throw new Error('未返回音频数据');
  }

  /**
   * 下载音频文件到本地
   */
  async downloadAudio(audioUrl: string, filename: string): Promise<void> {
    // 先获取 Blob URL（带认证）
    const blobUrl = await this.getVoicePort().fetchAudioAsBlobUrl(audioUrl);
    try {
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      // 下载完成后释放 Blob URL
      URL.revokeObjectURL(blobUrl);
    }
  }

  /** hex 编码音频转 Blob URL */
  private hexToBlobUrl(hex: string, format = 'mp3'): string {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    const blob = new Blob([bytes], { type: `audio/${format}` });
    return URL.createObjectURL(blob);
  }

  /**
   * Get available voices from the API.
   */
  async getAvailableVoices(voiceType: VoiceType): Promise<VoiceListResult> {
    return this.getVoicePort().getAvailableVoices(voiceType);
  }

  /**
   * 获取音色使用情况（哪些角色在使用）
   */
  async getVoiceUsage(voiceId: string): Promise<string[]> {
    const allCharacters = await this.characterRepo.findAll();
    return allCharacters.filter(c => c.voiceId === voiceId).map(c => c.name);
  }

  /**
   * Delete a cloned or designed voice.
   * Also unbinds it from any character currently using it.
   */
  async deleteVoice(voiceType: 'voice_cloning' | 'voice_generation', voiceId: string): Promise<void> {
    await this.getVoicePort().deleteVoice(voiceType, voiceId);

    // Unbind from any character using this voice
    const allCharacters = await this.characterRepo.findAll();
    for (const char of allCharacters) {
      if (char.voiceId === voiceId) {
        char.voiceId = undefined;
        await this.characterRepo.save(char);
      }
    }
  }

  /**
   * 批量生成故事旁白：为所有分镜创建异步任务
   * 返回 Map<segmentId, taskId>
   */
  async batchGenerateNarration(segments: StorySegment[], voiceId: string): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    for (const seg of segments) {
      if (!seg.content?.trim()) continue;
      try {
        const taskId = await this.createAsyncTask(seg.content, voiceId);
        results.set(seg.id, taskId);
      } catch (e) {
        console.error(`[VoiceService] Failed to create T2A task for segment ${seg.id}:`, e);
      }
    }
    return results;
  }
}
