import type {
  IMusicPort,
  MusicGenerationContext,
  MusicGenerationResult,
  LyricsGenerationContext,
  LyricsGenerationResult,
  CoverPreprocessResult,
} from '../ports/OutboundPorts';
import type { PlatformRouter } from './PlatformRouter';
import { ApiConfigStore } from '../../adapters/outbound/config/ApiConfigStore';

export interface ResolvedMusicResult {
  audioUrl: string;
  duration: number;
  sampleRate: number;
  bitrate: number;
  channel: number;
  size: number;
}

/**
 * 独立音乐实验室服务，仅注入 IMusicPort。
 * 负责 hex → Blob URL 转换，UI 层直接拿到可播放的 URL。
 */
export class MusicLabService {
  private router: PlatformRouter;

  constructor(router: PlatformRouter) {
    this.router = router;
  }

  /** 获取当前配置对应的音乐生成适配器 */
  private getMusicPort(): IMusicPort {
    return this.router.resolveMusic(ApiConfigStore.load());
  }

  /**
   * 生成音乐 — 返回可播放的 Blob URL
   * 内部处理 hex → Blob URL 转换
   */
  async generateMusic(context: MusicGenerationContext): Promise<ResolvedMusicResult> {
    // 使用 hex 格式请求，Service 层负责转 Blob URL
    const result: MusicGenerationResult = await this.getMusicPort().generateMusic({
      ...context,
      outputFormat: 'hex',
    });

    const audioUrl = await this.resolveAudioUrl(result);

    return {
      audioUrl,
      duration: result.duration || 0,
      sampleRate: result.sampleRate || 44100,
      bitrate: result.bitrate || 256000,
      channel: result.channel || 2,
      size: result.size || 0,
    };
  }

  /** 歌词生成 */
  async generateLyrics(context: LyricsGenerationContext): Promise<LyricsGenerationResult> {
    return this.getMusicPort().generateLyrics(context);
  }

  /** 翻唱前处理 */
  async preprocessCover(audioUrl: string): Promise<CoverPreprocessResult> {
    return this.getMusicPort().preprocessCover(audioUrl);
  }

  /**
   * 翻唱生成 — 复用 generateMusic，传入 cover_feature_id
   */
  async generateCover(params: {
    coverFeatureId: string;
    lyrics: string;
    prompt: string;
    model?: 'music-cover' | 'music-cover-free';
    audioSetting?: MusicGenerationContext['audioSetting'];
  }): Promise<ResolvedMusicResult> {
    return this.generateMusic({
      model: params.model || 'music-cover',
      prompt: params.prompt,
      lyrics: params.lyrics,
      coverFeatureId: params.coverFeatureId,
      outputFormat: 'hex',
      audioSetting: params.audioSetting,
    });
  }

  /** 下载音乐文件 */
  downloadMusic(blobUrl: string, filename: string): void {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /**
   * 将 MusicGenerationResult 解析为可播放的 Blob URL
   * - audioHex: hex 编码 → Blob URL
   * - audioUrl: 直接返回（Mock 模式或 URL 格式）
   */
  private async resolveAudioUrl(result: MusicGenerationResult): Promise<string> {
    // hex 优先
    if (result.audioHex) {
      return this.hexToBlobUrl(result.audioHex);
    }
    // URL 格式
    if (result.audioUrl) {
      // Mock URL 直接返回
      if (result.audioUrl.startsWith('mock://')) {
        return result.audioUrl;
      }
      return result.audioUrl;
    }
    throw new Error('音频生成失败：未返回音频数据');
  }

  /** hex 编码音频转 Blob URL */
  private hexToBlobUrl(hex: string): string {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    const blob = new Blob([bytes], { type: 'audio/mpeg' });
    return URL.createObjectURL(blob);
  }
}
