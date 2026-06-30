/**
 * AutoEditPortAdapter —— IAutoEditPort 的 Service 包装实现
 *
 * 包装现有 AutoEditService，把"自动剪辑"能力暴露为 Port 契约。
 * 现有 Service 方法签名与 Port 完全一致，仅做依赖反转包装。
 */

import type { IAutoEditPort, KeyframeInfo, CutSuggestion } from '../../../domain/ports/DomainServicePorts';
import { AutoEditService } from '../../../domain/services/AutoEditService';

export class AutoEditPortAdapter implements IAutoEditPort {
  private inner: AutoEditService;

  constructor(inner: AutoEditService) {
    this.inner = inner;
  }

  detectKeyframes(video: Blob, sampleIntervalSec?: number): Promise<KeyframeInfo[]> {
    return this.inner.detectKeyframes(video, sampleIntervalSec);
  }

  suggestCuts(video: Blob, targetDurationSec?: number): Promise<CutSuggestion[]> {
    return this.inner.suggestCuts(video, targetDurationSec);
  }

  autoTrim(video: Blob, motionThreshold?: number): Promise<Blob> {
    return this.inner.autoTrim(video, motionThreshold);
  }
}