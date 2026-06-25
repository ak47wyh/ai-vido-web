/**
 * ApiConfigStore — 负责读写 API 配置（Token、BaseURL 等）。
 * 数据持久化到 localStorage，纯前端，无需后端。
 */

export interface ApiConfig {
  minimaxApiKey: string;
  minimaxGroupId: string;
  minimaxBaseUrl: string;
  minimaxAnthropicBaseUrl: string;
}

const STORAGE_KEY = 'ai_video_studio_api_config';

const DEFAULT_CONFIG: ApiConfig = {
  minimaxApiKey: '',
  minimaxGroupId: '',
  minimaxBaseUrl: 'https://api.minimaxi.com/v1',
  // 开发环境使用 Vite 代理（/anthropic → https://api.minimaxi.com/anthropic），避免 CORS
  minimaxAnthropicBaseUrl: import.meta.env.DEV ? '/anthropic' : 'https://api.minimaxi.com/anthropic',
};

export const ApiConfigStore = {
  load(): ApiConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_CONFIG };
      const config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      // 开发环境强制使用 Vite 代理，避免 CORS
      if (import.meta.env.DEV) {
        config.minimaxAnthropicBaseUrl = '/anthropic';
      }
      return config;
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  },

  save(config: ApiConfig): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      console.log('[ApiConfigStore] 配置已保存:', JSON.stringify(config, null, 2));
    } catch (e) {
      console.error('[ApiConfigStore] 保存配置失败:', e);
      throw e;
    }
  },

  get<K extends keyof ApiConfig>(key: K): ApiConfig[K] {
    return this.load()[key];
  }
};
