import type { IWhisperPort, TranscriptSegment } from '../../../domain/ports/PostProcessPorts';

/**
 * WhisperAdapter — 字幕转录适配器（占位实现）
 *
 * 当前实现：返回空数组。生产环境应接入以下任一方案：
 * 1. 本地 whisper.cpp (WASM) — 离线、零成本
 * 2. 远程 Whisper API（OpenAI、自托管）— 准确率高
 * 3. MiniMax ASR（如未来提供）— 平台内集成
 *
 * 浏览器 Web Speech API 不支持 Blob 输入，仅支持实时流式录音，
 * 因此不适合作为该接口的默认实现。
 */
export class WhisperAdapter implements IWhisperPort {
  private loaded = false;

  isLoaded(): boolean {
    return this.loaded;
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transcribe(_audio: Blob | string, _language = 'zh'): Promise<TranscriptSegment[]> {
    await this.load();
    console.warn('WhisperAdapter: 当前为占位实现，请接入真实 Whisper 服务以获得字幕转录');
    return [];
  }
}
