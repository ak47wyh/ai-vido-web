/**
 * ApiConfigStoreAdapter 单元测试
 *
 * 验证：
 * - getApiKeyMasked 不返回明文
 * - onPlatformChange 订阅机制
 * - setActivePlatform 触发事件
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ApiConfigStoreAdapter } from '../../adapters/outbound/config/ApiConfigStoreAdapter';
import { ApiConfigStore } from '../../adapters/outbound/config/ApiConfigStore';

describe('ApiConfigStoreAdapter', () => {
  let adapter: ApiConfigStoreAdapter;

  beforeEach(() => {
    // 清空测试数据
    localStorage.clear();
    ApiConfigStore.clearForTests?.();
    adapter = new ApiConfigStoreAdapter();
  });

  it('masks long API keys (first 4 + 6 stars + last 4)', () => {
    // 直接构造一个长 Key 写入
    const longKey = 'sk-test-' + 'a'.repeat(20);
    ApiConfigStore.save({ ...ApiConfigStore.load(), minimaxApiKey: longKey });

    const masked = adapter.getApiKeyMasked('minimax');
    expect(masked).toMatch(/^sk-t\*+a{4}$/);
    // 不应包含明文
    expect(masked).not.toContain(longKey);
  });

  it('returns 12 stars for short keys', () => {
    ApiConfigStore.save({ ...ApiConfigStore.load(), minimaxApiKey: 'short' });
    const masked = adapter.getApiKeyMasked('minimax');
    expect(masked).toBe('*'.repeat(12));
  });

  it('returns empty string when API key is empty', () => {
    ApiConfigStore.save({ ...ApiConfigStore.load(), minimaxApiKey: '' });
    const masked = adapter.getApiKeyMasked('minimax');
    expect(masked).toBe('');
  });

  it('returns token via getToken (caller responsible for not logging)', () => {
    ApiConfigStore.save({ ...ApiConfigStore.load(), minimaxApiKey: 'sk-test-token' });
    const token = adapter.getToken('minimax');
    expect(token).toBe('sk-test-token');
  });

  it('emits onPlatformChange when active platform changes', async () => {
    const events: Array<{ from: string; to: string }> = [];
    const unsubscribe = adapter.onPlatformChange((next, prev) => {
      events.push({ from: prev, to: next });
    });

    // 初始为 minimax，切换到 kling
    await adapter.setActivePlatform('kling');
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ from: 'minimax', to: 'kling' });

    // 再次切换
    await adapter.setActivePlatform('volcengine');
    expect(events).toHaveLength(2);
    expect(events[1].to).toBe('volcengine');

    unsubscribe();
  });

  it('does not emit event when setActivePlatform called with same value', async () => {
    const events: string[] = [];
    adapter.onPlatformChange((next) => events.push(next));
    await adapter.setActivePlatform(adapter.getActivePlatform());
    expect(events).toHaveLength(0);
  });

  it('unsubscribe stops receiving events', async () => {
    const events: string[] = [];
    const unsub = adapter.onPlatformChange((next) => events.push(next));

    await adapter.setActivePlatform('kling');
    expect(events).toHaveLength(1);

    unsub();
    await adapter.setActivePlatform('volcengine');
    expect(events).toHaveLength(1); // 不再增加
  });

  it('emits onConfigChange when API key is updated', async () => {
    const calls: number[] = [];
    adapter.onConfigChange(() => calls.push(Date.now()));

    const config = adapter.load();
    await adapter.save({ ...config, minimaxApiKey: 'new-key' });
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });

  it('isPlatformConfigured returns true only when key/token present', () => {
    ApiConfigStore.save({ ...ApiConfigStore.load(), minimaxApiKey: 'valid-key' });
    expect(adapter.isPlatformConfigured('minimax')).toBe(true);

    ApiConfigStore.save({ ...ApiConfigStore.load(), minimaxApiKey: '' });
    expect(adapter.isPlatformConfigured('minimax')).toBe(false);
  });
});