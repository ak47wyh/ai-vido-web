import type {
  IMusicPort,
  MusicGenerationContext,
  MusicGenerationResult,
  LyricsGenerationContext,
  LyricsGenerationResult,
  CoverPreprocessResult
} from '../../../domain/ports/OutboundPorts';
import { ApiConfigStore } from '../config/ApiConfigStore';
import axios from 'axios';

export class MiniMaxMusicAdapter implements IMusicPort {

  async generateMusic(context: MusicGenerationContext): Promise<MusicGenerationResult> {
    const config = ApiConfigStore.load();
    if (!config.minimaxApiKey) {
      // Mock mode: return a placeholder result
      console.warn('[MiniMaxMusicAdapter] No API Key configured — returning mock result');
      return {
        audioUrl: '',
        duration: 0,
      };
    }

    const baseUrl = config.minimaxBaseUrl.replace(/\/+$/, '');

    const payload: Record<string, unknown> = {
      model: context.model || 'music-2.6',
      prompt: context.prompt,
      output_format: context.outputFormat || 'url',
    };

    if (context.lyrics) {
      payload.lyrics = context.lyrics;
    }

    if (context.isInstrumental !== undefined) {
      payload.is_instrumental = context.isInstrumental;
    }

    if (context.lyricsOptimizer !== undefined) {
      payload.lyrics_optimizer = context.lyricsOptimizer;
    }

    if (context.audioSetting) {
      payload.audio_setting = {
        sample_rate: context.audioSetting.sampleRate ?? 44100,
        bitrate: context.audioSetting.bitrate ?? 256000,
        format: context.audioSetting.format ?? 'mp3',
      };
    }

    console.log('[MiniMaxMusicAdapter] Generating music, prompt:', context.prompt.substring(0, 50));

    const response = await axios.post(`${baseUrl}/music_generation`, payload, {
      headers: {
        Authorization: `Bearer ${config.minimaxApiKey}`,
        'Content-Type': 'application/json',
      },
      params: config.minimaxGroupId ? { group_id: config.minimaxGroupId } : undefined,
      timeout: 120000, // Music generation can take up to 2 minutes
    });

    const data = response.data;

    const statusCode = data?.base_resp?.status_code;
    if (statusCode !== undefined && statusCode !== 0) {
      const statusMsg = data?.base_resp?.status_msg || `Music generation error (code ${statusCode})`;
      throw new Error(`MiniMax Music Generation error: ${statusMsg}`);
    }

    const extraInfo = data?.extra_info || {};
    const audioUrl = data?.data?.audio_url || data?.data?.audio;
    const audioHex = context.outputFormat === 'hex' ? data?.data?.audio : undefined;

    return {
      audioUrl: typeof audioUrl === 'string' && !audioUrl.startsWith('http') ? undefined : audioUrl,
      audioHex,
      duration: extraInfo.music_duration,
      sampleRate: extraInfo.music_sample_rate,
      bitrate: extraInfo.bitrate,
    };
  }

  async generateLyrics(context: LyricsGenerationContext): Promise<LyricsGenerationResult> {
    const config = ApiConfigStore.load();
    if (!config.minimaxApiKey) {
      console.warn('[MiniMaxMusicAdapter] No API Key configured — returning mock lyrics');
      return {
        songTitle: 'Mock Song',
        styleTags: 'Pop, Upbeat',
        lyrics: '[Verse]\n这是一首示例歌词\n请配置 API Key 以使用歌词生成功能',
      };
    }

    const baseUrl = config.minimaxBaseUrl.replace(/\/+$/, '');

    const payload: Record<string, unknown> = {
      mode: context.mode,
      prompt: context.prompt,
    };

    if (context.lyrics) {
      payload.lyrics = context.lyrics;
    }

    if (context.title) {
      payload.title = context.title;
    }

    console.log('[MiniMaxMusicAdapter] Generating lyrics, prompt:', context.prompt.substring(0, 50));

    const response = await axios.post(`${baseUrl}/lyrics_generation`, payload, {
      headers: {
        Authorization: `Bearer ${config.minimaxApiKey}`,
        'Content-Type': 'application/json',
      },
      params: config.minimaxGroupId ? { group_id: config.minimaxGroupId } : undefined,
    });

    const data = response.data;

    const statusCode = data?.base_resp?.status_code;
    if (statusCode !== undefined && statusCode !== 0) {
      const statusMsg = data?.base_resp?.status_msg || `Lyrics generation error (code ${statusCode})`;
      throw new Error(`MiniMax Lyrics Generation error: ${statusMsg}`);
    }

    return {
      songTitle: data?.song_title || '',
      styleTags: data?.style_tags || '',
      lyrics: data?.lyrics || '',
    };
  }

  async preprocessCover(audioUrl: string): Promise<CoverPreprocessResult> {
    const config = ApiConfigStore.load();
    if (!config.minimaxApiKey) {
      throw new Error('API Key not configured — cannot preprocess cover');
    }

    const baseUrl = config.minimaxBaseUrl.replace(/\/+$/, '');

    const payload = {
      model: 'music-cover',
      audio_url: audioUrl,
    };

    console.log('[MiniMaxMusicAdapter] Preprocessing cover audio');

    const response = await axios.post(`${baseUrl}/music_cover_preprocess`, payload, {
      headers: {
        Authorization: `Bearer ${config.minimaxApiKey}`,
        'Content-Type': 'application/json',
      },
      params: config.minimaxGroupId ? { group_id: config.minimaxGroupId } : undefined,
    });

    const data = response.data;

    const statusCode = data?.base_resp?.status_code;
    if (statusCode !== undefined && statusCode !== 0) {
      const statusMsg = data?.base_resp?.status_msg || `Cover preprocess error (code ${statusCode})`;
      throw new Error(`MiniMax Cover Preprocess error: ${statusMsg}`);
    }

    return {
      coverFeatureId: data?.cover_feature_id || '',
      formattedLyrics: data?.formatted_lyrics || '',
      structureResult: data?.structure_result || '',
      audioDuration: data?.audio_duration || 0,
    };
  }
}
