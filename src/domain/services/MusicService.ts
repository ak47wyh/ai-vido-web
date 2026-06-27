import type { IMusicPort, IStorySegmentRepository, MusicGenerationContext, MusicModel, LyricsGenerationContext, LyricsGenerationResult, CoverPreprocessResult } from '../ports/OutboundPorts';
import type { PlatformRouter } from './PlatformRouter';
import { ApiConfigStore } from '../../adapters/outbound/config/ApiConfigStore';

export class MusicService {
  private router: PlatformRouter;
  segmentRepo: IStorySegmentRepository;

  constructor(
    router: PlatformRouter,
    segmentRepo: IStorySegmentRepository
  ) {
    this.router = router;
    this.segmentRepo = segmentRepo;
  }

  /** 获取当前配置对应的音乐生成适配器 */
  private getMusicPort(): IMusicPort {
    return this.router.resolveMusic(ApiConfigStore.load());
  }

  /**
   * Generate BGM for a segment and bind it.
   * Returns the audio URL.
   */
  async generateBGM(
    segmentId: string,
    prompt: string,
    options?: {
      isInstrumental?: boolean;
      lyrics?: string;
      lyricsOptimizer?: boolean;
      model?: MusicModel;
    }
  ): Promise<string> {
    const model = options?.model || 'music-2.6';
    const context: MusicGenerationContext = {
      prompt,
      lyrics: options?.lyrics,
      isInstrumental: options?.isInstrumental ?? true,
      lyricsOptimizer: options?.lyricsOptimizer,
      model,
      outputFormat: 'url',
      audioSetting: {
        sampleRate: 44100,
        bitrate: 256000,
        format: 'mp3',
      },
    };

    const result = await this.getMusicPort().generateMusic(context);

    if (!result.audioUrl) {
      throw new Error('Music generation completed but no audio URL returned');
    }

    // Bind to segment
    await this.bindBGMToSegment(
      segmentId,
      result.audioUrl,
      prompt,
      options?.lyrics,
      options?.isInstrumental ?? true
    );

    return result.audioUrl;
  }

  /**
   * Generate cover song BGM (two-step flow):
   * 1. Preprocess the reference audio to get cover_feature_id
   * 2. Generate cover music using the feature ID
   */
  async generateCoverBGM(
    segmentId: string,
    referenceAudioUrl: string,
    prompt: string,
    options?: {
      lyrics?: string;
      model?: MusicModel;
    }
  ): Promise<string> {
    const model = options?.model || 'music-cover';

    // Step 1: Preprocess reference audio
    const preprocessResult = await this.preprocessCover(referenceAudioUrl);

    // Step 2: Generate cover music with preprocessed feature
    const context: MusicGenerationContext = {
      prompt,
      lyrics: options?.lyrics || preprocessResult.formattedLyrics,
      model,
      outputFormat: 'url',
      coverFeatureId: preprocessResult.coverFeatureId,
      audioSetting: {
        sampleRate: 44100,
        bitrate: 256000,
        format: 'mp3',
      },
    };

    const result = await this.getMusicPort().generateMusic(context);

    if (!result.audioUrl) {
      throw new Error('Cover music generation completed but no audio URL returned');
    }

    // Bind to segment
    await this.bindBGMToSegment(
      segmentId,
      result.audioUrl,
      prompt,
      options?.lyrics || preprocessResult.formattedLyrics,
      false // Cover songs are not instrumental
    );

    return result.audioUrl;
  }

  /**
   * Generate lyrics based on a prompt.
   */
  async generateLyrics(prompt: string): Promise<LyricsGenerationResult> {
    const context: LyricsGenerationContext = {
      mode: 'write_full_song',
      prompt,
    };

    return this.getMusicPort().generateLyrics(context);
  }

  /**
   * Preprocess a reference audio for cover song generation.
   */
  async preprocessCover(audioUrl: string): Promise<CoverPreprocessResult> {
    return this.getMusicPort().preprocessCover(audioUrl);
  }

  /**
   * Bind a BGM audio URL to a segment.
   */
  async bindBGMToSegment(
    segmentId: string,
    audioUrl: string,
    prompt: string,
    lyrics?: string,
    isInstrumental?: boolean
  ): Promise<void> {
    const segment = await this.segmentRepo.findById(segmentId);
    if (!segment) throw new Error('Segment not found');

    segment.bgmAudioUrl = audioUrl;
    segment.bgmPrompt = prompt;
    segment.bgmLyrics = lyrics;
    segment.bgmIsInstrumental = isInstrumental;

    await this.segmentRepo.save(segment);
  }

  /**
   * Remove BGM from a segment.
   */
  async removeBGMFromSegment(segmentId: string): Promise<void> {
    const segment = await this.segmentRepo.findById(segmentId);
    if (!segment) return;

    segment.bgmAudioUrl = undefined;
    segment.bgmPrompt = undefined;
    segment.bgmLyrics = undefined;
    segment.bgmIsInstrumental = undefined;

    await this.segmentRepo.save(segment);
  }
}
