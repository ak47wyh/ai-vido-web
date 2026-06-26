/**
 * ApiConfigStore — 负责读写 API 配置（Token、BaseURL 等）。
 * 数据持久化到 localStorage，纯前端，无需后端。
 */

// ===== 平台标识类型 =====

/** 平台标识 —— 通用 */
export type PlatformId = 'minimax' | 'volcengine' | 'coze';

/** 主题标识 */
export type ThemeId = 'dark' | 'light' | 'blue';

// ===== ApiConfig 接口 =====

export interface ApiConfig {
  // --- MiniMax ---
  minimaxApiKey: string;
  minimaxGroupId: string;
  minimaxBaseUrl: string;
  minimaxAnthropicBaseUrl: string;

  // --- 火山方舟（Ark）---
  volcArkApiKey: string;
  volcArkBaseUrl: string;

  // --- Coze ---
  cozePatToken: string;
  cozeBaseUrl: string;
  cozeSpaceId: string;

  // --- 激活的平台（唯一可用）---
  activePlatform: PlatformId;

  // --- 主题设置 ---
  theme: ThemeId;
}

const STORAGE_KEY = 'ai_video_studio_api_config';

// ===== 默认值 =====

const DEFAULT_CONFIG: ApiConfig = {
  // MiniMax 默认值
  minimaxApiKey: '',
  minimaxGroupId: '',
  minimaxBaseUrl: 'https://api.minimaxi.com/v1',
  minimaxAnthropicBaseUrl: import.meta.env.DEV ? '/anthropic' : 'https://api.minimaxi.com/anthropic',

  // 火山方舟默认值
  volcArkApiKey: '',
  volcArkBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',

  // Coze 默认值
  cozePatToken: '',
  cozeBaseUrl: 'https://api.coze.cn',
  cozeSpaceId: '',

  // 默认激活 MiniMax
  activePlatform: 'minimax',

  // 主题默认值
  theme: 'dark' as ThemeId,
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

  /** 自动保存（防抖调用） */
  autoSave(config: ApiConfig): void {
    this.save(config);
  },

  get<K extends keyof ApiConfig>(key: K): ApiConfig[K] {
    return this.load()[key];
  },

  /** 判断指定平台是否已配置（有有效 Token） */
  isPlatformConfigured(platform: PlatformId): boolean {
    const config = this.load();
    switch (platform) {
      case 'minimax': return !!config.minimaxApiKey.trim();
      case 'volcengine': return !!config.volcArkApiKey.trim();
      case 'coze': return !!config.cozePatToken.trim();
      default: return false;
    }
  },

  /** 获取当前激活的平台 */
  getActivePlatform(): PlatformId {
    return this.load().activePlatform;
  },
};