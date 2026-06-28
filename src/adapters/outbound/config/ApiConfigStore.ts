/**
 * ApiConfigStore — 负责读写 API 配置（Token、BaseURL 等）。
 * 数据持久化到 localStorage，纯前端，无需后端。
 */

// ===== 平台标识类型 =====

/** 平台标识 —— 通用 */
export type PlatformId = 'minimax' | 'volcengine' | 'coze' | 'kling' | 'wan' | 'hunyuan' | 'zhipu' | 'vidu';

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

  // --- 可灵 Kling（快手） ---
  klingAccessKey: string;
  klingSecretKey: string;
  klingBaseUrl: string;

  // --- 通义万相 Wan（阿里 DashScope） ---
  wanApiKey: string;
  wanBaseUrl: string;

  // --- 腾讯混元 Hunyuan ---
  hunyuanSecretId: string;
  hunyuanSecretKey: string;
  hunyuanBaseUrl: string;

  // --- 智谱 CogVideoX / GLM ---
  zhipuApiKey: string;
  zhipuBaseUrl: string;

  // --- Vidu（生数科技） ---
  viduApiKey: string;
  viduBaseUrl: string;

  // --- 激活的平台（唯一可用）---
  activePlatform: PlatformId;

  // --- 主题设置 ---
  theme: ThemeId;
}

const STORAGE_KEY = 'ai_video_studio_api_config';

// ===== 默认值 =====

// 所有平台默认直连完整外部 URL,DEV 与 PROD 行为一致。
// 若某平台不支持 CORS,用户可在配置中心手动填入自建反代地址。
const DEFAULT_CONFIG: ApiConfig = {
  // MiniMax 默认值
  minimaxApiKey: '',
  minimaxGroupId: '',
  minimaxBaseUrl: 'https://api.minimaxi.com/v1',
  minimaxAnthropicBaseUrl: 'https://api.minimaxi.com/anthropic',

  // 火山方舟默认值
  volcArkApiKey: '',
  volcArkBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',

  // Coze 默认值
  cozePatToken: '',
  cozeBaseUrl: 'https://api.coze.cn',
  cozeSpaceId: '',

  // 可灵 Kling 默认值
  klingAccessKey: '',
  klingSecretKey: '',
  klingBaseUrl: 'https://api.klingai.com',

  // 通义万相 Wan 默认值
  wanApiKey: '',
  wanBaseUrl: 'https://dashscope.aliyuncs.com/api/v1',

  // 腾讯混元 Hunyuan 默认值
  hunyuanSecretId: '',
  hunyuanSecretKey: '',
  hunyuanBaseUrl: 'https://hunyuan.tencentcloudapi.com',

  // 智谱 Zhipu 默认值
  zhipuApiKey: '',
  zhipuBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',

  // Vidu 默认值
  viduApiKey: '',
  viduBaseUrl: 'https://api.vidu.cn',

  // 默认激活 MiniMax
  activePlatform: 'minimax',

  // 主题默认值
  theme: 'dark' as ThemeId,
};

// 旧版 DEV 代理路径 → 完整外部 URL 的迁移映射。
// 直连架构下不再使用代理路径,需把 localStorage 中残留的旧值替换为默认完整 URL。
const PROXY_PATH_MIGRATIONS: Record<string, Partial<ApiConfig>> = {
  '/anthropic': { minimaxAnthropicBaseUrl: DEFAULT_CONFIG.minimaxAnthropicBaseUrl },
  '/kling': { klingBaseUrl: DEFAULT_CONFIG.klingBaseUrl },
  '/wan': { wanBaseUrl: DEFAULT_CONFIG.wanBaseUrl },
  '/hunyuan': { hunyuanBaseUrl: DEFAULT_CONFIG.hunyuanBaseUrl },
  '/zhipu': { zhipuBaseUrl: DEFAULT_CONFIG.zhipuBaseUrl },
  '/vidu': { viduBaseUrl: DEFAULT_CONFIG.viduBaseUrl },
  '/volcengine-ark': { volcArkBaseUrl: DEFAULT_CONFIG.volcArkBaseUrl },
  '/coze': { cozeBaseUrl: DEFAULT_CONFIG.cozeBaseUrl },
};

export const ApiConfigStore = {
  load(): ApiConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_CONFIG };
      const config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      // 迁移:把旧版 DEV 代理路径(如 /anthropic、/kling)替换为完整外部 URL
      (Object.keys(PROXY_PATH_MIGRATIONS) as Array<keyof typeof PROXY_PATH_MIGRATIONS>)
        .forEach(proxyPath => {
          const migration = PROXY_PATH_MIGRATIONS[proxyPath];
          (Object.keys(migration) as Array<keyof ApiConfig>).forEach(field => {
            if (config[field] === proxyPath) {
              config[field] = migration[field]!;
            }
          });
        });
      return config;
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  },

  save(config: ApiConfig): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      // 脱敏日志：仅输出激活平台与各平台配置状态，不输出 Key 内容
      const summary = {
        activePlatform: config.activePlatform,
        minimax: !!config.minimaxApiKey.trim(),
        volcengine: !!config.volcArkApiKey.trim(),
        coze: !!config.cozePatToken.trim(),
        kling: !!config.klingAccessKey.trim() && !!config.klingSecretKey.trim(),
        wan: !!config.wanApiKey.trim(),
        hunyuan: !!config.hunyuanSecretId.trim() && !!config.hunyuanSecretKey.trim(),
        zhipu: !!config.zhipuApiKey.trim(),
        vidu: !!config.viduApiKey.trim(),
      };
      console.log('[ApiConfigStore] 配置已保存:', summary);
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
      case 'kling': return !!config.klingAccessKey.trim() && !!config.klingSecretKey.trim();
      case 'wan': return !!config.wanApiKey.trim();
      case 'hunyuan': return !!config.hunyuanSecretId.trim() && !!config.hunyuanSecretKey.trim();
      case 'zhipu': return !!config.zhipuApiKey.trim();
      case 'vidu': return !!config.viduApiKey.trim();
      default: return false;
    }
  },

  /** 获取当前激活的平台 */
  getActivePlatform(): PlatformId {
    return this.load().activePlatform;
  },
};