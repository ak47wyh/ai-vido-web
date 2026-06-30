# 技术设计文档：火山引擎多平台接口集成

## 文档信息

| 项目 | 内容 |
|------|------|
| 关联 PRD | PRD-火山引擎多平台接口集成.md v1.0 |
| 文档版本 | v1.0 |
| 创建日期 | 2026-06-26 |
| 架构风格 | 六边形架构（Hexagonal / Ports & Adapters） |
| 技术栈 | React 19 + TypeScript 6 + Vite 8 + Axios + Dexie (IndexedDB) |

---

## 一、现有架构基线

### 1.1 分层结构

```
src/
├── domain/
│   ├── entities/models.ts          ← 纯数据接口（interface），无 class 实例
│   ├── ports/
│   │   ├── OutboundPorts.ts        ← 7 个 Repository Port + 8 个 API Port
│   │   ├── PostProcessPorts.ts     ← IFFmpegPort, IWhisperPort
│   │   └── AssetLibraryPorts.ts    ← ISavedImageRepository 等 3 个
│   └── services/                   ← 21 个 Domain Service，构造器注入 Port 接口
├── adapters/outbound/
│   ├── api/                        ← MiniMax* 适配器实现
│   │   ├── MiniMaxVideoAdapter.ts
│   │   ├── MiniMaxImageAdapter.ts
│   │   ├── MiniMaxTextAdapter.ts
│   │   ├── MiniMaxVoiceAdapter.ts
│   │   ├── MiniMaxMusicAdapter.ts
│   │   ├── MiniMaxModelAdapter.ts
│   │   ├── MiniMaxFileAdapter.ts
│   │   ├── MiniMaxErrorUtils.ts
│   │   └── ...（Mock / Smart 包装适配器）
│   ├── config/ApiConfigStore.ts    ← localStorage 单例
│   └── repositories/              ← Dexie (IndexedDB) 实现
├── dependencies.ts                 ← 手动 DI 组合根（Composition Root）
└── ui/                             ← React 页面 + 组件
```

### 1.2 现有适配器实现模式（以 MiniMaxVideoAdapter 为范本）

```typescript
// 1. 类声明：implements 对应 Port 接口
export class MiniMaxVideoAdapter implements IVideoGeneratorPort {

  // 2. 每个方法开头从 ApiConfigStore 加载配置
  async submitVideoTask(segmentId: string, context: VideoPromptContext): Promise<VideoTaskResult> {
    const config = ApiConfigStore.load();

    // 3. Mock 模式检查：无 API Key 时返回假数据
    if (!config.minimaxApiKey) {
      return { externalTaskId: 'mock-task-' + Date.now(), mode: context.mode };
    }

    // 4. 构建请求体
    const payload = this.buildPayload(context, config);

    // 5. axios 调用 + Bearer 认证
    const { data } = await axios.post(
      `${config.minimaxBaseUrl}/video_generation`,
      payload,
      { headers: { Authorization: `Bearer ${config.minimaxApiKey}`, 'Content-Type': 'application/json' } }
    );

    // 6. 错误检查（MiniMax 特有错误格式）
    const errorMsg = getMiniMaxErrorMessage(data);
    if (errorMsg) throw new Error(errorMsg);

    // 7. 返回类型化结果
    return { externalTaskId: data.task_id, mode: context.mode };
  }
}
```

### 1.3 现有 Port 接口命名规范

| 类别 | 命名模式 | 现有实例 |
|------|---------|---------|
| Repository | `I{Entity}Repository` | `IStoryRepository`, `ICharacterRepository` |
| API | `I{Capability}Port` | `IVideoGeneratorPort`, `IImageGeneratorPort`, `ITextGenerationPort` |
| 基础设施 | `I{Infra}Port` | `IFFmpegPort`, `IWhisperPort` |

### 1.4 现有 DI 模式（dependencies.ts）

```typescript
// 手动实例化，无 DI 框架
const config = ApiConfigStore.load();
const videoAdapter = new MiniMaxVideoAdapter();
const imageAdapter = new MiniMaxImageAdapter();
const textAdapter = new MiniMaxTextAdapter();
// ...
export const videoGenerationService = new VideoGenerationService(
  videoTaskRepo, segmentRepo, characterRepo, backgroundRepo, videoAdapter
);
```

### 1.5 现有 ApiConfig 接口

```typescript
export interface ApiConfig {
  minimaxApiKey: string;
  minimaxGroupId: string;
  minimaxBaseUrl: string;           // 默认: 'https://api.minimaxi.com/v1'
  minimaxAnthropicBaseUrl: string;  // 默认: '/anthropic' (dev) | 'https://api.minimaxi.com/anthropic'
}
```

---

## 二、变更总览

### 2.1 变更范围矩阵

| 变更类型 | 文件 | 影响面 |
|---------|------|--------|
| **新增** | `src/domain/ports/VolcenginePorts.ts` | 5 个新 Port 接口 |
| **新增** | `src/domain/services/PlatformRouter.ts` | 适配器注册 + 路由 |
| **新增** | `src/adapters/outbound/api/volcengine/*.ts` | 6 个适配器 + 1 个错误工具 |
| **新增** | `src/adapters/outbound/api/coze/*.ts` | 2 个适配器 |
| **修改** | `src/domain/ports/OutboundPorts.ts` | 无需修改（新增 Port 放独立文件） |
| **修改** | `src/adapters/outbound/config/ApiConfigStore.ts` | 扩展 ApiConfig 接口 |
| **修改** | `src/dependencies.ts` | 注册新适配器 + PlatformRouter |
| **修改** | `src/domain/entities/models.ts` | 新增数据接口 |
| **修改** | `src/ui/pages/Settings.tsx` | 新增配置区域 |
| **修改** | `src/domain/services/VideoGenerationService.ts` | 通过 PlatformRouter 获取适配器 |
| **修改** | `src/domain/services/ImageGenerationService.ts` | 同上 |
| **修改** | `src/domain/services/TextGenerationService.ts` | 同上 |
| **新增** | `vite.config.ts` | 新增火山引擎 / Coze 代理规则 |

### 2.2 目录结构变更

```
src/
├── domain/
│   ├── entities/models.ts                     ← [修改] 新增数据接口
│   ├── ports/
│   │   ├── OutboundPorts.ts                   ← [不变]
│   │   ├── VolcenginePorts.ts                 ← [新增] 5 个新 Port
│   │   └── ...
│   └── services/
│       ├── PlatformRouter.ts                  ← [新增] 路由注册表
│       ├── VideoGenerationService.ts          ← [修改] 接入 PlatformRouter
│       └── ...
├── adapters/outbound/
│   ├── api/
│   │   ├── minimax/                           ← [重构] 从 api/ 移入子目录（可选）
│   │   ├── volcengine/                        ← [新增] 火山引擎适配器目录
│   │   │   ├── VolcengineHttpClient.ts        ← 共享 HTTP 客户端
│   │   │   ├── VolcengineVideoAdapter.ts
│   │   │   ├── VolcengineImageAdapter.ts
│   │   │   ├── Volcengine3DAdapter.ts
│   │   │   ├── VolcengineTextAdapter.ts
│   │   │   ├── VolcengineCacheAdapter.ts
│   │   │   ├── VolcengineResponseAdapter.ts
│   │   │   └── VolcengineErrorUtils.ts
│   │   └── coze/                              ← [新增] Coze 适配器目录
│   │       ├── CozeHttpClient.ts              ← 共享 HTTP 客户端
│   │       ├── CozeBotAdapter.ts
│   │       └── CozeDialogAdapter.ts
│   └── config/ApiConfigStore.ts               ← [修改] 扩展接口
├── dependencies.ts                            ← [修改] 注册新组件
└── ui/pages/Settings.tsx                      ← [修改] 新增 UI
```

---

## 三、详细设计

### 3.1 配置存储层

#### 3.1.1 ApiConfig 接口扩展

文件：`src/adapters/outbound/config/ApiConfigStore.ts`

