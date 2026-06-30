/**
 * NoopMetricsAdapter —— IMetricsPort 的空实现
 *
 * 后续可替换为：Prometheus 推送 / 自研埋点。
 */

import type { IMetricsPort, Counter, Histogram } from '../../../domain/ports/CrossCuttingPorts';

class NoopCounter implements Counter {
  inc(_delta?: number, _tags?: Record<string, string>): void {
    // no-op
  }
}

class NoopHistogram implements Histogram {
  observe(_value: number, _tags?: Record<string, string>): void {
    // no-op
  }
}

export class NoopMetricsAdapter implements IMetricsPort {
  counter(_name: string, _tags?: Record<string, string>): Counter {
    return new NoopCounter();
  }
  histogram(_name: string, _tags?: Record<string, string>): Histogram {
    return new NoopHistogram();
  }
}

export const defaultMetrics: IMetricsPort = new NoopMetricsAdapter();
