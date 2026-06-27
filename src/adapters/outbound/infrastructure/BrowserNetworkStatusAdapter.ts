/**
 * BrowserNetworkStatusAdapter —— INetworkStatusPort 的浏览器实现
 *
 * 监听 navigator.onLine + online/offline 事件。
 * 扩展：检测 navigator.connection 的 effectiveType，提供 unstable 状态。
 */

import type { INetworkStatusPort, NetworkStatus } from '../../../domain/ports/UiPorts';

type NetworkListener = (status: NetworkStatus) => void;

class NetworkEventBus {
  private listeners = new Set<NetworkListener>();

  subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(status: NetworkStatus): void {
    this.listeners.forEach(l => {
      try { l(status); } catch (e) {
        console.error('[NetworkEventBus] listener error', e);
      }
    });
  }
}

export const networkEventBus = new NetworkEventBus();

interface NetworkConnectionInfo {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkConnectionInfo & {
    addEventListener?: (event: string, handler: () => void) => void;
    removeEventListener?: (event: string, handler: () => void) => void;
  };
}

class BrowserNetworkStatusAdapter implements INetworkStatusPort {
  private currentStatus: NetworkStatus = 'online';

  constructor() {
    if (typeof window === 'undefined') return;

    // 初始状态
    this.currentStatus = navigator.onLine ? 'online' : 'offline';

    // 监听 online/offline 事件
    window.addEventListener('online', () => this.updateStatus('online'));
    window.addEventListener('offline', () => this.updateStatus('offline'));

    // 监听 connection 变化（网络质量检测）
    const conn = (navigator as NavigatorWithConnection).connection;
    if (conn?.addEventListener) {
      const onConnChange = () => {
        if (!navigator.onLine) {
          this.updateStatus('offline');
          return;
        }
        // 根据 effectiveType 判断网络质量
        const slow = conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g';
        this.updateStatus(slow ? 'unstable' : 'online');
      };
      conn.addEventListener('change', onConnChange);
    }
  }

  getStatus(): NetworkStatus {
    return this.currentStatus;
  }

  isOnline(): boolean {
    return this.currentStatus === 'online' || this.currentStatus === 'unstable';
  }

  onChange(listener: (status: NetworkStatus) => void): () => void {
    return networkEventBus.subscribe(listener);
  }

  private updateStatus(status: NetworkStatus): void {
    if (this.currentStatus === status) return;
    this.currentStatus = status;
    networkEventBus.emit(status);
  }
}

export const browserNetworkStatusAdapter: INetworkStatusPort = new BrowserNetworkStatusAdapter();