```typescript
// ===== 新增类型定义 =====

/** 平台标识 —— 通用 */
export type PlatformId = 'minimax' | 'volcengine' | 'coze';

/** 平台标识 —— 3D 子提供商 */
export type Platform3DId = 'volcengine-seed3d' | 'volcengine-yingmou' | 'volcengine-shumei';

/** 所有平台标识联合 */
export type AnyPlatformId = PlatformId | Platform3DId;

// ===== ApiConfig 扩展 =====

export interface ApiConfig {
  // --- 现有 MiniMax（保持不变）---
  minimaxApiKey: string;
  minimaxGroupId: string;
  minimaxBaseUrl: string;
  minimaxAnthropicBaseUrl: string;

  // --- 新增：火山方舟（Ark）---
  volcArkApiKey: string;
  volcArkBaseUrl: string;

  // --- 新增：Coze ---
  cozePatToken: string;
  cozeBaseUrl: string;
  cozeSpaceId: string;

  // --- 新增：平台路由 ---
  platformVideo: 'minimax' | 'volcengine';
  platformImage: 'minimax' | 'volcengine';
  platform3d: Platform3DId;
  platformText: 'minimax' | 'volcengine';
  platformDialog: 'coze';
  platformBot: 'coze';
  platformCache: 'volcengine';
  platformResponse: 'volcengine';
}

// ===== 默认值 =====

const DEFAULT_CONFIG: ApiConfig = {
  // MiniMax 默认值（保持现有）
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

  // 平台路由默认值
  platformVideo: 'minimax',
  platformImage: 'minimax',
  platform3d: 'volcengine-seed3d',
  platformText: 'minimax',
  platformDialog: 'coze',
  platformBot: 'coze',
  platformCache: 'volcengine',
  platformResponse: 'volcengine',
};
```

#### 3.1.2 ApiConfigStore 实现变更

`ApiConfigStore` 的 `load()` 方法需兼容旧版 localStorage 数据（缺少新字段时填充默认值）：

```typescript
export const ApiConfigStore = {
  STORAGE_KEY: 'ai_video_studio_api_config',

  load(): ApiConfig {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return { ...DEFAULT_CONFIG };
      const parsed = JSON.parse(raw);
      // 合并默认值，确保新增字段存在
      return { ...DEFAULT_CONFIG, ...parsed };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  },

  save(config: ApiConfig): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
  },

  get<K extends keyof ApiConfig>(key: K): ApiConfig[K] {
    return this.load()[key];
  },

  /** 判断指定平台 Token 是否已配置 */
  isPlatformActive(platform: PlatformId): boolean {
    const config = this.load();
    switch (platform) {
      case 'minimax': return !!config.minimaxApiKey;
      case 'volcengine': return !!config.volcArkApiKey;
      case 'coze': return !!config.cozePatToken;
      default: return false;
    }
  },
};
```

---

### 3.2 Port 接口定义

文件：`src/domain/ports/VolcenginePorts.ts`

> 设计决策：新增 Port 放入独立文件 `VolcenginePorts.ts`，不修改现有 `OutboundPorts.ts`，避免引入不必要的耦合。这些 Port 接口是平台无关的功能抽象，未来其他平台也可实现。

```typescript
import type {
  ThreeDSubmitParams, ThreeDTaskResult, ThreeDTaskStatus, ThreeDTaskListResult,
  CacheCreateParams, CacheResult, CacheChatParams,
  BotCreateParams, BotResult, PublishResult, BotListFilter, BotListResult, BotDetailResult,
  DialogChatParams, DialogChatResult, DialogStreamChunk, ConversationResult, MessageListResult,
  ResponseCreateParams, ResponseResult, ResponseStreamChunk, ResponseContextResult,
  TaskListFilter,
} from '../entities/models';

// ==========================================
// 3D 生成端口
// ==========================================

/**
 * 3D 模型生成端口。
 * 异步任务模式：submitTask → 轮询 queryTask → 获取结果。
 * 实现者：Volcengine3DAdapter（含 Seed3D / 影眸 / 数美三个子提供商）。
 */
export interface IThreeDGenerationPort {
  /** 提交 3D 生成任务，返回任务 ID */
  submitTask(params: ThreeDSubmitParams): Promise<ThreeDTaskResult>;

  /** 查询单个任务状态 */
  queryTask(taskId: string): Promise<ThreeDTaskStatus>;

  /** 查询任务列表（可选，部分平台可能不支持） */
  queryTaskList?(filters?: TaskListFilter): Promise<ThreeDTaskListResult>;

  /** 取消或删除任务（可选） */
  cancelTask?(taskId: string): Promise<void>;
}

// ==========================================
// 上下文缓存端口
// ==========================================

/**
 * 上下文缓存端口。
 * 火山引擎独有能力：缓存重复前缀内容以降低 Token 成本。
 */
export interface IContextCachePort {
  /** 创建上下文缓存，返回缓存 ID */
  createCache(params: CacheCreateParams): Promise<CacheResult>;

  /** 使用缓存进行对话（同步） */
  chatWithCache(params: CacheChatParams): Promise<ChatCompletionResult>;

  /** 使用缓存进行对话（流式） */
  chatWithCacheStream(params: CacheChatParams): AsyncIterable<ChatStreamChunk>;
}

// ==========================================
// Bot 应用端口
// ==========================================

/**
 * Bot 应用管理端口。
 * 封装 Coze 平台的 Bot CRUD 操作。
 */
export interface IBotPort {
  createBot(params: BotCreateParams): Promise<BotResult>;
  publishBot(botId: string): Promise<PublishResult>;
  listBots(filters?: BotListFilter): Promise<BotListResult>;
  getBotDetail(botId: string): Promise<BotDetailResult>;
}

// ==========================================
// 对话端口（Bot 对话）
// ==========================================

/**
 * Bot 对话端口。
 * 支持流式和非流式两种模式。
 */
export interface IDialogPort {
  /** 创建对话会话 */
  createConversation(botId: string): Promise<ConversationResult>;

  /** 发送消息并获取回复（非流式） */
  chat(params: DialogChatParams): Promise<DialogChatResult>;

  /** 发送消息并流式接收回复 */
  chatStream(params: DialogChatParams): AsyncIterable<DialogStreamChunk>;

  /** 获取会话消息列表 */
  listMessages(conversationId: string, chatId: string): Promise<MessageListResult>;
}

// ==========================================
// 模型响应端口
// ==========================================

/**
 * 模型响应端口（Responses API）。
 * OpenAI 兼容的 Responses API，支持多轮上下文、缓存、深度推理。
 */
export interface IModelResponsePort {
  /** 创建模型响应（同步） */
  createResponse(params: ResponseCreateParams): Promise<ResponseResult>;

  /** 创建模型响应（流式） */
  createResponseStream(params: ResponseCreateParams): AsyncIterable<ResponseStreamChunk>;

  /** 查询已创建的响应 */
  getResponse(responseId: string): Promise<ResponseResult>;

  /** 获取响应上下文 */
  getResponseContext(responseId: string): Promise<ResponseContextResult>;

  /** 删除响应并清除缓存 */
  deleteResponse(responseId: string): Promise<void>;
}

// ==========================================
// 缓存对话复用类型
// ==========================================

/**
 * 缓存对话结果类型。
 * 注意：OutboundPorts 中已有 TextGenerationResult（用于 ITextGenerationPort），
 * 此处为 IContextCachePort 专用，字段命名与 TextGenerationResult.usage 保持一致
 * （promptTokens / completionTokens），避免引入额外转换层。
 */
export interface ChatCompletionResult {
  content: string;
  usage?: TokenUsage;
  finishReason?: string;
}

export interface ChatStreamChunk {
  delta: string;
  finishReason?: string;
  usage?: TokenUsage;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens?: number;
}
```

---

### 3.3 数据模型扩展

文件：`src/domain/entities/models.ts`（追加）

