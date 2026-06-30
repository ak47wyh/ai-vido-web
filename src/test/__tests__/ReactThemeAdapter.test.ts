/**
 * ReactThemeAdapter 单元测试
 *
 * 验证：
 * - getCurrentMode 读取 ApiConfigStore 中的 theme 字段
 * - setMode 写入 ApiConfigStore 并广播事件
 * - onChange 订阅事件，unsubscribe 后停止接收
 * - listener 抛错被隔离
 * - 缺失 theme 时回退到 'dark'
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reactThemeAdapter, themeEventBus } from '../../adapters/outbound/ui/ReactThemeAdapter';
import { ApiConfigStore } from '../../adapters/outbound/config/ApiConfigStore';

describe('ReactThemeAdapter', () => {
  beforeEach(() => {
    // 重置 localStorage，避免其他测试污染
    localStorage.clear();
    ApiConfigStore.save(ApiConfigStore.load()); // 触发默认值初始化
  });

  it('returns default mode (dark) when theme is missing', () => {
    // Without saving any theme, getCurrentMode should return 'dark'
    expect(reactThemeAdapter.getCurrentMode()).toBe('dark');
  });

  it('getCurrentMode returns persisted theme', () => {
    const config = ApiConfigStore.load();
    ApiConfigStore.save({ ...config, theme: 'blue' });
    expect(reactThemeAdapter.getCurrentMode()).toBe('blue');
  });

  it('setMode persists and emits change event', () => {
    const listener = vi.fn();
    const unsub = reactThemeAdapter.onChange(listener);

    reactThemeAdapter.setMode('light');

    expect(reactThemeAdapter.getCurrentMode()).toBe('light');
    expect(listener).toHaveBeenCalledWith('light');

    unsub();
  });

  it('onChange unsubscribe stops notifications', () => {
    const listener = vi.fn();
    const unsub = reactThemeAdapter.onChange(listener);
    reactThemeAdapter.setMode('blue');
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
    reactThemeAdapter.setMode('dark');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('isolates listener errors so other listeners still fire', () => {
    const bad = vi.fn(() => { throw new Error('listener boom'); });
    const good = vi.fn();
    reactThemeAdapter.onChange(bad);
    reactThemeAdapter.onChange(good);

    expect(() => reactThemeAdapter.setMode('light')).not.toThrow();
    expect(bad).toHaveBeenCalled();
    expect(good).toHaveBeenCalledWith('light');
  });

  it('exposes themeEventBus for cross-component sync', () => {
    expect(themeEventBus).toBeDefined();
    expect(typeof themeEventBus.subscribe).toBe('function');
    expect(typeof themeEventBus.emit).toBe('function');
  });
});