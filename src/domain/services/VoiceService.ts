import type { IVoicePort, T2AAsyncContext, T2ASyncContext, T2ASyncResult, T2AStreamCallbacks, T2AStreamHandle, VoiceDesignResult, VoiceType, VoiceListResult } from '../ports/OutboundPorts';
import type { ICharacterRepository } from '../ports/OutboundPorts';

/** Max text length for synchronous T2A (short text = instant response) */
const SYNC_T2A_MAX_LENGTH = 500;

export class VoiceService {
  voicePort: IVoicePort;
  characterRepo: ICharacterRepository;

  constructor(
    voicePort: IVoicePort,
    characterRepo: ICharacterRepository
  ) {
    this.voicePort = voicePort;
    this.characterRepo = characterRepo;
  }

  /**
   * Clone a voice from an audio file and bind it to an existing character.
   * The character must already be saved in the repository.
   */
  async cloneVoiceForCharacter(
    characterId: string,
    audioFile: File,
    customVoiceId: string,
    promptAudioFile?: File,
    promptText?: string
  ): Promise<string> {
    const character = await this.characterRepo.findById(characterId);
    if (!character) throw new Error('Character not found');

    const voiceId = await this.cloneVoice(
      audioFile,
      customVoiceId,
      character.personalityPrompt || character.appearancePrompt || '你好，我是' + character.name,
      promptAudioFile,
      promptText
    );

    character.voiceId = voiceId;
    await this.characterRepo.save(character);

    return voiceId;
  }

  /**
   * Clone a voice from an audio file without binding to a character.
   * Use this when the character hasn't been saved yet (e.g., in a creation form).
   * Returns the cloned voiceId for the caller to store.
   */
  async cloneVoice(
    audioFile: File,
    customVoiceId: string,
    text: string,
    promptAudioFile?: File,
    promptText?: string
  ): Promise<string> {
    const { fileId } = await this.voicePort.uploadFile(audioFile, 'voice_clone');

    let promptAudioFileId: string | undefined;
    if (promptAudioFile) {
      const result = await this.voicePort.uploadFile(promptAudioFile, 'prompt_audio');
      promptAudioFileId = result.fileId;
    }

    const cloneResult = await this.voicePort.cloneVoice({
      fileId,
      voiceId: customVoiceId,
      text,
      promptAudioFileId,
      promptText,
    });

    return cloneResult.voiceId;
  }

  /**
   * Bind a voiceId to an existing character. Used after cloneVoice() when
   * the character is now saved.
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
   * Returns { taskId } for async, or { audioUrl } for sync.
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
  async synthesizeSync(text: string, voiceId: string, model?: 'speech-2.8-hd' | 'speech-2.8-turbo' | 'speech-2.6-hd' | 'speech-2.6-turbo'): Promise<T2ASyncResult> {
    const context: T2ASyncContext = {
      model: model || 'speech-2.8-turbo',
      text,
      voiceId,
      speed: 1,
      volume: 1,
      audioFormat: 'mp3',
      sampleRate: 32000,
      outputFormat: 'url',
      languageBoost: 'auto',
    };

    return this.voicePort.synthesizeSpeechSync(context);
  }

  /**
   * WebSocket 流式 T2A — 边生成边播放，最佳实时体验。
   * 返回 handle 用于中止流。
   */
  synthesizeStream(
    text: string,
    voiceId: string,
    callbacks: T2AStreamCallbacks
  ): T2AStreamHandle {
    const context: T2ASyncContext = {
      model: 'speech-2.8-turbo',
      text,
      voiceId,
      speed: 1,
      volume: 1,
      audioFormat: 'mp3',
      sampleRate: 32000,
      stream: true,
      outputFormat: 'hex',
      languageBoost: 'auto',
    };
    return this.voicePort.synthesizeSpeechStream(context, callbacks);
  }

  /**
   * Async T2A — create task, then poll for result.
   */
  async createAsyncTask(text: string, voiceId: string): Promise<string> {
    const context: T2AAsyncContext = {
      text,
      voiceId,
      model: 'speech-2.8-hd',
      speed: 1,
      audioFormat: 'mp3',
      sampleRate: 32000,
    };

    const result = await this.voicePort.createT2ATask(context);
    return result.taskId;
  }

  async queryNarrationStatus(taskId: string) {
    return this.voicePort.queryT2ATask(taskId);
  }

  /**
   * Design a new voice using text description.
   * Returns voiceId + trial audio hex for preview.
   */
  async designVoice(prompt: string, previewText: string, voiceId?: string): Promise<VoiceDesignResult> {
    return this.voicePort.designVoice(prompt, previewText, voiceId);
  }

  /**
   * Design a voice and bind it to a character.
   */
  async designVoiceForCharacter(characterId: string, prompt: string, previewText: string): Promise<string> {
    const character = await this.characterRepo.findById(characterId);
    if (!character) throw new Error('Character not found');

    const voiceId = `design_${Date.now()}`;
    const result = await this.voicePort.designVoice(prompt, previewText, voiceId);

    character.voiceId = result.voiceId;
    await this.characterRepo.save(character);

    return result.voiceId;
  }

  /**
   * Get available voices from the API.
   */
  async getAvailableVoices(voiceType: VoiceType): Promise<VoiceListResult> {
    return this.voicePort.getAvailableVoices(voiceType);
  }

  /**
   * Delete a cloned or designed voice.
   * Also unbinds it from any character currently using it.
   */
  async deleteVoice(voiceType: 'voice_cloning' | 'voice_generation', voiceId: string): Promise<void> {
    await this.voicePort.deleteVoice(voiceType, voiceId);

    // Unbind from any character using this voice
    const allCharacters = await this.characterRepo.findAll();
    for (const char of allCharacters) {
      if (char.voiceId === voiceId) {
        char.voiceId = undefined;
        await this.characterRepo.save(char);
      }
    }
  }
}
