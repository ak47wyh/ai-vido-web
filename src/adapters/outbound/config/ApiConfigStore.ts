/**
 * ApiConfigStore — 负责读写 API 配置（Token、BaseURL 等）。
 * 数据持久化到 localStorage，纯前端，无需后端。
 */

export interface ApiConfig {
  minimaxApiKey: string;
  minimaxGroupId: string;
  minimaxBaseUrl: string;
}

const STORAGE_KEY = 'ai_video_studio_api_config';

const DEFAULT_CONFIG: ApiConfig = {
  minimaxApiKey: '',
  minimaxGroupId: '',
  minimaxBaseUrl: 'https://api.minimax.chat/v1'
};

export const ApiConfigStore = {
  load(): ApiConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_CONFIG };
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  },

  save(config: ApiConfig): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  },

  get<K extends keyof ApiConfig>(key: K): ApiConfig[K] {
    return this.load()[key];
  }
};
