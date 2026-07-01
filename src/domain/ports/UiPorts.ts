/**
 * UiPorts —— UI 状态相关 Port 抽象
 *
 * 把 Theme、i18n、网络状态从 React Context 中抽出，
 * 使 Service 层可感知 UI 状态（用于离线降级、动态文案等场景）。
 */

// ==========================================
// 主题
// ==========================================

export type ThemeMode = 'light' | 'dark' | 'blue' | 'warm';

export interface IThemePort {
  getCurrentMode(): ThemeMode;
  setMode(mode: ThemeMode): void;
  onChange(listener: (mode: ThemeMode) => void): () => void;
}

// ==========================================
// 国际化
// ==========================================

export type LocaleCode = 'zh' | 'en' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'it' | 'pt' | 'ru';

export interface ITranslationPort {
  t(key: string, vars?: Record<string, unknown>): string;
  getLocale(): LocaleCode;
  setLocale(locale: LocaleCode): Promise<void>;
  onChange(listener: (locale: LocaleCode) => void): () => void;
  /** 显式判断是否已 ready（避免 SSR/initial paint 时显示 key） */
  isReady(): boolean;
}

// ==========================================
// 网络状态
// ==========================================

export type NetworkStatus = 'online' | 'offline' | 'unstable';

/**
 * 网络状态端口。
 * Service 层可订阅此 Port，在离线时自动降级或排队请求。
 */
export interface INetworkStatusPort {
  getStatus(): NetworkStatus;
  isOnline(): boolean;
  onChange(listener: (status: NetworkStatus) => void): () => void;
}
