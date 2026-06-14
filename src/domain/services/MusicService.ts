import type { IMusicPort, IStorySegmentRepository, MusicGenerationContext, LyricsGenerationContext, LyricsGenerationResult } from '../ports/OutboundPorts';

export class MusicService {
  musicPort: IMusicPort;
  segmentRepo: IStorySegmentRepository;

  constructor(
    musicPort: IMusicPort,
    segmentRepo: IStorySegmentRepository
  ) {
    this.musicPort = musicPort;
    this.segmentRepo = segmentRepo;
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
    }
  ): Promise<string> {
    const context: MusicGenerationContext = {
      prompt,
      lyrics: options?.lyrics,
      isInstrumental: options?.isInstrumental ?? true,
      lyricsOptimizer: options?.lyricsOptimizer,
      model: 'music-2.6',
      outputFormat: 'url',
      audioSetting: {
        sampleRate: 44100,
        bitrate: 256000,
        format: 'mp3',
      },
    };

    const result = await this.musicPort.generateMusic(context);

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
   * Generate lyrics based on a prompt.
   */
  async generateLyrics(prompt: string): Promise<LyricsGenerationResult> {
    const context: LyricsGenerationContext = {
      mode: 'write_full_song',
      prompt,
    };

    return this.musicPort.generateLyrics(context);
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
