import type { IVoicePort, T2AAsyncContext } from '../ports/OutboundPorts';
import type { ICharacterRepository } from '../ports/OutboundPorts';

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

  async generateNarrationAudio(text: string, voiceId: string): Promise<string> {
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
}