```typescript
// ==========================================
// 3D 生成相关
// ==========================================

export type ThreeDPlatformId = 'volcengine-seed3d' | 'volcengine-yingmou' | 'volcengine-shumei';
export type ThreeDTaskStatusType = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type ThreeDOutputFormat = 'glb' | 'gltf' | 'fbx' | 'obj';

export interface ThreeDSubmitParams {
  /** 文本提示（影眸支持英文文本→3D） */
  prompt?: string;
  /** 输入图片 URL 列表（单图或多图） */
  imageUrls?: string[];
  /** 模型端点 ID（由 PlatformRouter 根据 platform3d 配置注入） */
  modelEndpointId?: string;
  /** Seed3D 特有：是否启用两步生成 */
  coarseToFine?: boolean;
  /** Seed3D 特有：是否输出完整 PBR 贴图 */
  pbrOutput?: boolean;
}

export interface ThreeDTaskResult {
  taskId: string;
  status: ThreeDTaskStatusType;
  platform: ThreeDPlatformId;
}

export interface ThreeDTaskStatus {
  taskId: string;
  status: ThreeDTaskStatusType;
  /** 生成成功时的模型文件 URL */
  modelUrl?: string;
  /** 生成成功时的预览图 URL */
  previewImageUrl?: string;
  /** 输出格式 */
  format?: ThreeDOutputFormat;
  /** 错误信息 */
  error?: { code: string; message: string };
  createdAt?: number;
  completedAt?: number;
}

export interface ThreeDTaskListResult {
  total: number;
  items: ThreeDTaskStatus[];
}

// ==========================================
// 上下文缓存相关
// ==========================================

export interface CacheCreateParams {
  /** 模型端点 ID */
  model: string;
  /** 待缓存的消息数组 */
  messages: CacheMessage[];
  /** 缓存有效期（秒），最大 604800（7 天） */
  ttl?: number;
}

export interface CacheMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CacheResult {
  cacheId: string;
  model: string;
  createdAt: number;
  expiresAt: number;
}

export interface CacheChatParams {
  model: string;
  cacheId: string;
  messages: CacheMessage[];
  stream?: boolean;
}

// ==========================================
// Bot 应用相关
// ==========================================

export interface BotCreateParams {
  name: string;
  description?: string;
  systemPrompt?: string;
  pluginIds?: string[];
}

export interface BotResult {
  botId: string;
  name: string;
}

export interface PublishResult {
  botId: string;
  version: string;
}

export interface BotListFilter {
  pageIndex?: number;
  pageSize?: number;
}

export interface BotListResult {
  bots: BotDetailResult[];
  total: number;
}

export interface BotDetailResult {
  botId: string;
  name: string;
  description?: string;
  publishedVersion?: string;
}

// ==========================================
// 对话相关
// ==========================================

export interface DialogChatParams {
  botId: string;
  userId: string;
  conversationId?: string;
  messages: DialogMessage[];
  autoSaveHistory?: boolean;
}

export interface DialogMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  contentType?: 'text' | 'object_string';
}

export interface DialogChatResult {
  chatId: string;
  conversationId: string;
  status: 'created' | 'in_progress' | 'completed' | 'failed';
  answer?: string;
  usage?: { tokenCount: number };
}

export interface DialogStreamChunk {
  event: 'CONVERSATION_MESSAGE_DELTA' | 'CONVERSATION_CHAT_COMPLETED' | string;
  data: string;
  chatId?: string;
  conversationId?: string;
}

export interface ConversationResult {
  conversationId: string;
}

export interface MessageListResult {
  messages: DialogMessage[];
}

// ==========================================
// 模型响应相关
// ==========================================

export interface ResponseCreateParams {
  model: string;
  input: string | ResponseInputMessage[];
  stream?: boolean;
  previousResponseId?: string;
  caching?: { type: 'enabled' };
  store?: boolean;
  thinking?: { type: 'enabled'; budgetTokens: number };
  temperature?: number;
  expireAt?: number;
}

export interface ResponseInputMessage {
  role: 'user' | 'system' | 'developer';
  content: string;
}

export interface ResponseResult {
  id: string;
  model: string;
  output: ResponseOutputItem[];
  status: string;
  usage?: TokenUsageInfo;
  createdAt: number;
  expireAt?: number;
}

export interface ResponseOutputItem {
  type: string;
  role?: string;
  content?: string;
  status?: string;
}

export interface ResponseStreamChunk {
  type: string;
  delta?: string;
  output?: ResponseOutputItem;
  usage?: TokenUsageInfo;
}

export interface ResponseContextResult {
  responseId: string;
  context: string;
}

export interface TokenUsageInfo {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// ==========================================
// 通用
// ==========================================

export interface TaskListFilter {
  pageNum?: number;
  pageSize?: number;
  status?: string;
}
```

---

### 3.4 平台路由器

文件：`src/domain/services/PlatformRouter.ts`

```typescript
import type { ApiConfig, AnyPlatformId } from '../../adapters/outbound/config/ApiConfigStore';
import type { IVideoGeneratorPort, IImageGeneratorPort, ITextGenerationPort } from '../ports/OutboundPorts';
import type {
  IThreeDGenerationPort, IContextCachePort,
  IBotPort, IDialogPort, IModelResponsePort,
} from '../ports/VolcenginePorts';

// ===== 类型定义 =====

/** 适配器工厂函数：接收配置，返回适配器实例 */
type AdapterFactory<T> = (config: ApiConfig) => T;

/** 路由类别到 Port 接口的映射 */
export interface AdapterRegistry {
  video: Map<string, AdapterFactory<IVideoGeneratorPort>>;
  image: Map<string, AdapterFactory<IImageGeneratorPort>>;
  text: Map<string, AdapterFactory<ITextGenerationPort>>;
  threeD: Map<string, AdapterFactory<IThreeDGenerationPort>>;
  cache: Map<string, AdapterFactory<IContextCachePort>>;
  bot: Map<string, AdapterFactory<IBotPort>>;
  dialog: Map<string, AdapterFactory<IDialogPort>>;
  response: Map<string, AdapterFactory<IModelResponsePort>>;
}

export type RouteCategory = keyof AdapterRegistry;

/** 配置错误：Token 未配置或适配器未注册 */
export class PlatformConfigError extends Error {
  constructor(
    public readonly platformId: string,
    message: string,
  ) {
    super(message);
    this.name = 'PlatformConfigError';
  }
}

// ===== 路由器实现 =====

export class PlatformRouter {
  private registry: AdapterRegistry;

  constructor() {
    this.registry = {
      video: new Map(),
      image: new Map(),
      text: new Map(),
      threeD: new Map(),
      cache: new Map(),
      bot: new Map(),
      dialog: new Map(),
      response: new Map(),
    };
  }

  /**
   * 注册适配器工厂。
   * 在应用启动时（dependencies.ts）一次性调用。
   */
  register<T extends RouteCategory>(
    category: T,
    platformId: string,
    factory: AdapterFactory<AdapterRegistry[T] extends Map<string, AdapterFactory<infer P>> ? P : never>,
  ): void {
    this.registry[category].set(platformId, factory as any);
  }

  /**
   * 根据当前配置解析并返回对应适配器实例。
   * 若配置缺失或适配器未注册，抛出 PlatformConfigError。
   */
  resolve<T extends RouteCategory>(
    category: T,
    config: ApiConfig,
  ): AdapterRegistry[T] extends Map<string, AdapterFactory<infer P>> ? P : never {
    const platformId = this.getPlatformId(category, config);
    const factory = this.registry[category].get(platformId);

    if (!factory) {
      throw new PlatformConfigError(
        platformId,
        `[${category}] 平台 "${platformId}" 的适配器未注册。请前往配置中心检查平台设置。`,
      );
    }

    return factory(config) as any;
  }

  /**
   * 检查指定平台是否已注册（用于 UI 层禁用未配置的选项）。
   */
  isRegistered(category: RouteCategory, platformId: string): boolean {
    return this.registry[category].has(platformId);
  }

  /**
   * 获取指定类别下所有已注册的 platformId 列表（用于 UI 动态渲染选项）。
   */
  getRegisteredPlatforms(category: RouteCategory): string[] {
    return Array.from(this.registry[category].keys());
  }

  // ===== 私有方法 =====

  private getPlatformId(category: RouteCategory, config: ApiConfig): string {
    const mapping: Record<RouteCategory, keyof ApiConfig> = {
      video: 'platformVideo',
      image: 'platformImage',
      text: 'platformText',
      threeD: 'platform3d',
      cache: 'platformCache',
      bot: 'platformBot',
      dialog: 'platformDialog',
      response: 'platformResponse',
    };
    return config[mapping[category]] as string;
  }
}
```

---

### 3.5 火山引擎 HTTP 客户端

文件：`src/adapters/outbound/api/volcengine/VolcengineHttpClient.ts`

> 设计决策：抽取共享 HTTP 客户端，封装认证、Base URL、错误处理、重试逻辑，避免每个适配器重复实现。

```typescript
import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosError } from 'axios';
import type { ApiConfig } from '../../config/ApiConfigStore';
import { parseVolcengineError, VolcengineApiError } from './VolcengineErrorUtils';

export class VolcengineHttpClient {
  private client: AxiosInstance;

  constructor(private config: ApiConfig) {
    this.client = axios.create({
      baseURL: config.volcArkBaseUrl,
      timeout: 120_000, // 120s（视频/3D 生成可能耗时较长）
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.volcArkApiKey}`,
      },
    });

    // 响应拦截器：统一错误处理
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const parsed = parseVolcengineError(error);
        return Promise.reject(parsed);
      },
    );
  }

  async post<T>(path: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(path, data, config);
    return response.data;
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.client.get<T>(path, { params });
    return response.data;
  }

  async delete<T>(path: string): Promise<T> {
    const response = await this.client.delete<T>(path);
    return response.data;
  }

  /**
   * SSE 流式请求。
   * 使用原生 fetch + ReadableStream，返回 AsyncIterable。
   */
  async *stream<T>(path: string, data: unknown): AsyncIterable<T> {
    const url = `${this.config.volcArkBaseUrl}${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.volcArkApiKey}`,
      },
      body: JSON.stringify({ ...data as object, stream: true }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new VolcengineApiError(response.status, `HTTP ${response.status}`, errorBody);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('无法获取响应流');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留未完成的行

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') return;
          try {
            yield JSON.parse(payload) as T;
          } catch {
            // 跳过无法解析的行
          }
        }
      }
    }
  }
}
```

---

### 3.6 火山引擎错误处理

文件：`src/adapters/outbound/api/volcengine/VolcengineErrorUtils.ts`

```typescript
import type { AxiosError } from 'axios';

