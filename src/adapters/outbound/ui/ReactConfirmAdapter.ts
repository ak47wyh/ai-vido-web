/**
 * ReactConfirmAdapter —— IConfirmPort 的 React 实现
 *
 * 通过全局 Promise 桥接 ConfirmContext。
 * 业务 Service 调用 reactConfirmAdapter.ask({...}) 返回 Promise<boolean>。
 * ConfirmProvider 内部的 useConfirmBridge() 订阅此事件，弹出确认框，用户点击后 resolve。
 *
 * 与 ReactNotificationAdapter 的实现模式相同：模块级单例 + 事件桥。
 */

import type { IConfirmPort, ConfirmInput } from '../../../domain/ports/CrossCuttingPorts';

export interface ConfirmBridgeRequest {
  id: string;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  resolve: (value: boolean) => void;
}

type ConfirmListener = (req: ConfirmBridgeRequest) => void;

class ConfirmEventBus {
  private listeners = new Set<ConfirmListener>();

  subscribe(listener: ConfirmListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(req: ConfirmBridgeRequest): void {
    this.listeners.forEach(l => {
      try { l(req); } catch (e) {
        console.error('[ConfirmEventBus] listener error', e);
      }
    });
  }
}

export const confirmEventBus = new ConfirmEventBus();

class ReactConfirmAdapter implements IConfirmPort {
  ask(input: ConfirmInput): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      confirmEventBus.emit({
        id,
        title: input.title,
        message: input.message,
        confirmText: input.confirmText,
        cancelText: input.cancelText,
        destructive: input.destructive,
        resolve,
      });
    });
  }
}

export const reactConfirmAdapter: IConfirmPort = new ReactConfirmAdapter();
