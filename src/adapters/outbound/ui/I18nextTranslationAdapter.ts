/**
 * I18nextTranslationAdapter —— ITranslationPort 的 i18next 实现
 *
 * 把现有 i18next 单例包装为 Port 契约，使 Service 层可调用 t() 函数而不依赖 react-i18next。
 *
 * 关键约束：实现方保证 t(key) 在 key 缺失时返回 key 本身（与 i18next 默认行为一致）。
 */

import i18n from '../../../i18n';
import type { ITranslationPort, LocaleCode } from '../../../domain/ports/UiPorts';

type LocaleListener = (locale: LocaleCode) => void;

class LocaleEventBus {
  private listeners = new Set<LocaleListener>();

  subscribe(listener: LocaleListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(locale: LocaleCode): void {
    this.listeners.forEach(l => {
      try { l(locale); } catch (e) {
        console.error('[LocaleEventBus] listener error', e);
      }
    });
  }
}

export const localeEventBus = new LocaleEventBus();

class I18nextTranslationAdapter implements ITranslationPort {
  constructor() {
    // i18next 内部变化时转发到事件总线
    i18n.on('languageChanged', (lng: string) => {
      localeEventBus.emit(lng as LocaleCode);
    });
  }

  t(key: string, vars?: Record<string, unknown>): string {
    return i18n.t(key, vars as Record<string, string | number | boolean>);
  }

  getLocale(): LocaleCode {
    return (i18n.language || 'en') as LocaleCode;
  }

  async setLocale(locale: LocaleCode): Promise<void> {
    await i18n.changeLanguage(locale);
  }

  onChange(listener: (locale: LocaleCode) => void): () => void {
    return localeEventBus.subscribe(listener);
  }

  isReady(): boolean {
    return i18n.isInitialized;
  }
}

export const i18nextTranslationAdapter: ITranslationPort = new I18nextTranslationAdapter();