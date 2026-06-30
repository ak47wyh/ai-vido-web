/**
 * SubtitlePortAdapter —— ISubtitlePort 的 Service 包装实现
 *
 * SubtitleService 的方法名 generateSrtFromSegments 与 Port 标准的
 * generateSrt 略有差异，此适配器做翻译。
 */

import type { ISubtitlePort } from '../../../domain/ports/DomainServicePorts';
import type { StorySegment } from '../../../domain/entities/models';
import type { SrtEntry } from '../../../domain/ports/DomainServicePorts';
import { SubtitleService } from '../../../domain/services/SubtitleService';

export class SubtitlePortAdapter implements ISubtitlePort {
  private inner: SubtitleService;

  constructor(inner: SubtitleService) {
    this.inner = inner;
  }

  async generateSrt(
    audio: Blob | string,
    segments: StorySegment[],
    language?: string
  ): Promise<string> {
    if (typeof audio === 'string') {
      // 纯文本场景：直接解析+格式化
      const entries: SrtEntry[] = segments.map((seg, i) => ({
        index: i + 1,
        startMs: i * 5 * 1000,
        endMs: (i + 1) * 5 * 1000,
        text: seg.content,
      }));
      return this.inner.formatSrt(entries);
    }
    // 音频场景：转交现有实现
    return this.inner.generateSrtFromSegments(audio, segments, language ?? 'zh');
  }

  translate(srt: string, targetLanguage: string): Promise<string> {
    return this.inner.translateSrt(srt, targetLanguage);
  }

  parseSrt(srt: string): SrtEntry[] {
    return this.inner.parseSrt(srt);
  }

  formatSrt(entries: SrtEntry[]): string {
    return this.inner.formatSrt(entries);
  }
}
