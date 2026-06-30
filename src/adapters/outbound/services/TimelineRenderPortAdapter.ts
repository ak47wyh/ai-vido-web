/**
 * TimelineRenderPortAdapter —— ITimelineRenderPort 的 Service 包装实现
 *
 * 把 TimelineRenderService 包装为 Port 契约，
 * 供 UI 层（剪辑工作台）依赖注入时使用抽象端口而非具体服务。
 */

import type {
  ITimelineRenderPort,
  RenderExportOptions,
  RenderProgress,
} from '../../../domain/ports/TimelineRenderPorts';
import type { Timeline } from '../../../domain/ports/PostProcessPorts';
import { TimelineRenderService } from '../../../domain/services/TimelineRenderService';

export class TimelineRenderPortAdapter implements ITimelineRenderPort {
  private inner: TimelineRenderService;

  constructor(inner: TimelineRenderService) {
    this.inner = inner;
  }

  async render(
    timeline: Timeline,
    options: RenderExportOptions,
    onProgress?: (p: RenderProgress) => void,
  ): Promise<Blob> {
    return this.inner.render(timeline, options, onProgress);
  }

  async probeDuration(blob: Blob): Promise<number> {
    return this.inner.probeDuration(blob);
  }
}
