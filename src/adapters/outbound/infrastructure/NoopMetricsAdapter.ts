/**
 * NoopMetricsAdapter —— IMetricsPort 的空实现
 *
 * 后续可替换为：Prometheus 推送 / 自研埋点。
 */

import type { IMetricsPort, Counter, Histogram } from '../../../domain/ports/CrossCuttingPorts';

class NoopCounter implements Counter {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  inc(_delta?: number, _tags?: Record<string, string>): void {
    // no-op
  }
}

class NoopHistogram implements Histogram {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  observe(_value: number, _tags?: Record<string, string>): void {
    // no-op
  }
}

export class NoopMetricsAdapter implements IMetricsPort {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  counter(_name: string, _tags?: Record<string, string>): Counter {
    return new NoopCounter();
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  histogram(_name: string, _tags?: Record<string, string>): Histogram {
    return new NoopHistogram();
  }
}

export const defaultMetrics: IMetricsPort = new NoopMetricsAdapter();