/**
 * 火山引擎 API 错误类。
 * 携带 HTTP 状态码和平台错误信息，供 UI 层展示。
 */
export class VolcengineApiError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly errorCode: string,
    public readonly rawMessage: string,
  ) {
    super(VolcengineApiError.toUserMessage(httpStatus, errorCode, rawMessage));
    this.name = 'VolcengineApiError';
  }

  /** 生成用户可读的错误信息 */
  private static toUserMessage(status: number, code: string, raw: string): string {
    switch (status) {
      case 400:
        return `请求参数错误：${raw}。请检查输入内容是否符合接口要求。`;
      case 401:
        return '火山引擎 API Key 无效或已过期，请前往配置中心重新配置。';
      case 403:
        return '当前 Token 无权访问此功能，请检查 Token 权限配置。';
      case 429:
        return '请求过于频繁，请稍后重试。';
      case 503:
        return '火山引擎服务暂时不可用，请稍后重试。';
      default:
        return `火山引擎请求失败 (${status}): ${raw}`;
    }
  }

  /** 是否可重试（仅 429 允许重试） */
  get isRetryable(): boolean {
    return this.httpStatus === 429;
  }
}

/** 从 AxiosError 解析为 VolcengineApiError */
export function parseVolcengineError(error: AxiosError): VolcengineApiError {
  const status = error.response?.status ?? 0;
  const data = error.response?.data as VolcengineErrorBody | undefined;
  const errorCode = data?.error?.code ?? data?.error?.type ?? 'UNKNOWN';
  const rawMessage = data?.error?.message ?? error.message ?? 'Unknown error';
  return new VolcengineApiError(status, errorCode, rawMessage);
}

/** 火山引擎错误响应体结构 */
interface VolcengineErrorBody {
  error?: {
    code?: string;
    type?: string;
    message?: string;
  };
}

/**
 * 带指数退避的重试包装器。
 * 仅对 429 错误重试，其他错误直接抛出。
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (error instanceof VolcengineApiError && error.isRetryable && attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}
```

---

### 3.7 适配器实现规格

#### 3.7.1 VolcengineVideoAdapter

文件：`src/adapters/outbound/api/volcengine/VolcengineVideoAdapter.ts`

```typescript
import type {
  IVideoGeneratorPort, VideoPromptContext, VideoAgentContext,
  VideoTaskResult, VideoDownloadResult, VideoAgentTaskResult,
} from '../../../domain/ports/OutboundPorts';
import type { ApiConfig } from '../../config/ApiConfigStore';
import { VolcengineHttpClient } from './VolcengineHttpClient';
import { withRetry } from './VolcengineErrorUtils';

/**
 * 火山引擎视频生成适配器（Seedance 系列模型）。
 *
 * 接口映射：
 *   IVideoGeneratorPort.submitVideoTask  → POST /contents/generations/tasks（返回 task_id 字符串）
 *   IVideoGeneratorPort.queryTaskStatus  → GET  /contents/generations/tasks/{task_id}
 *   IVideoGeneratorPort.downloadVideo    → 从 queryTask 结果中提取 video_url
 *
 * 注意：
 *   - 火山引擎无 createAgentTask / queryAgentTask 概念，这两个方法抛出 NotImplementedError
 *   - video_url 有效期 24 小时
 */
export class VolcengineVideoAdapter implements IVideoGeneratorPort {
  private http: VolcengineHttpClient;

  constructor(private config: ApiConfig) {
    this.http = new VolcengineHttpClient(config);
  }

  async submitVideoTask(context: VideoPromptContext): Promise<string> {
    const payload = this.buildPayload(context);
    const result = await withRetry(() =>
      this.http.post<{ id: string }>('/contents/generations/tasks', payload),
    );
    return result.id;
  }

  async queryTaskStatus(taskId: string): Promise<VideoTaskResult> {
    const result = await this.http.get<VolcengineTaskResponse>(`/contents/generations/tasks/${taskId}`);
    return {
      status: this.mapStatus(result.status),
      videoUrl: result.content?.video_url,
      errorMessage: result.error?.message,
    };
  }

  async downloadVideo(fileIdOrUrl: string): Promise<VideoDownloadResult> {
    // 火山引擎返回的是直接 video_url，无需额外下载接口
    return {
      downloadUrl: fileIdOrUrl,
      filename: `volc-video-${Date.now()}.mp4`,
      bytes: 0,
      createdAt: Date.now(),
    };
  }

  // 火山引擎不支持 Agent 模板模式
  async createAgentTask(_context: VideoAgentContext): Promise<string> {
    throw new Error('火山引擎视频生成不支持 Agent 模板模式');
  }

  async queryAgentTask(_taskId: string): Promise<VideoAgentTaskResult> {
    throw new Error('火山引擎视频生成不支持 Agent 模板模式');
  }

  // ===== 私有方法 =====

  /**
   * 将 VideoPromptContext 转换为火山引擎 API 请求体。
   * Seedance API 使用 content[] 数组格式（非 MiniMax 的扁平格式）。
   */
  private buildPayload(context: VideoPromptContext): Record<string, unknown> {
    const content: Array<Record<string, unknown>> = [];

    // 文本提示词
    if (context.prompt) {
      content.push({ type: 'text', text: context.prompt });
    }

    // 首帧图片
    if (context.firstFrameImageUrl) {
      content.push({
        type: 'image_url',
        image_url: { url: context.firstFrameImageUrl },
        role: 'first_frame',
      });
    }

    // 尾帧图片
    if (context.lastFrameImageUrl) {
      content.push({
        type: 'image_url',
        image_url: { url: context.lastFrameImageUrl },
        role: 'last_frame',
      });
    }

    // 参考图
    if (context.referenceImageUrl) {
      content.push({
        type: 'image_url',
        image_url: { url: context.referenceImageUrl },
        role: 'reference_image',
      });
    }

    return {
      model: context.model || 'doubao-seedance-2-pro',
      content,
    };
  }

  /** 状态映射：火山引擎 → 系统内部 */
  private mapStatus(volcStatus: string): VideoTaskStatus {
    const mapping: Record<string, VideoTaskStatus> = {
      queued: 'pending',
      running: 'processing',
      succeeded: 'completed',
      failed: 'failed',
      expired: 'failed',
      cancelled: 'cancelled',
    };
    return mapping[volcStatus] || 'pending';
  }
}

/** 火山引擎任务查询 API 响应结构（适配器内部类型，跨适配器复用） */
export interface VolcengineTaskResponse {
  id: string;
  status: string;
  content?: {
    video_url?: string;
    model_url?: string;
    preview_image_url?: string;
    format?: string;
  };
  error?: {
    code: string;
    message: string;
  };
  created_at?: number;
  completed_at?: number;
}
```

#### 3.7.2 VolcengineImageAdapter

文件：`src/adapters/outbound/api/volcengine/VolcengineImageAdapter.ts`

```typescript
import type { IImageGeneratorPort, ImageGenerationContext, ImageGenerationResult } from '../../../domain/ports/OutboundPorts';
import type { ApiConfig } from '../../config/ApiConfigStore';
import { VolcengineHttpClient } from './VolcengineHttpClient';
import { withRetry } from './VolcengineErrorUtils';

/**
 * 火山引擎图片生成适配器（Seedream 系列模型）。
 *
 * 接口映射：
 *   IImageGeneratorPort.generateImage → POST /images/generations
 *
 * 支持标准模式和流式模式。
 */
export class VolcengineImageAdapter implements IImageGeneratorPort {
  private http: VolcengineHttpClient;

  constructor(private config: ApiConfig) {
    this.http = new VolcengineHttpClient(config);
  }

