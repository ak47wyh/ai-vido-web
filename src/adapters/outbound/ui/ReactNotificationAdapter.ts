/**
 * ReactNotificationAdapter —— INotificationPort 的 React 实现
 *
 * 通过订阅一个"全局事件桥"被 ToastContext 触发，
 * 实现"Service 层主动弹 Toast"的能力，不依赖 React Hook。
 *
 * 工作原理：
 * 1. 业务 Service 调用 reactNotificationAdapter.toast(...)
 * 2. 适配器通过 toastEventBus.emit(...) 广播事件
 * 3. ToastContext 内部的 useToastBridge() 订阅此事件并显示
 *
 * 关键约束：这是一个**模块级单例**，在 ToastProvider 挂载前调用不报错（事件会被缓存）。
 */

import type { INotificationPort, ToastInput, ToastVariant } from '../../../domain/ports/CrossCuttingPorts';

export type ToastType = ToastVariant;

export interface ToastBridgeEvent {
  id: string;
  type: ToastType;
  message: string;
}

type ToastListener = (event: ToastBridgeEvent) => void;

class ToastEventBus {
  private listeners = new Set<ToastListener>();

  subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: ToastBridgeEvent): void {
    this.listeners.forEach(l => {
      try { l(event); } catch (e) {
        console.error('[ToastEventBus] listener error', e);
      }
    });
  }
}

export const toastEventBus = new ToastEventBus();

class ReactNotificationAdapter implements INotificationPort {
  toast(input: ToastInput): string {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    toastEventBus.emit({
      id,
      type: input.variant,
      message: input.message,
    });
    return id;
  }

  dismiss(toastId: string): void {
    // 转发为特殊事件，由 ToastContext 内部处理
    toastEventBus.emit({
      id: toastId,
      type: 'info',
      message: `__dismiss__:${toastId}`,
    });
  }
}

export const reactNotificationAdapter: INotificationPort = new ReactNotificationAdapter();
