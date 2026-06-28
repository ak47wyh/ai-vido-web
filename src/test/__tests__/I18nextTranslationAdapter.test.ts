/**
 * I18nextTranslationAdapter 单元测试
 *
 * 验证：
 * - t() 返回翻译文本
 * - t(key, vars) 支持插值
 * - 缺失 key 时返回 key 本身（i18next 默认行为）
 * - getLocale / setLocale 正确读写
 * - onChange 在 languageChanged 时触发
 * - listener 抛错被隔离
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import i18n from '../../i18n';
import { i18nextTranslationAdapter, localeEventBus } from '../../adapters/outbound/ui/I18nextTranslationAdapter';

describe('I18nextTranslationAdapter', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('t() returns translation for known key (Chinese resource exists for nav.dashboard)', async () => {
    await i18n.changeLanguage('zh');
    const text = i18nextTranslationAdapter.t('nav.dashboard');
    expect(text).toBeTruthy();
    expect(typeof text).toBe('string');
  });

  it('t() with unknown key returns the key itself', () => {
    const text = i18nextTranslationAdapter.t('this.key.does.not.exist');
    expect(text).toBe('this.key.does.not.exist');
  });

  it('t() supports interpolation vars', async () => {
    // 使用真实资源中可能存在的插值 key（network.totalCacheSize: '{{size}} / {{count}} entries'）
    const text = i18nextTranslationAdapter.t('network.totalCacheSize', { size: '1.2 MB', count: 5 });
    expect(text).toContain('1.2 MB');
    expect(text).toContain('5');
  });

  it('getLocale returns current language', async () => {
    await i18n.changeLanguage('ja');
    expect(i18nextTranslationAdapter.getLocale()).toBe('ja');
  });

  it('setLocale changes language', async () => {
    await i18nextTranslationAdapter.setLocale('fr');
    expect(i18n.language).toBe('fr');
    expect(i18nextTranslationAdapter.getLocale()).toBe('fr');
  });

  it('onChange fires when language changes', async () => {
    const listener = vi.fn();
    const unsub = i18nextTranslationAdapter.onChange(listener);
    await i18nextTranslationAdapter.setLocale('ko');
    // i18next 内部通过 languageChanged 事件触发
    expect(listener).toHaveBeenCalledWith('ko');
    unsub();
  });

  it('onChange unsubscribe stops notifications', async () => {
    const listener = vi.fn();
    const unsub = i18nextTranslationAdapter.onChange(listener);
    await i18nextTranslationAdapter.setLocale('en');
    expect(listener).toHaveBeenCalled();
    const calls = listener.mock.calls.length;
    unsub();
    await i18nextTranslationAdapter.setLocale('zh');
    expect(listener).toHaveBeenCalledTimes(calls);
  });

  it('isolates listener errors so other listeners still fire', async () => {
    const bad = vi.fn(() => { throw new Error('listener boom'); });
    const good = vi.fn();
    i18nextTranslationAdapter.onChange(bad);
    i18nextTranslationAdapter.onChange(good);

    await expect(i18nextTranslationAdapter.setLocale('de')).resolves.not.toThrow();
    expect(bad).toHaveBeenCalled();
    expect(good).toHaveBeenCalled();
  });

  it('exposes localeEventBus for cross-component sync', () => {
    expect(localeEventBus).toBeDefined();
    expect(typeof localeEventBus.subscribe).toBe('function');
    expect(typeof localeEventBus.emit).toBe('function');
  });

  it('isReady reports i18next initialization status', () => {
    expect(i18nextTranslationAdapter.isReady()).toBe(true);
  });
});