  async generateImage(context: ImageGenerationContext): Promise<ImageGenerationResult> {
    const payload = this.buildPayload(context);

    const result = await withRetry(() =>
      this.http.post<{
        created: number;
        data: Array<{ url?: string; b64_json?: string; size?: string }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      }>('/images/generations', payload),
    );

    return {
      imageUrls: result.data.filter(item => item.url).map(item => item.url!),
      imageDataUri: result.data.find(item => item.b64_json)?.b64_json
        ? `data:image/png;base64,${result.data.find(item => item.b64_json)!.b64_json}`
        : undefined,
      metadata: {
        successCount: result.data.filter(item => item.url || item.b64_json).length,
        failedCount: result.data.length - result.data.filter(item => item.url || item.b64_json).length,
      },
    };
  }

  /**
   * 流式图片生成（扩展方法，不在 IImageGeneratorPort 中，供新 UI 使用）。
   */
  async *generateImageStream(context: ImageGenerationContext): AsyncIterable<VolcengineImageStreamEvent> {
    const payload = { ...this.buildPayload(context), stream: true };
    yield* this.http.stream<VolcengineImageStreamEvent>('/images/generations', payload);
  }

  private buildPayload(context: ImageGenerationContext): Record<string, unknown> {
    return {
      model: 'doubao-seedream-4-5-251128',
      prompt: context.prompt,
      ...(context.subjectReferenceUrl && { image: [context.subjectReferenceUrl] }),
      ...(context.width && context.height && { size: `${context.width}x${context.height}` }),
      ...(context.n && { n: context.n }),
      ...(context.seed !== undefined && { seed: context.seed }),
      response_format: context.responseFormat === 'base64' ? 'b64_json' : 'url',
    };
  }
}

/** 流式图片生成事件（适配器内部类型） */
interface VolcengineImageStreamEvent {
  type: 'partial_success' | 'partial_failure' | 'completion';
  data?: { url?: string; b64_json?: string };
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}
```

#### 3.7.3 Volcengine3DAdapter

文件：`src/adapters/outbound/api/volcengine/Volcengine3DAdapter.ts`

```typescript
import type { IThreeDGenerationPort } from '../../../domain/ports/VolcenginePorts';
import type {
  ThreeDSubmitParams, ThreeDTaskResult, ThreeDTaskStatus,
  ThreeDTaskListResult, ThreeDPlatformId, ThreeDTaskStatusType, ThreeDOutputFormat,
  TaskListFilter,
} from '../../../domain/entities/models';
import type { ApiConfig } from '../../config/ApiConfigStore';
import { VolcengineHttpClient } from './VolcengineHttpClient';
import { withRetry } from './VolcengineErrorUtils';
import type { VolcengineTaskResponse } from './VolcengineVideoAdapter';

/**
 * 火山引擎 3D 生成适配器。
 * 一个类覆盖三个子提供商（Seed3D / 影眸 / 数美），通过 provider 参数区分。
 *
 * 三个提供商共享相同的 API 端点结构，仅 model 字段（端点 ID）不同。
 */
export class Volcengine3DAdapter implements IThreeDGenerationPort {
  private http: VolcengineHttpClient;
  private provider: ThreeDPlatformId;

  constructor(private config: ApiConfig, provider: ThreeDPlatformId) {
    this.http = new VolcengineHttpClient(config);
    this.provider = provider;
  }

  async submitTask(params: ThreeDSubmitParams): Promise<ThreeDTaskResult> {
    const payload = this.buildPayload(params);
    const result = await withRetry(() =>
      this.http.post<{ id: string; status: string }>('/contents/generations/tasks', payload),
    );
    return {
      taskId: result.id,
      status: result.status as ThreeDTaskStatusType,
      platform: this.provider,
    };
  }

  async queryTask(taskId: string): Promise<ThreeDTaskStatus> {
    const result = await this.http.get<VolcengineTaskResponse>(`/contents/generations/tasks/${taskId}`);
    return {
      taskId: result.id,
      status: result.status as ThreeDTaskStatusType,
      modelUrl: result.content?.model_url,
      previewImageUrl: result.content?.preview_image_url,
      format: result.content?.format as ThreeDOutputFormat | undefined,
      error: result.error,
      createdAt: result.created_at,
      completedAt: result.completed_at,
    };
  }

  async queryTaskList(filters?: TaskListFilter): Promise<ThreeDTaskListResult> {
    const result = await this.http.get<{ total: number; items: VolcengineTaskResponse[] }>('/contents/generations/tasks', {
      page_num: filters?.pageNum ?? 1,
      page_size: filters?.pageSize ?? 20,
      ...(filters?.status && { 'filter.status': filters.status }),
    });
    return { total: result.total, items: result.items ?? [] };
  }

  async cancelTask(taskId: string): Promise<void> {
    await this.http.delete(`/contents/generations/tasks/${taskId}`);
  }

  private buildPayload(params: ThreeDSubmitParams): Record<string, unknown> {
    const content: Array<Record<string, unknown>> = [];

    if (params.prompt) {
      content.push({ type: 'text', text: params.prompt });
    }
    if (params.imageUrls) {
      for (const url of params.imageUrls) {
        content.push({ type: 'image_url', image_url: { url } });
      }
    }

    return {
      model: params.modelEndpointId || this.getDefaultModel(),
      content,
      // Seed3D 特有参数
      ...(this.provider === 'volcengine-seed3d' && {
        coarse_to_fine: params.coarseToFine,
        pbr_output: params.pbrOutput,
      }),
    };
  }

  private getDefaultModel(): string {
    // 实际端点 ID 需用户在火山方舟控制台创建推理接入点后获取
    // 此处为占位，运行时从配置或参数中获取
    switch (this.provider) {
      case 'volcengine-seed3d': return 'seed3d-2.0';
      case 'volcengine-yingmou': return 'yingmou-hyper3d-gen2';
      case 'volcengine-shumei': return 'shumei-hitem3d-2.0';
    }
  }
}
```

#### 3.7.4 VolcengineTextAdapter

文件：`src/adapters/outbound/api/volcengine/VolcengineTextAdapter.ts`

```typescript
import type {
  ITextGenerationPort, TextGenerationContext, TextGenerationResult,
  TextStreamCallbacks,
} from '../../../domain/ports/OutboundPorts';
import type { ApiConfig } from '../../config/ApiConfigStore';
import { VolcengineHttpClient } from './VolcengineHttpClient';
import { withRetry } from './VolcengineErrorUtils';

/**
 * 火山引擎文本生成适配器。
 *
 * 接口映射：
 *   ITextGenerationPort.chatCompletion       → POST /chat/completions
 *   ITextGenerationPort.chatCompletionStream  → POST /chat/completions (stream: true)
 *
 * 注意：与 MiniMaxTextAdapter 使用相同的 OpenAI 兼容格式，
 * 但 Base URL 和认证 Token 不同。
 */
export class VolcengineTextAdapter implements ITextGenerationPort {
  private http: VolcengineHttpClient;

  constructor(private config: ApiConfig) {
    this.http = new VolcengineHttpClient(config);
  }

  async chatCompletion(context: TextGenerationContext): Promise<TextGenerationResult> {
    const payload = this.buildPayload(context);
    const result = await withRetry(() =>
      this.http.post<VolcengineChatCompletionResponse>('/chat/completions', payload),
    );
    return {
      content: result.choices?.[0]?.message?.content ?? '',
      usage: result.usage ? {
        promptTokens: result.usage.prompt_tokens,
        completionTokens: result.usage.completion_tokens,
        cachedTokens: result.usage.prompt_tokens_details?.cached_tokens,
      } : undefined,
    };
  }

  chatCompletionStream(context: TextGenerationContext, callbacks: TextStreamCallbacks): AbortController {
    const abortController = new AbortController();
    this.runStream(context, callbacks, abortController);
    return abortController;
  }

