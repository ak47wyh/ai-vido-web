/**
 * ReactThemeAdapter —— IThemePort 的 React 实现
 *
 * 通过全局主题事件桥，让 Service 层（非 React 上下文）也能感知/切换主题。
 *
 * 工作原理：
 * 1. Service 调用 reactThemeAdapter.setMode('warm')
 * 2. 适配器通过 themeEventBus.emit(...) 广播事件
 * 3. ThemeProvider 内部的 useThemeBridge() 订阅此事件并同步到 ApiConfigStore
 *
 * 同时支持主动 getCurrentMode() 查询（无需 UI）。
 */

import type { IThemePort, ThemeMode } from '../../../domain/ports/UiPorts';
import { ApiConfigStore } from '../config/ApiConfigStore';

export type ThemeChangeEvent = {
  mode: ThemeMode;
};

type ThemeListener = (event: ThemeChangeEvent) => void;

class ThemeEventBus {
  private listeners = new Set<ThemeListener>();

  subscribe(listener: ThemeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: ThemeChangeEvent): void {
    this.listeners.forEach(l => {
      try { l(event); } catch (e) {
        console.error('[ThemeEventBus] listener error', e);
      }
    });
  }
}

export const themeEventBus = new ThemeEventBus();

class ReactThemeAdapter implements IThemePort {
  getCurrentMode(): ThemeMode {
    const config = ApiConfigStore.load();
    return (config.theme as ThemeMode) || 'dark';
  }

  setMode(mode: ThemeMode): void {
    const config = ApiConfigStore.load();
    ApiConfigStore.save({ ...config, theme: mode });
    themeEventBus.emit({ mode });
  }

  onChange(listener: (mode: ThemeMode) => void): () => void {
    return themeEventBus.subscribe(event => listener(event.mode));
  }
}

export const reactThemeAdapter: IThemePort = new ReactThemeAdapter();