  private async runStream(
    context: TextGenerationContext,
    callbacks: TextStreamCallbacks,
    abortController: AbortController,
  ): Promise<void> {
    try {
      const payload = { ...this.buildPayload(context), stream: true };
      const url = `${this.config.volcArkBaseUrl}/chat/completions`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.volcArkApiKey}`,
        },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法获取响应流');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') {
              callbacks.onComplete({ content: '' });
              return;
            }
            try {
              const chunk = JSON.parse(payload) as VolcengineChatCompletionResponse;
              const delta = chunk.choices?.[0]?.delta?.content ?? '';
              if (delta) callbacks.onTextDelta(delta);
            } catch { /* skip */ }
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private buildPayload(context: TextGenerationContext): Record<string, unknown> {
    return {
      model: context.model ?? 'doubao-pro-32k',
      messages: context.messages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : m.content.map(b => b.type === 'text' ? b.text : '').join(''),
      })),
      ...(context.temperature !== undefined && { temperature: context.temperature }),
      ...(context.maxTokens && { max_tokens: context.maxTokens }),
      ...(context.topP !== undefined && { top_p: context.topP }),
      ...(context.tools && { tools: context.tools.map(t => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })) }),
    };
  }
}

/** 火山引擎 Chat Completion API 响应结构（适配器内部类型，跨适配器复用） */
export interface VolcengineChatCompletionResponse {
  choices?: Array<{
    message?: { content: string };
    delta?: { content: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_tokens_details?: { cached_tokens: number };
  };
}
```

#### 3.7.5 VolcengineCacheAdapter

文件：`src/adapters/outbound/api/volcengine/VolcengineCacheAdapter.ts`

```typescript
import type { IContextCachePort, ChatCompletionResult, ChatStreamChunk } from '../../../domain/ports/VolcenginePorts';
import type { CacheCreateParams, CacheResult, CacheChatParams } from '../../../domain/entities/models';
import type { ApiConfig } from '../../config/ApiConfigStore';
import { VolcengineHttpClient } from './VolcengineHttpClient';
import { withRetry } from './VolcengineErrorUtils';
import type { VolcengineChatCompletionResponse } from './VolcengineTextAdapter';

export class VolcengineCacheAdapter implements IContextCachePort {
  private http: VolcengineHttpClient;

  constructor(private config: ApiConfig) {
    this.http = new VolcengineHttpClient(config);
  }

  async createCache(params: CacheCreateParams): Promise<CacheResult> {
    const result = await withRetry(() =>
      this.http.post<{ id: string }>('/context/caches', {
        model: params.model,
        messages: params.messages,
        ...(params.ttl && { ttl: params.ttl }),
      }),
    );
    return {
      cacheId: result.id,
      model: params.model,
      createdAt: Date.now(),
      expiresAt: Date.now() + (params.ttl ?? 604800) * 1000,
    };
  }

  async chatWithCache(params: CacheChatParams): Promise<ChatCompletionResult> {
    const result = await withRetry(() =>
      this.http.post<VolcengineChatCompletionResponse>('/chat/completions', {
        model: params.model,
        messages: params.messages,
        context_id: params.cacheId,
      }),
    );
    return {
      content: result.choices?.[0]?.message?.content ?? '',
      usage: result.usage ? {
        promptTokens: result.usage.prompt_tokens,
        completionTokens: result.usage.completion_tokens,
        totalTokens: result.usage.total_tokens,
      } : undefined,
      finishReason: result.choices?.[0]?.finish_reason,
    };
  }

  async *chatWithCacheStream(params: CacheChatParams): AsyncIterable<ChatStreamChunk> {
    const payload = {
      model: params.model,
      messages: params.messages,
      context_id: params.cacheId,
      stream: true,
    };
    for await (const chunk of this.http.stream<VolcengineChatCompletionResponse>('/chat/completions', payload)) {
      yield {
        delta: chunk.choices?.[0]?.delta?.content ?? '',
        finishReason: chunk.choices?.[0]?.finish_reason,
      };
    }
  }
}
```

#### 3.7.6 VolcengineResponseAdapter

文件：`src/adapters/outbound/api/volcengine/VolcengineResponseAdapter.ts`

```typescript
import type { IModelResponsePort } from '../../../domain/ports/VolcenginePorts';
import type {
  ResponseCreateParams, ResponseResult, ResponseStreamChunk, ResponseContextResult,
} from '../../../domain/entities/models';
import type { ApiConfig } from '../../config/ApiConfigStore';
import { VolcengineHttpClient } from './VolcengineHttpClient';
import { withRetry } from './VolcengineErrorUtils';

export class VolcengineResponseAdapter implements IModelResponsePort {
  private http: VolcengineHttpClient;

  constructor(private config: ApiConfig) {
    this.http = new VolcengineHttpClient(config);
  }

  async createResponse(params: ResponseCreateParams): Promise<ResponseResult> {
    return withRetry(() =>
      this.http.post<ResponseResult>('/responses', this.buildPayload(params)),
    );
  }

  async *createResponseStream(params: ResponseCreateParams): AsyncIterable<ResponseStreamChunk> {
    yield* this.http.stream<ResponseStreamChunk>('/responses', {
      ...this.buildPayload(params),
      stream: true,
    });
  }

  async getResponse(responseId: string): Promise<ResponseResult> {
    return this.http.get<ResponseResult>(`/responses/${responseId}`);
  }

  async getResponseContext(responseId: string): Promise<ResponseContextResult> {
    return this.http.get<ResponseContextResult>(`/responses/${responseId}/context`);
  }

  async deleteResponse(responseId: string): Promise<void> {
    await this.http.delete(`/responses/${responseId}`);
  }

  private buildPayload(params: ResponseCreateParams): Record<string, unknown> {
    return {
      model: params.model,
      input: params.input,
      ...(params.previousResponseId && { previous_response_id: params.previousResponseId }),
      ...(params.caching && { caching: params.caching }),
      ...(params.store !== undefined && { store: params.store }),
      ...(params.thinking && { thinking: params.thinking }),
      ...(params.temperature !== undefined && { temperature: params.temperature }),
      ...(params.expireAt !== undefined && { expire_at: params.expireAt }),
    };
  }
}
```

#### 3.7.7 Coze HTTP 客户端

文件：`src/adapters/outbound/api/coze/CozeHttpClient.ts`

```typescript
import axios, { type AxiosInstance, type AxiosError } from 'axios';
import type { ApiConfig } from '../../config/ApiConfigStore';

/**
 * Coze 平台 HTTP 客户端。
 * 认证方式：Authorization: Bearer {cozePatToken}
 * 错误格式与火山方舟不同，需独立处理。
 */
export class CozeHttpClient {
  private client: AxiosInstance;

  constructor(private config: ApiConfig) {
    this.client = axios.create({
      baseURL: config.cozeBaseUrl,
      timeout: 60_000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.cozePatToken}`,
      },
    });

    this.client.interceptors.response.use(
      (response) => {
        // Coze 返回 { code, msg, data } 格式，需检查 code
        const body = response.data;
        if (body?.code && body.code !== 0) {
          return Promise.reject(new CozeApiError(body.code, body.msg ?? 'Unknown Coze error'));
        }
        return response;
      },
      (error: AxiosError) => Promise.reject(new CozeApiError(error.response?.status ?? 0, error.message)),
    );
  }

  async post<T>(path: string, data?: unknown): Promise<T> {
    const response = await this.client.post<{ code: number; msg: string; data: T }>(path, data);
    return response.data.data;
  }

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.client.get<{ code: number; msg: string; data: T }>(path, { params });
    return response.data.data;
  }

  /** SSE 流式请求（Coze /v3/chat 流式模式） */
  async *stream(path: string, data: unknown): AsyncIterable<CozeStreamEvent> {
    const url = `${this.config.cozeBaseUrl}${path}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.cozePatToken}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new CozeApiError(response.status, `HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('无法获取响应流');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            yield {
              event: parsed.event ?? parsed.type ?? '',
              data: parsed,
            };
          } catch { /* skip */ }
        }
      }
    }
  }
}

export interface CozeStreamEvent {
  event: string;
  data: CozeStreamData;
}

/** Coze SSE 流式事件数据（适配器内部类型） */
export interface CozeStreamData {
  event?: string;
  type?: string;
  chat_id?: string;
  conversation_id?: string;
  content?: string;
  role?: string;
  [key: string]: unknown;
}

export class CozeApiError extends Error {
  constructor(
    public readonly code: number,
    public readonly rawMessage: string,
  ) {
    super(`Coze API 错误 (${code}): ${rawMessage}`);
    this.name = 'CozeApiError';
  }
}
```

#### 3.7.8 CozeBotAdapter

文件：`src/adapters/outbound/api/coze/CozeBotAdapter.ts`

```typescript
import type { IBotPort } from '../../../domain/ports/VolcenginePorts';
import type {
  BotCreateParams, BotResult, PublishResult,
  BotListFilter, BotListResult, BotDetailResult,
} from '../../../domain/entities/models';
import type { ApiConfig } from '../../config/ApiConfigStore';
import { CozeHttpClient } from './CozeHttpClient';

export class CozeBotAdapter implements IBotPort {
  private http: CozeHttpClient;

  constructor(private config: ApiConfig) {
    this.http = new CozeHttpClient(config);
  }

  async createBot(params: BotCreateParams): Promise<BotResult> {
    const result = await this.http.post<{ bot_id: string }>('/v1/bots/create', {
      space_id: this.config.cozeSpaceId,
      name: params.name,
      ...(params.description && { desc: params.description }),
      ...(params.systemPrompt && { prompt_info: { prompt: params.systemPrompt } }),
      ...(params.pluginIds && { plugins: params.pluginIds.map(id => ({ id })) }),
    });
    return { botId: result.bot_id, name: params.name };
  }

  async publishBot(botId: string): Promise<PublishResult> {
    const result = await this.http.post<{ version: string }>('/v1/bots/publish', {
      bot_id: botId,
    });
    return { botId, version: result.version };
  }

  async listBots(filters?: BotListFilter): Promise<BotListResult> {
    const result = await this.http.post<{
      bots: Array<{ bot_id: string; name: string; description: string; version: string }>;
      total: number;
    }>('/v1/space/published_bots_list', {
      space_id: this.config.cozeSpaceId,
      page_index: filters?.pageIndex ?? 1,
      page_size: filters?.pageSize ?? 20,
    });
    return {
      total: result.total,
      bots: result.bots.map(b => ({
        botId: b.bot_id,
        name: b.name,
        description: b.description,
        publishedVersion: b.version,
      })),
    };
  }

  async getBotDetail(botId: string): Promise<BotDetailResult> {
    const result = await this.http.get<{
      bot_id: string; name: string; description: string; version: string;
    }>(`/v1/bots/${botId}`);
    return {
      botId: result.bot_id,
      name: result.name,
      description: result.description,
      publishedVersion: result.version,
    };
  }
}
```

#### 3.7.9 CozeDialogAdapter

文件：`src/adapters/outbound/api/coze/CozeDialogAdapter.ts`

```typescript
import type { IDialogPort } from '../../../domain/ports/VolcenginePorts';
import type {
  DialogChatParams, DialogChatResult, DialogStreamChunk,
  ConversationResult, MessageListResult, DialogMessage,
} from '../../../domain/entities/models';
import type { ApiConfig } from '../../config/ApiConfigStore';
import { CozeHttpClient, type CozeStreamEvent } from './CozeHttpClient';

export class CozeDialogAdapter implements IDialogPort {
  private http: CozeHttpClient;

  constructor(private config: ApiConfig) {
    this.http = new CozeHttpClient(config);
  }

  async createConversation(botId: string): Promise<ConversationResult> {
    const result = await this.http.post<{ id: string }>('/v1/conversations/create', {
      bot_id: botId,
    });
    return { conversationId: result.id };
  }

  async chat(params: DialogChatParams): Promise<DialogChatResult> {
    const result = await this.http.post<{
      chat_id: string;
      conversation_id: string;
      status: string;
      usage: { token_count: number };
    }>('/v3/chat', {
      bot_id: params.botId,
      user_id: params.userId,
      stream: false,
      auto_save_history: params.autoSaveHistory ?? true,
      additional_messages: params.messages.map(m => ({
        role: m.role,
        content: m.content,
        content_type: m.contentType ?? 'text',
      })),
    }, /* query params via URL */);

    // 非流式模式需要轮询获取结果
    // 实际实现中需要附加 conversation_id 作为 query param
    return {
      chatId: result.chat_id,
      conversationId: result.conversation_id,
      status: result.status as DialogChatResult['status'],
      usage: { tokenCount: result.usage?.token_count ?? 0 },
    };
  }

  async *chatStream(params: DialogChatParams): AsyncIterable<DialogStreamChunk> {
    for await (const event of this.http.stream('/v3/chat', {
      bot_id: params.botId,
      user_id: params.userId,
      stream: true,
      auto_save_history: params.autoSaveHistory ?? true,
      additional_messages: params.messages.map(m => ({
        role: m.role,
        content: m.content,
        content_type: m.contentType ?? 'text',
      })),
    })) {
      yield {
        event: event.event,
        data: JSON.stringify(event.data),
        chatId: event.data.chat_id,
        conversationId: event.data.conversation_id,
      };
    }
  }

  async listMessages(conversationId: string, chatId: string): Promise<MessageListResult> {
    const result = await this.http.get<{
      messages: Array<{ role: string; content: string; type: string }>;
    }>('/v3/chat/message/list', {
      conversation_id: conversationId,
      chat_id: chatId,
    });
    return {
      messages: result.messages.map(m => ({
        role: m.role as DialogMessage['role'],
        content: m.content,
        contentType: 'text' as const,
      })),
    };
  }
}
```

---

### 3.8 DI 组合根改造

文件：`src/dependencies.ts`（变更部分）

```typescript
// ===== 新增导入 =====
import { PlatformRouter } from './domain/services/PlatformRouter';
import { VolcengineVideoAdapter } from './adapters/outbound/api/volcengine/VolcengineVideoAdapter';
import { VolcengineImageAdapter } from './adapters/outbound/api/volcengine/VolcengineImageAdapter';
import { Volcengine3DAdapter } from './adapters/outbound/api/volcengine/Volcengine3DAdapter';
import { VolcengineTextAdapter } from './adapters/outbound/api/volcengine/VolcengineTextAdapter';
import { VolcengineCacheAdapter } from './adapters/outbound/api/volcengine/VolcengineCacheAdapter';
import { VolcengineResponseAdapter } from './adapters/outbound/api/volcengine/VolcengineResponseAdapter';
import { CozeBotAdapter } from './adapters/outbound/api/coze/CozeBotAdapter';
import { CozeDialogAdapter } from './adapters/outbound/api/coze/CozeDialogAdapter';

// ===== 创建 PlatformRouter 并注册所有适配器 =====

export const platformRouter = new PlatformRouter();

// --- MiniMax 适配器注册 ---
platformRouter.register('video', 'minimax', (cfg) => new MiniMaxVideoAdapter());
platformRouter.register('image', 'minimax', (cfg) => new MiniMaxImageAdapter());
platformRouter.register('text', 'minimax', (cfg) => new MiniMaxTextAdapter());

// --- 火山引擎适配器注册 ---
platformRouter.register('video', 'volcengine', (cfg) => new VolcengineVideoAdapter(cfg));
platformRouter.register('image', 'volcengine', (cfg) => new VolcengineImageAdapter(cfg));
platformRouter.register('threeD', 'volcengine-seed3d', (cfg) => new Volcengine3DAdapter(cfg, 'volcengine-seed3d'));
platformRouter.register('threeD', 'volcengine-yingmou', (cfg) => new Volcengine3DAdapter(cfg, 'volcengine-yingmou'));
platformRouter.register('threeD', 'volcengine-shumei', (cfg) => new Volcengine3DAdapter(cfg, 'volcengine-shumei'));
platformRouter.register('text', 'volcengine', (cfg) => new VolcengineTextAdapter(cfg));
platformRouter.register('cache', 'volcengine', (cfg) => new VolcengineCacheAdapter(cfg));
platformRouter.register('response', 'volcengine', (cfg) => new VolcengineResponseAdapter(cfg));

// --- Coze 适配器注册 ---
platformRouter.register('bot', 'coze', (cfg) => new CozeBotAdapter(cfg));
platformRouter.register('dialog', 'coze', (cfg) => new CozeDialogAdapter(cfg));

// ===== 现有 Service 改造示例 =====

// 改造前（硬编码 MiniMax 适配器）：
// export const videoGenerationService = new VideoGenerationService(
//   videoTaskRepo, segmentRepo, characterRepo, backgroundRepo, videoAdapter
// );

// 改造后（通过 PlatformRouter 动态解析）：
export const videoGenerationService = new VideoGenerationService(
  videoTaskRepo, segmentRepo, characterRepo, backgroundRepo, platformRouter
);

// ===== 新增 Service 导出 =====

export const threeDGenerationPort = () => platformRouter.resolve('threeD', ApiConfigStore.load());
export const contextCachePort = () => platformRouter.resolve('cache', ApiConfigStore.load());
export const botPort = () => platformRouter.resolve('bot', ApiConfigStore.load());
export const dialogPort = () => platformRouter.resolve('dialog', ApiConfigStore.load());
export const modelResponsePort = () => platformRouter.resolve('response', ApiConfigStore.load());
```

---

### 3.9 Domain Service 改造模式

以 `VideoGenerationService` 为例，展示从"直接依赖适配器"到"通过 PlatformRouter 动态解析"的改造模式：

```typescript
// ===== 改造前 =====
export class VideoGenerationService {
  constructor(
    private videoTaskRepo: IVideoTaskRepository,
    private segmentRepo: IStorySegmentRepository,
    private characterRepo: ICharacterRepository,
    private backgroundRepo: IBackgroundRepository,
    private videoPort: IVideoGeneratorPort,  // ← 直接持有具体适配器实例
  ) {}

  async generateVideo(segmentId: string, context: VideoPromptContext) {
    const result = await this.videoPort.submitVideoTask(segmentId, context);
    // ...
  }
}

// ===== 改造后 =====
export class VideoGenerationService {
  constructor(
    private videoTaskRepo: IVideoTaskRepository,
    private segmentRepo: IStorySegmentRepository,
    private characterRepo: ICharacterRepository,
    private backgroundRepo: IBackgroundRepository,
    private router: PlatformRouter,  // ← 替换为 PlatformRouter
  ) {}

  async generateVideo(segmentId: string, context: VideoPromptContext) {
    const config = ApiConfigStore.load();
    const videoPort = this.router.resolve('video', config);  // ← 运行时动态解析
    const result = await videoPort.submitVideoTask(segmentId, context);
    // ...
  }
}
```

> 关键变化：Service 不再在构造时绑定具体适配器，而是每次调用时根据当前配置动态解析。这样用户在 Settings 中切换平台后，下一次调用立即生效，无需重新初始化 Service。

---

### 3.10 Vite 代理配置

文件：`vite.config.ts`（新增代理规则）

```typescript
export default defineConfig({
  server: {
    proxy: {
      // 现有 MiniMax 代理（保持不变）
      '/anthropic': { /* ... */ },

      // 新增：火山方舟代理（解决 CORS）
      '/volcengine-ark': {
        target: 'https://ark.cn-beijing.volces.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/volcengine-ark/, '/api/v3'),
      },

      // 新增：Coze 代理
      '/coze': {
        target: 'https://api.coze.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/coze/, ''),
      },
    },
  },
});
```

> 注：开发模式下通过 Vite proxy 绕过 CORS 限制。生产模式下若火山引擎 / Coze 不支持浏览器直接调用，需部署 Cloudflare Worker 作为代理网关。`volcArkBaseUrl` 在 DEV 模式下可配置为 `/volcengine-ark`。

---

### 3.11 Settings 页面组件设计

文件：`src/ui/pages/Settings.tsx`（新增区域）

```
Settings.tsx
├── MiniMaxSection (现有)
│   ├── API Key 输入
│   ├── Group ID 输入
│   ├── Base URL 输入
│   └── Anthropic Base URL 输入
│
├── VolcengineSection (新增)
│   ├── ArkConfigSubSection
│   │   ├── Ark API Key 输入 (type="password")
│   │   ├── Ark Base URL 输入
│   │   ├── 状态 Badge (Live / Mock)
│   │   └── [激活] 按钮 → 调用 validateArkToken()
│   │
│   ├── CozeConfigSubSection
│   │   ├── PAT Token 输入 (type="password")
│   │   ├── Base URL 输入
│   │   ├── Space ID 输入
│   │   ├── 状态 Badge
│   │   └── [激活] 按钮 → 调用 validateCozeToken()
│   │
│   └── PlatformSelectorSection
│       ├── 视频生成: <select> → platformVideo
│       ├── 图片生成: <select> → platformImage
│       ├── 3D 生成:  <select> → platform3d
│       ├── 文本生成: <select> → platformText
│       └── 对话:     <select> → platformDialog
│
├── AvailableModelsSection (现有，扩展火山引擎模型)
└── FileManagementSection (现有)
```

#### Token 校验逻辑

```typescript
async function validateArkToken(apiKey: string, baseUrl: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      return { ok: false, error: `校验失败 (HTTP ${response.status})，请检查 API Key 是否正确` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `网络错误：${err.message}` };
  }
}

async function validateCozeToken(token: string, baseUrl: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`${baseUrl}/v1/bots/list`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ page_index: 1, page_size: 1 }),
    });
    if (!response.ok) {
      return { ok: false, error: `校验失败 (HTTP ${response.status})，请检查 PAT Token 是否正确` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `网络错误：${err.message}` };
  }
}
```

---

## 四、数据流图

### 4.1 视频生成完整调用链

```
用户点击"生成视频"
  │
  ↓
VideoGenerationService.generateVideo(segmentId, context)
  │
  ├─ config = ApiConfigStore.load()
  ├─ videoPort = platformRouter.resolve('video', config)
  │    ├─ config.platformVideo === 'minimax'    → new MiniMaxVideoAdapter()
  │    └─ config.platformVideo === 'volcengine'  → new VolcengineVideoAdapter(config)
  │
  ├─ result = videoPort.submitVideoTask(segmentId, context)
  │    ├─ [MiniMax]     POST {minimaxBaseUrl}/video_generation
  │    └─ [Volcengine]  POST {volcArkBaseUrl}/contents/generations/tasks
  │
  ├─ 保存 VideoTask 到 IndexedDB (status: pending)
  │
  └─ 启动轮询
       ├─ videoPort.queryTaskStatus(taskId)
       │    ├─ [MiniMax]     GET {minimaxBaseUrl}/query/video_generation?task_id=xxx
       │    └─ [Volcengine]  GET {volcArkBaseUrl}/contents/generations/tasks/{task_id}
       │
       ├─ 更新 IndexedDB 状态
       └─ 成功/失败时停止轮询，通知 UI
```

### 4.2 配置切换数据流

```
用户在 Settings 中切换平台选择器
  │
  ↓
Settings.tsx: handlePlatformChange('video', 'volcengine')
  │
  ├─ config = ApiConfigStore.load()
  ├─ config.platformVideo = 'volcengine'
  ├─ ApiConfigStore.save(config)
  │
  └─ 下一次 VideoGenerationService.generateVideo() 调用时：
       ├─ ApiConfigStore.load() → 读取最新配置
       ├─ platformRouter.resolve('video', config) → 返回 VolcengineVideoAdapter
       └─ 调用火山引擎 API
```

---

## 五、异步任务轮询策略

### 5.1 视频生成轮询

| 参数 | 值 |
|------|-----|
| 初始间隔 | 5 秒 |
| 退避策略 | 指数退避，上限 30 秒 |
| 最大轮询时长 | 10 分钟 |
| 超时处理 | 标记任务为 `failed`，提示用户 |

### 5.2 3D 生成轮询

| 参数 | 值 |
|------|-----|
| 初始间隔 | 15 秒 |
| 退避策略 | 固定间隔（3D 生成耗时约 5 分钟） |
| 最大轮询时长 | 15 分钟 |
| 超时处理 | 标记任务为 `failed`，提示用户 |

---

## 六、实施计划

### 6.1 分阶段交付

| 阶段 | 内容 | 预估工时 | 优先级 |
|------|------|---------|--------|
| P1 | 基础设施层：ApiConfigStore 扩展 + PlatformRouter + VolcengineHttpClient + CozeHttpClient + 错误处理 | 1 天 | 最高 |
| P2 | 核心适配器：VolcengineVideoAdapter + VolcengineImageAdapter + VolcengineTextAdapter | 2 天 | 最高 |
| P3 | Service 改造 + DI 注册 + Vite 代理 | 1 天 | 高 |
| P4 | Settings 页面 UI（Ark 配置 + Coze 配置 + 平台选择器 + Token 校验） | 2 天 | 高 |
| P5 | 3D / Cache / Bot / Dialog / Response 适配器 | 2 天 | 中 |
| P6 | 集成测试 + CORS 验证 + 全流程回归 | 1 天 | 中 |
| **合计** | | **约 9 天** | |

### 6.2 关键里程碑

| 里程碑 | 验收条件 |
|--------|---------|
| M1: 配置中心可用 | 用户可在 Settings 中配置火山方舟 / Coze Token 并通过校验 |
| M2: 视频生成切换 | 选择火山引擎后，视频生成全流程通过（提交→轮询→获取结果） |
| M3: 图片+文本切换 | 图片生成和文本生成可切换至火山引擎 |
| M4: 全功能交付 | 3D / Cache / Bot / Dialog / Response 全部可用 |

---

## 七、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| CORS 限制 | 生产环境下浏览器可能阻止直接调用火山引擎 / Coze API | 开发阶段用 Vite proxy；生产阶段部署 Cloudflare Worker 代理；或考虑打包为 Electron 桌面应用绕过 CORS |
| 3D API 端点路径不确定 | 火山引擎文档为 SPA，端点路径为推断值 | 以 `volcenginesdkarkruntime` Python SDK 源码为参考，实际调测验证 |
| Port 接口兼容性 | 现有 `IVideoGeneratorPort` 的方法签名可能不完全适配火山引擎 API 差异 | 适配器内部做参数转换；必要时扩展 Port 接口（向后兼容） |
| 轮询期间 Token 失效 | 异步任务（视频/3D）轮询中途 Token 过期 | 已提交的任务结果仍可获取；新提交直接报错，提示用户更新 Token |
| localStorage 容量限制 | 大量配置 + Token 存储在 localStorage | 当前配置数据量极小（< 1KB），不构成风险 |
