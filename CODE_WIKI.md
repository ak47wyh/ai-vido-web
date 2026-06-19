# AI Video Studio — Code Wiki

> 最后更新：2026-06-19

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈与依赖](#2-技术栈与依赖)
3. [项目架构](#3-项目架构)
4. [目录结构](#4-目录结构)
5. [领域实体层 (Domain Entities)](#5-领域实体层-domain-entities)
6. [端口接口层 (Domain Ports)](#6-端口接口层-domain-ports)
7. [领域服务层 (Domain Services)](#7-领域服务层-domain-services)
8. [适配器层 (Adapters)](#8-适配器层-adapters)
9. [依赖注入容器 (Dependencies)](#9-依赖注入容器-dependencies)
10. [UI 层 (Presentation)](#10-ui-层-presentation)
11. [路由与页面](#11-路由与页面)
12. [国际化 (i18n)](#12-国际化-i18n)
13. [数据持久化 (IndexedDB)](#13-数据持久化-indexeddb)
14. [工具与基础设施](#14-工具与基础设施)
15. [核心业务流程](#15-核心业务流程)
16. [项目运行方式](#16-项目运行方式)

---

## 1. 项目概述

**AI Video Studio** 是一个基于 React + TypeScript 的 AI 短视频创作平台。用户可以通过自然语言输入故事文本，由 AI 自动完成角色提取、场景拆分、图片/视频/配音/BGM 生成，最终通过 FFmpeg 后期合成完整短视频。

### 核心能力

| 能力 | 说明 |
|------|------|
| 故事创作 | 输入故事文本，AI 自动拆分为分镜、提取角色和场景 |
| 图片生成 | 基于 MiniMax Image API 生成角色/场景图片 |
| 视频生成 | 支持 T2V / I2V / FL2V / S2V 多种视频生成模式 |
| 语音合成 | 支持语音克隆、语音设计、流式合成 |
| 音乐生成 | AI 生成背景音乐、歌词创作、翻唱 |
| 文本润色 | AI 文本增强与改写 |
| 后期处理 | FFmpeg WASM 实现视频拼接、字幕烧录、音频混合 |
| 一键成片 | Pipeline 全流程编排，从故事到成片自动完成 |
| AI 助手 | Agent 对话式创作辅助 |

---

## 2. 技术栈与依赖

### 运行时依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| `react` / `react-dom` | ^19.2.6 | UI 框架 |
| `react-router-dom` | ^7.17.0 | 客户端路由 |
| `axios` | ^1.17.0 | HTTP 请求 |
| `dexie` / `dexie-react-hooks` | ^4.4.3 | IndexedDB ORM |
| `@ffmpeg/ffmpeg` / `@ffmpeg/util` | ^0.12.15 | 浏览器端视频处理 (WASM) |
| `i18next` / `react-i18next` / `i18next-browser-languagedetector` | ^26.3.1 | 国际化 |
| `lucide-react` | ^1.17.0 | 图标库 |
| `uuid` | ^14.0.0 | UUID 生成 |

### 开发依赖

| 依赖 | 用途 |
|------|------|
| `vite` | 构建工具 |
| `typescript` ~6.0.2 | 类型系统 |
| `@vitejs/plugin-react` | React Vite 插件 |
| `eslint` + 插件 | 代码检查 |

### 外部 API 服务

| 服务 | 基础 URL | 用途 |
|------|----------|------|
| MiniMax API | `https://api.minimaxi.com/v1` | 文本/图片/视频/语音/音乐/模型/文件 |
| MiniMax Anthropic 兼容端点 | `https://api.minimaxi.com/anthropic` | 文本生成 (Anthropic 协议) |
| FFmpeg WASM | 本地浏览器 | 视频后期处理 |
| Whisper | 本地/远程 | 语音转文字 |

---

## 3. 项目架构

本项目采用 **六边形架构 (Hexagonal Architecture / Ports & Adapters)** 模式，将业务逻辑与外部依赖彻底解耦：

```
┌─────────────────────────────────────────────────────────┐
│                      UI Layer (React)                    │
│   Pages / Components / Hooks / Contexts / Layouts       │
├─────────────────────────────────────────────────────────┤
│                  Dependency Injection                     │
│                  (dependencies.ts)                        │
├─────────────────────────────────────────────────────────┤
│                  Domain Services                         │
│  StoryService / VideoGenerationService / PipelineService │
│  VoiceService / MusicService / AgentService ...          │
├─────────────────────────────────────────────────────────┤
│                  Domain Ports (Interfaces)                │
│  IVideoGeneratorPort / IImageGeneratorPort / IVoicePort  │
│  IMusicPort / ITextGenerationPort / IFFmpegPort ...      │
├─────────────────────────────────────────────────────────┤
│                  Domain Entities                          │
│  Story / StorySegment / Character / Background / VideoTask│
├─────────────────────────────────────────────────────────┤
│                  Adapters (Implementations)               │
│  MiniMaxVideoAdapter / MiniMaxImageAdapter / ...          │
│  FFmpegAdapter / WhisperAdapter / IndexedDBAdapters       │
└─────────────────────────────────────────────────────────┘
```

### 架构原则

1. **依赖倒置**：领域服务仅依赖 Port 接口，不依赖具体适配器实现
2. **关注点分离**：UI → Domain → Adapters 三层清晰隔离
3. **可替换性**：任何适配器可被替换（如 Mock 适配器用于测试/降级）
4. **智能降级**：`smartTextSplitter` / `smartStoryBreakdown` 在 AI 不可用时自动降级到 Mock

---

## 4. 目录结构

```
src/
├── adapters/                    # 适配器层 — 外部系统实现
│   └── outbound/
│       ├── api/                 # 外部 API 适配器
│       │   ├── MiniMaxVideoAdapter.ts
│       │   ├── MiniMaxImageAdapter.ts
│       │   ├── MiniMaxVoiceAdapter.ts
│       │   ├── MiniMaxMusicAdapter.ts
│       │   ├── MiniMaxTextAdapter.ts
│       │   ├── MiniMaxTextSplitterAdapter.ts
│       │   ├── MiniMaxStoryBreakdownAdapter.ts
│       │   ├── MiniMaxModelAdapter.ts
│       │   ├── MiniMaxFileAdapter.ts
│       │   ├── MiniMaxErrorUtils.ts
│       │   ├── FFmpegAdapter.ts
│       │   ├── WhisperAdapter.ts
│       │   ├── MockTextSplitter.ts
│       │   └── MockStoryBreakdown.ts
│       ├── config/
│       │   └── ApiConfigStore.ts
│       └── repositories/
│           ├── DexieDatabase.ts
│           ├── IndexedDBAdapters.ts
│           └── AssetLibraryRepositories.ts
├── domain/                      # 领域层 — 核心业务逻辑
│   ├── data/
│   │   └── systemVoices.ts
│   ├── entities/
│   │   └── models.ts
│   ├── ports/
│   │   ├── OutboundPorts.ts
│   │   ├── AssetLibraryPorts.ts
│   │   └── PostProcessPorts.ts
│   └── services/
│       ├── AgentService.ts
│       ├── AssetLibraryService.ts
│       ├── AutoEditService.ts
│       ├── BGMRecommendationService.ts
│       ├── CinematographyService.ts
│       ├── FileManagementService.ts
│       ├── ImageGenerationService.ts
│       ├── ModelManagementService.ts
│       ├── MusicLabService.ts
│       ├── MusicService.ts
│       ├── PipelineService.ts
│       ├── PostProcessService.ts
│       ├── SnapshotService.ts
│       ├── StoryService.ts
│       ├── StorySpaceService.ts
│       ├── SubtitleService.ts
│       ├── TextGenerationService.ts
│       ├── TextLabService.ts
│       ├── VideoGenerationService.ts
│       ├── VideoLabService.ts
│       └── VoiceService.ts
├── ui/                          # UI 展示层
│   ├── components/              # 通用组件
│   ├── contexts/                # React Context
│   ├── hooks/                   # 自定义 Hooks
│   ├── layouts/                 # 布局组件
│   ├── pages/                   # 页面组件
│   └── utils/                   # UI 工具函数
├── utils/                       # 通用工具
│   ├── offlineCache.ts
│   ├── cacheMonitor.ts
│   └── retryUtils.ts
├── locales/                     # 国际化翻译文件
│   ├── en/ zh/ ja/ ko/ es/ fr/ de/ ru/ pt/ it/
├── assets/                      # 静态资源
├── App.tsx                      # 应用入口 & 路由定义
├── dependencies.ts              # 依赖注入容器
├── i18n.ts                      # 国际化配置
├── main.tsx                     # 渲染入口
└── index.css                    # 全局样式
```

---

## 5. 领域实体层 (Domain Entities)

文件：[models.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/entities/models.ts)

### 核心实体

| 实体 | 说明 | 关键字段 |
|------|------|----------|
| `StorySpace` | 创作空间，隔离不同项目的数据 | `id`, `name`, `description` |
| `Character` | 角色，属于某个空间 | `id`, `spaceId`, `name`, `appearancePrompt`, `personalityPrompt`, `referenceImageUrl?`, `voiceId?` |
| `Background` | 场景背景，属于某个空间 | `id`, `spaceId`, `name`, `environmentPrompt`, `referenceImageUrl?` |
| `Story` | 故事，属于某个空间 | `id`, `spaceId`, `title`, `originalText`, `status` (DRAFT/SPLIT) |
| `StorySegment` | 故事分镜段 | `id`, `storyId`, `sequenceOrder`, `content`, `mentionedCharacters[]`, `selectedBackgroundId?`, `bgmAudioUrl?`, `firstFrameImage?` |
| `VideoTask` | 视频生成任务 | `id`, `segmentId`, `status` (PENDING/PROCESSING/SUCCESS/FAILED), `externalTaskId`, `mode`, `model`, `resolution`, `duration` |
| `PipelineTask` | 管线任务 | `id`, `storyId`, `status`, `progress`, `steps[]`, `finalVideoUrl?` |
| `PipelineStep` | 管线步骤 | `name`, `status` (pending/running/done/failed), `error?` |
| `FinalCut` | 最终成片 | `id`, `storyId`, `videoBlob`, `thumbnailUrl?`, `duration`, `hasSubtitles`, `srtContent?` |

### 素材库实体 (v8)

| 实体 | 说明 | 关键字段 |
|------|------|----------|
| `SavedImage` | 已保存图片 | `id`, `spaceId`, `prompt`, `model`, `blobKey`, `sourceType` (lab/pipeline/character/background) |
| `SavedVoice` | 已保存音色 | `id`, `spaceId`, `voiceId`, `audioBlobKey`, `sourceType` (lab/clone/pipeline) |
| `SavedPrompt` | 已保存提示词 | `id`, `spaceId`, `content`, `category` (image/voice/story/scene/narration/other) |

### 关键枚举/类型

| 类型 | 值 |
|------|-----|
| `StoryStatus` | `'DRAFT'` \| `'SPLIT'` |
| `VideoTaskStatus` | `'PENDING'` \| `'PROCESSING'` \| `'SUCCESS'` \| `'FAILED'` |
| `VideoModel` | `'MiniMax-Hailuo-2.3'` \| `'MiniMax-Hailuo-02'` \| `'T2V-01-Director'` \| `'T2V-01'` \| `'S2V-01'` |
| `VideoResolution` | `'720P'` \| `'768P'` \| `'1080P'` |
| `VideoGenerationMode` | `'t2v'` \| `'i2v'` \| `'fl2v'` \| `'s2v'` |
| `PipelineStatus` | `'idle'` \| `'splitting'` \| `'generating_images'` \| `'generating_audio'` \| `'generating_bgm'` \| `'generating_videos'` \| `'post_processing'` \| `'generating_srt'` \| `'burning_subtitles'` \| `'complete'` \| `'failed'` |

---

## 6. 端口接口层 (Domain Ports)

### OutboundPorts.ts

文件：[OutboundPorts.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/ports/OutboundPorts.ts)

定义了所有出站端口接口，是领域层与外部系统交互的契约：

#### 仓储接口 (Repository Ports)

| 接口 | 方法 | 说明 |
|------|------|------|
| `IStorySpaceRepository` | `save`, `findById`, `findAll`, `delete` | 创作空间 CRUD |
| `ICharacterRepository` | `save`, `findById`, `findAll`, `findBySpaceId`, `delete` | 角色 CRUD |
| `IBackgroundRepository` | `save`, `findById`, `findAll`, `findBySpaceId`, `delete` | 背景 CRUD |
| `IStoryRepository` | `save`, `findById`, `findAll`, `findBySpaceId`, `delete` | 故事 CRUD |
| `IStorySegmentRepository` | `save`, `findById`, `findByStoryId`, `deleteByStoryId` | 分镜 CRUD |
| `IVideoTaskRepository` | `save`, `findBySegmentId`, `findLatestBySegmentId`, `findByStatuses`, `updateStatus`, `deleteBySegmentIds` | 视频任务管理 |
| `IFinalCutRepository` | `save`, `findById`, `findByStoryIds`, `delete` | 成片管理 |

#### 外部服务接口 (API Ports)

| 接口 | 关键方法 | 说明 |
|------|----------|------|
| `IVideoGeneratorPort` | `submitVideoTask`, `queryTaskStatus`, `downloadVideo`, `createAgentTask`, `queryAgentTask` | 视频生成 |
| `IImageGeneratorPort` | `generateImage` | 图片生成 |
| `IVoicePort` | `uploadFile`, `cloneVoice`, `createT2ATask`, `queryT2ATask`, `synthesizeSpeechSync`, `synthesizeSpeechStream`, `designVoice`, `getAvailableVoices`, `deleteVoice`, `fetchAudioAsBlobUrl` | 语音合成 |
| `IMusicPort` | `generateMusic`, `generateLyrics`, `preprocessCover` | 音乐生成 |
| `ITextGenerationPort` | `chatCompletion`, `chatCompletionStream` | 文本生成 |
| `IModelManagementPort` | `listModels`, `retrieveModel` | 模型管理 |
| `IFileManagementPort` | `listFiles`, `deleteFile` | 文件管理 |
| `ITextSplitterPort` | `splitStoryToSegments` | 故事拆分 |
| `IStoryBreakdownPort` | `breakdownStory` | 一键分解 |

### PostProcessPorts.ts

文件：[PostProcessPorts.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/ports/PostProcessPorts.ts)

| 接口 | 关键方法 | 说明 |
|------|----------|------|
| `IFFmpegPort` | `load`, `merge`, `concat`, `burnSubtitles`, `mixAudio`, `applyTransition`, `compress`, `convertFormat`, `changeSpeed`, `trim`, `crop`, `resize`, `extractFrame`, `reverse`, `fadeInOut` | FFmpeg 后期处理 |
| `IWhisperPort` | `load`, `transcribe` | 语音转文字 |

### AssetLibraryPorts.ts

文件：[AssetLibraryPorts.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/ports/AssetLibraryPorts.ts)

| 接口 | 方法 | 说明 |
|------|------|------|
| `ISavedImageRepository` | `save`, `getById`, `query`, `delete`, `count` | 图片素材库 |
| `ISavedVoiceRepository` | `save`, `getById`, `query`, `delete`, `count` | 音色素材库 |
| `ISavedPromptRepository` | `save`, `getById`, `query`, `delete`, `count` | 提示词素材库 |

---

## 7. 领域服务层 (Domain Services)

### 7.1 创作域服务

#### StoryService

文件：[StoryService.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/services/StoryService.ts)

**依赖**：`IStoryRepository`, `IStorySegmentRepository`, `ICharacterRepository`, `IBackgroundRepository`, `ITextSplitterPort`, `IStoryBreakdownPort`, `IVideoTaskRepository`

| 方法 | 签名 | 说明 |
|------|------|------|
| `createStory` | `(title, originalText, spaceId) => Promise<Story>` | 创建故事 |
| `updateStory` | `(storyId, title, originalText) => Promise<void>` | 更新故事（内容变更时重置为 DRAFT） |
| `splitStory` | `(storyId) => Promise<StorySegment[]>` | AI 拆分故事为分镜 |
| `previewBreakdown` | `(storyId) => Promise<StoryBreakdownResult>` | 预览一键分解结果（不保存） |
| `applyBreakdown` | `(storyId, characters, backgrounds, segments) => Promise<{savedCharacterIds, savedBackgroundIds}>` | 应用一键分解（保存角色/背景/分镜，同名去重） |
| `getSegments` | `(storyId) => Promise<StorySegment[]>` | 获取故事分镜（按序排列） |
| `updateSegmentBackground` | `(segmentId, backgroundId) => Promise<void>` | 更新分镜背景 |
| `removeCharacterFromSegments` | `(characterId) => Promise<void>` | 从所有分镜中移除角色引用 |
| `removeBackgroundFromSegments` | `(backgroundId) => Promise<void>` | 从所有分镜中移除背景引用 |
| `deleteStory` | `(storyId) => Promise<void>` | 删除故事及其分镜和视频任务 |
| `getAllStories` | `() => Promise<Story[]>` | 获取所有故事 |

#### ImageGenerationService

文件：[ImageGenerationService.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/services/ImageGenerationService.ts)

**依赖**：`IImageGeneratorPort`, `ICharacterRepository`, `IBackgroundRepository`

| 方法 | 说明 |
|------|------|
| `generateCharacterImage` | 根据角色外貌描述生成角色图片 |
| `generateBackgroundImage` | 根据场景环境描述生成背景图片 |

#### TextGenerationService

文件：[TextGenerationService.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/services/TextGenerationService.ts)

**依赖**：`ITextGenerationPort`

| 方法 | 说明 |
|------|------|
| `generate` | 通用文本生成 |

#### TextLabService

文件：[TextLabService.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/services/TextLabService.ts)

**依赖**：`ITextGenerationPort`

| 方法 | 说明 |
|------|------|
| `enhanceText` | 文本增强与润色 |
| `annotateText` | 文本标注 |

### 7.2 视音频域服务

#### VideoGenerationService

文件：[VideoGenerationService.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/services/VideoGenerationService.ts)

**依赖**：`IVideoTaskRepository`, `IStorySegmentRepository`, `ICharacterRepository`, `IBackgroundRepository`, `IVideoGeneratorPort`

| 方法 | 签名 | 说明 |
|------|------|------|
| `generateVideo` | `(segmentId, storyId, targetPlatform?, options?) => Promise<VideoTask>` | 提交视频生成任务，自动构建 Prompt 上下文 |
| `getLatestTaskForSegment` | `(segmentId) => Promise<VideoTask \| null>` | 获取分镜最新视频任务 |
| `resumeActivePolling` | `() => Promise<void>` | 页面重载后恢复活跃任务的轮询 |
| `cancelAllPolling` | `() => void` | 取消所有轮询（应用卸载时调用） |

**内部机制**：
- 提交任务后异步轮询状态（3s 间隔，最多 60 次）
- 支持 T2V / I2V / FL2V / S2V 四种模式
- 自动根据角色/背景构建视频 Prompt

#### VideoLabService

文件：[VideoLabService.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/services/VideoLabService.ts)

**依赖**：`IVideoGeneratorPort`

| 方法 | 说明 |
|------|------|
| `generateVideo` | 实验室模式视频生成 |
| `queryTaskStatus` | 查询视频任务状态 |

#### VoiceService

文件：[VoiceService.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/services/VoiceService.ts)

**依赖**：`IVoicePort`, `ICharacterRepository`

| 方法 | 说明 |
|------|------|
| `generateNarration` | 根据角色音色生成旁白 |
| `cloneVoice` | 语音克隆 |
| `synthesizeSpeech` | 语音合成 |

#### MusicService

文件：[MusicService.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/services/MusicService.ts)

**依赖**：`IMusicPort`, `IStorySegmentRepository`

| 方法 | 说明 |
|------|------|
| `generateBGM` | 为分镜生成背景音乐 |
| `generateLyrics` | AI 歌词创作 |
| `generateCoverMusic` | 翻唱音乐生成 |

#### MusicLabService

文件：[MusicLabService.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/services/MusicLabService.ts)

**依赖**：`IMusicPort`

| 方法 | 说明 |
|------|------|
| `generateMusic` | 实验室模式音乐生成 |
| `parseAudioUrl` | 解析音频 URL |

### 7.3 后期处理服务

#### PostProcessService

文件：[PostProcessService.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/services/PostProcessService.ts)

**依赖**：`IFFmpegPort`, `IWhisperPort`

| 方法 | 说明 |
|------|------|
| `ensureLoaded` | 加载 FFmpeg WASM |
| `isFFmpegLoaded` | 检查 FFmpeg 是否已加载 |
| `mergeVideoAudio` | 合并视频与音频 |
| `concatClips` | 拼接多个视频片段 |
| `burnSubtitles` | 烧录字幕 |
| `mixAudio` | 混合音轨 |

#### SubtitleService

文件：[SubtitleService.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/services/SubtitleService.ts)

**依赖**：`IWhisperPort`, `ITextGenerationPort`

| 方法 | 说明 |
|------|------|
| `generateSrtFromSegments` | 从分镜生成 SRT 字幕 |
| `transcribeAudio` | 语音转文字 |

### 7.4 管线服务 (Pipeline)

#### PipelineService

文件：[PipelineService.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/services/PipelineService.ts)

**依赖**：`IStoryRepository`, `IStorySegmentRepository`, `ICharacterRepository`, `IBackgroundRepository`, `IVideoTaskRepository`, `IFinalCutRepository`, `ITextGenerationPort`, `IImageGeneratorPort`, `IVideoGeneratorPort`, `IVoicePort`, `IMusicPort`, `PostProcessService`, `SubtitleService`

这是最核心的编排服务，实现一键成片的全流程：

| 方法 | 签名 | 说明 |
|------|------|------|
| `createTask` | `(storyId) => PipelineTask` | 创建管线任务 |
| `subscribe` | `(taskId, callback) => unsubscribe` | 订阅任务状态变更 |
| `getTask` | `(taskId) => PipelineTask \| null` | 获取任务 |
| `listTasks` | `() => PipelineTask[]` | 列出所有任务 |
| `runFullPipeline` | `(storyId, options?) => Promise<PipelineTask>` | 执行完整管线 |
| `assembleFinalVideo` | `(storyId, narrationUrls, onProgress?) => Promise<FinalCut>` | 合成最终视频 |
| `cancelTask` | `(taskId) => void` | 取消任务 |
| `markComplete` | `(taskId, finalVideoUrl) => void` | 标记完成 |
| `markFailed` | `(taskId, error) => void` | 标记失败 |

**Pipeline 阶段流程**：

```
splitting → generating_images → generating_audio → generating_bgm
→ generating_videos → post_processing → generating_srt → burning_subtitles → complete
```

### 7.5 AI 增强服务

#### AgentService

文件：[AgentService.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/services/AgentService.ts)

**依赖**：`ITextGenerationPort`

| 方法 | 签名 | 说明 |
|------|------|------|
| `chat` | `(messages: AgentMessage[]) => Promise<string>` | AI 助手对话 |
| `suggestActionPlan` | `(userMessage) => Promise<string[]>` | 根据用户意图推荐工具调用序列 |

内置系统提示词定义了 13 种工具能力（创建角色/背景、拆分故事、生成视频提示词、推荐 BGM 等）。

#### CinematographyService

文件：[CinematographyService.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/services/CinematographyService.ts)

**依赖**：`ITextGenerationPort`

| 方法 | 说明 |
|------|------|
| `suggestShots` | AI 镜头建议 |
| `planStoryboard` | 故事板规划 |

#### BGMRecommendationService

文件：[BGMRecommendationService.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/services/BGMRecommendationService.ts)

**依赖**：`ITextGenerationPort`

| 方法 | 说明 |
|------|------|
| `recommendBGM` | AI 背景音乐推荐 |
| `buildBGMPrompt` | 构建 BGM 提示词 |

#### AutoEditService

文件：[AutoEditService.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/services/AutoEditService.ts)

**依赖**：`IFFmpegPort`

| 方法 | 说明 |
|------|------|
| `detectKeyFrames` | 视频关键帧检测 |
| `suggestEdits` | 剪辑建议 |
| `autoEdit` | 自动剪辑 |

### 7.6 管理服务

#### StorySpaceService

文件：[StorySpaceService.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/services/StorySpaceService.ts)

**依赖**：`IStorySpaceRepository`, `ICharacterRepository`, `IBackgroundRepository`, `IStoryRepository`, `IStorySegmentRepository`, `IVideoTaskRepository`

| 方法 | 说明 |
|------|------|
| `createSpace` | 创建空间 |
| `deleteSpace` | 删除空间（级联删除所有关联数据） |
| `listSpaces` | 列出所有空间 |

#### ModelManagementService

文件：[ModelManagementService.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/services/ModelManagementService.ts)

**依赖**：`IModelManagementPort`

| 方法 | 说明 |
|------|------|
| `getModels` | 获取模型列表（带缓存） |
| `getModelInfo` | 获取模型详情 |

#### FileManagementService

文件：[FileManagementService.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/services/FileManagementService.ts)

**依赖**：`IFileManagementPort`

| 方法 | 说明 |
|------|------|
| `listFiles` | 列出文件 |
| `deleteFile` | 删除文件 |

#### AssetLibraryService

文件：[AssetLibraryService.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/services/AssetLibraryService.ts)

**依赖**：`ISavedImageRepository`, `ISavedVoiceRepository`, `ISavedPromptRepository`

| 方法 | 说明 |
|------|------|
| `saveImage` / `queryImages` / `deleteImage` | 图片素材管理 |
| `saveVoice` / `queryVoices` / `deleteVoice` | 音色素材管理 |
| `savePrompt` / `queryPrompts` / `deletePrompt` | 提示词素材管理 |

#### SnapshotService

文件：[SnapshotService.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/services/SnapshotService.ts)

**依赖**：`IStorySegmentRepository`

| 方法 | 说明 |
|------|------|
| `createSnapshot` | 创建分镜快照 |
| `restoreSnapshot` | 恢复快照 |

---

## 8. 适配器层 (Adapters)

### 8.1 外部 API 适配器

| 适配器 | 实现接口 | API 端点 | 说明 |
|--------|----------|----------|------|
| `MiniMaxVideoAdapter` | `IVideoGeneratorPort` | `/v1/video_generation` | 视频生成（提交/查询/下载/Agent 任务） |
| `MiniMaxImageAdapter` | `IImageGeneratorPort` | `/v1/images/generations` | 图片生成 |
| `MiniMaxVoiceAdapter` | `IVoicePort` | `/v1/audio/speech`, `/v1/t2a_*`, `/v1/voice_clone/*` | 语音合成/克隆/设计 |
| `MiniMaxMusicAdapter` | `IMusicPort` | `/v1/music_generation`, `/v1/lyrics_generation` | 音乐/歌词生成 |
| `MiniMaxTextAdapter` | `ITextGenerationPort` | `/v1/chat/completions` | 文本生成（同步/流式） |
| `MiniMaxTextSplitterAdapter` | `ITextSplitterPort` | 通过 `ITextGenerationPort` 实现 | AI 故事拆分（智能降级） |
| `MiniMaxStoryBreakdownAdapter` | `IStoryBreakdownPort` | 通过 `ITextGenerationPort` 实现 | AI 一键分解（智能降级） |
| `MiniMaxModelAdapter` | `IModelManagementPort` | `/v1/models` | 模型列表/详情 |
| `MiniMaxFileAdapter` | `IFileManagementPort` | `/v1/files` | 文件管理 |
| `FFmpegAdapter` | `IFFmpegPort` | 本地 WASM | 浏览器端视频处理 |
| `WhisperAdapter` | `IWhisperPort` | 本地/远程 | 语音识别 |

### 8.2 Mock / 降级适配器

| 适配器 | 实现接口 | 说明 |
|--------|----------|------|
| `MockTextSplitter` | `ITextSplitterPort` | 按段落简单拆分，不调用 AI |
| `MockStoryBreakdown` | `IStoryBreakdownPort` | 返回空角色/背景，简单按段落拆分 |

**智能降级机制**：`smartTextSplitter` 和 `smartStoryBreakdown` 优先使用 AI 适配器，失败时自动降级到 Mock 适配器。

### 8.3 仓储适配器

| 适配器 | 实现接口 | 存储后端 |
|--------|----------|----------|
| `StorySpaceRepositoryAdapter` | `IStorySpaceRepository` | IndexedDB (Dexie) |
| `CharacterRepositoryAdapter` | `ICharacterRepository` | IndexedDB (Dexie) |
| `BackgroundRepositoryAdapter` | `IBackgroundRepository` | IndexedDB (Dexie) |
| `StoryRepositoryAdapter` | `IStoryRepository` | IndexedDB (Dexie) |
| `StorySegmentRepositoryAdapter` | `IStorySegmentRepository` | IndexedDB (Dexie) |
| `VideoTaskRepositoryAdapter` | `IVideoTaskRepository` | IndexedDB (Dexie) |
| `FinalCutRepositoryAdapter` | `IFinalCutRepository` | IndexedDB (Dexie) |
| `SavedImageRepository` | `ISavedImageRepository` | IndexedDB (Dexie) |
| `SavedVoiceRepository` | `ISavedVoiceRepository` | IndexedDB (Dexie) |
| `SavedPromptRepository` | `ISavedPromptRepository` | IndexedDB (Dexie) |

### 8.4 配置管理

#### ApiConfigStore

文件：[ApiConfigStore.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/adapters/outbound/config/ApiConfigStore.ts)

基于 `localStorage` 的 API 配置管理：

```typescript
interface ApiConfig {
  minimaxApiKey: string;           // MiniMax API Key
  minimaxGroupId: string;          // MiniMax Group ID
  minimaxBaseUrl: string;          // 默认: https://api.minimaxi.com/v1
  minimaxAnthropicBaseUrl: string; // 开发环境: /anthropic (Vite 代理)
}
```

| 方法 | 说明 |
|------|------|
| `load()` | 加载配置 |
| `save(config)` | 保存配置 |
| `get(key)` | 获取单个配置项 |

---

## 9. 依赖注入容器 (Dependencies)

文件：[dependencies.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/dependencies.ts)

这是整个应用的组装层，负责实例化所有适配器和服务，并注入依赖关系：

```
┌─ 仓储实例 ─────────────────────────────────────────┐
│ spaceRepo / characterRepo / storyRepo / segmentRepo │
│ backgroundRepo / videoTaskRepo / finalCutRepo       │
├─ 基础设施实例 ──────────────────────────────────────┤
│ videoAdapter / imageAdapter / voiceAdapter           │
│ musicAdapter / textAdapter / modelAdapter            │
│ fileAdapter / ffmpegAdapter / whisperAdapter         │
├─ 智能降级实例 ──────────────────────────────────────┤
│ mockTextSplitter / mockStoryBreakdown                │
│ smartTextSplitter = MiniMax + Mock 降级              │
│ smartStoryBreakdown = MiniMax + Mock 降级            │
├─ 创作域服务 ────────────────────────────────────────┤
│ storyService / imageGenerationService                │
│ textGenerationService / textLabService               │
├─ 视音频域服务 ──────────────────────────────────────┤
│ videoGenerationService / videoLabService             │
│ voiceService / musicService / musicLabService        │
│ postProcessService / subtitleService                 │
├─ 管线服务 ──────────────────────────────────────────┤
│ pipelineService                                      │
├─ 空间管理 ──────────────────────────────────────────┤
│ storySpaceService                                    │
├─ 模型/文件管理 ─────────────────────────────────────┤
│ modelManagementService / fileManagementService       │
├─ AI 增强服务 ───────────────────────────────────────┤
│ agentService / autoEditService                       │
│ cinematographyService / bgmRecommendationService     │
├─ 素材库 ────────────────────────────────────────────┤
│ savedImageRepo / savedVoiceRepo / savedPromptRepo    │
│ assetLibraryService                                  │
└──────────────────────────────────────────────────────┘
```

---

## 10. UI 层 (Presentation)

### 10.1 布局

#### MainLayout

文件：[MainLayout.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/layouts/MainLayout.tsx)

主布局组件，包含：
- **可折叠侧边栏**：Logo、空间切换器、创作流程指示器、导航分组
- **导航分组**：总览、创作、AI 实验室、管理
- **创作流程指示器**：角色 → 场景 → 生成 → 导出
- **语言切换器**：底部语言切换
- **主内容区**：`<Outlet />` 渲染子路由

### 10.2 React Contexts

| Context | 文件 | 说明 |
|---------|------|------|
| `SpaceContext` | [SpaceContext.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/contexts/SpaceContext.tsx) | 当前创作空间状态，提供 `currentSpaceId` / `setCurrentSpaceId` |
| `ToastContext` | [ToastContext.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/contexts/ToastContext.tsx) | 全局消息提示，提供 `showToast(type, message)` |
| `ConfirmContext` | [ConfirmContext.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/contexts/ConfirmContext.tsx) | 确认对话框，提供 `confirm(message)` |

### 10.3 自定义 Hooks

| Hook | 文件 | 说明 |
|------|------|------|
| `useWorkbenchState` | [useWorkbenchState.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/hooks/useWorkbenchState.ts) | 工作台全局状态管理 |
| `useSpaceScopedQuery` | [useSpaceScopedQuery.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/hooks/useSpaceScopedQuery.ts) | 空间作用域数据查询 |
| `useVideoTaskPolling` | [useVideoTaskPolling.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/hooks/useVideoTaskPolling.ts) | 视频任务轮询 |
| `usePolling` | [usePolling.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/hooks/usePolling.ts) | 通用轮询 Hook |
| `useSavedAssets` | [useSavedAssets.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/hooks/useSavedAssets.ts) | 已保存素材查询 |
| `useAssetPicker` | [useAssetPicker.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/hooks/useAssetPicker.ts) | 素材选择器 |
| `useNetworkStatus` | [useNetworkStatus.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/hooks/useNetworkStatus.ts) | 网络状态检测 |
| `useSharedForm` | [useSharedForm.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/hooks/useSharedForm.ts) | 共享表单状态 |
| `useStreamingAudioPlayer` | [useStreamingAudioPlayer.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/hooks/useStreamingAudioPlayer.ts) | 流式音频播放 |

### 10.4 通用组件

| 组件 | 文件 | 说明 |
|------|------|------|
| `AgentChatPanel` | [AgentChatPanel.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/components/AgentChatPanel.tsx) | AI 助手对话面板，支持流式响应 |
| `PipelinePanel` | [PipelinePanel.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/components/PipelinePanel.tsx) | 管线流程面板，展示各阶段进度 |
| `StoryListPanel` | [StoryListPanel.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/components/StoryListPanel.tsx) | 故事列表面板 |
| `SegmentCard` | [SegmentCard.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/components/SegmentCard.tsx) | 分镜卡片，展示分镜元数据和预览 |
| `TimelineEditor` | [TimelineEditor.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/components/TimelineEditor.tsx) | 时间轴编辑器，拖拽编排视频剪辑 |
| `VideoTaskCard` | [VideoTaskCard.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/components/VideoTaskCard.tsx) | 视频任务卡片 |
| `VideoCompare` | [VideoCompare.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/components/VideoCompare.tsx) | 视频对比组件 |
| `BGMPanel` | [BGMPanel.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/components/BGMPanel.tsx) | BGM 选择面板 |
| `BreakdownPreview` | [BreakdownPreview.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/components/BreakdownPreview.tsx) | 一键分解预览 |
| `CameraDirectivePanel` | [CameraDirectivePanel.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/components/CameraDirectivePanel.tsx) | 镜头指令面板 |
| `PostProductionPanel` | [PostProductionPanel.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/components/PostProductionPanel.tsx) | 后期制作面板 |
| `ImageGallery` | [ImageGallery.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/components/ImageGallery.tsx) | 图片画廊 |
| `ImageUploadField` | [ImageUploadField.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/components/ImageUploadField.tsx) | 图片上传字段 |
| `ImageAdvancedSettings` | [ImageAdvancedSettings.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/components/ImageAdvancedSettings.tsx) | 图片高级设置 |
| `AudioPreviewPlayer` | [AudioPreviewPlayer.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/components/AudioPreviewPlayer.tsx) | 音频预览播放器 |
| `AudioUploadField` | [AudioUploadField.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/components/AudioUploadField.tsx) | 音频上传字段 |
| `LyricsDisplay` | [LyricsDisplay.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/components/LyricsDisplay.tsx) | 歌词展示 |
| `AssetPicker` | [AssetPicker.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/components/AssetPicker.tsx) | 素材选择器 |
| `ThinkingBlock` | [ThinkingBlock.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/components/ThinkingBlock.tsx) | AI 思考过程展示 |
| `TokenUsageBar` | [TokenUsageBar.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/components/TokenUsageBar.tsx) | Token 用量展示 |
| `NetworkStatus` | [NetworkStatus.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/components/NetworkStatus.tsx) | 网络状态指示器 |
| `LanguageSwitcher` | [LanguageSwitcher.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/components/LanguageSwitcher.tsx) | 语言切换器 |
| `ErrorBoundary` | [ErrorBoundary.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/components/ErrorBoundary.tsx) | 错误边界 |

---

## 11. 路由与页面

文件：[App.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/App.tsx)

### 路由表

| 路径 | 页面组件 | 导航分组 | 说明 |
|------|----------|----------|------|
| `/` | `Dashboard` | 总览 | 仪表盘，项目概览 |
| `/characters` | `CharacterManagement` | 创作 | 角色管理 |
| `/backgrounds` | `BackgroundManagement` | 创作 | 场景背景管理 |
| `/workbench` | `StoryWorkbench` | 创作 | 故事工作台（核心编辑入口） |
| `/export` | `ExportCenter` | 创作 | 导出中心 |
| `/labs/image` | `ImageLab` | AI 实验室 | 图片生成实验室 |
| `/labs/video` | `VideoLab` | AI 实验室 | 视频生成实验室 |
| `/labs/voice` | `VoiceLab` | AI 实验室 | 音色与配音实验室 |
| `/labs/music` | `MusicLab` | AI 实验室 | 音乐生成实验室 |
| `/labs/text` | `TextLab` | AI 实验室 | 文本润色实验室 |
| `/spaces` | `StorySpaceManagement` | 管理 | 空间管理 |
| `/settings` | `Settings` | 管理 | 设置（API Key 配置等） |

### 页面说明

| 页面 | 文件 | 核心功能 |
|------|------|----------|
| `Dashboard` | [Dashboard.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/pages/Dashboard.tsx) | 项目概览、统计数据、快速入口 |
| `CharacterManagement` | [CharacterManagement.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/pages/CharacterManagement.tsx) | 角色创建/编辑/删除、外貌/性格描述、参考图、音色绑定 |
| `BackgroundManagement` | [BackgroundManagement.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/pages/BackgroundManagement.tsx) | 场景创建/编辑/删除、环境描述、参考图 |
| `StoryWorkbench` | [StoryWorkbench.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/pages/StoryWorkbench.tsx) | 故事输入、AI 拆分/分解、分镜编辑、视频生成、管线编排 |
| `ExportCenter` | [ExportCenter.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/pages/ExportCenter.tsx) | 成片列表、下载、预览 |
| `ImageLab` | [ImageLab.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/pages/ImageLab.tsx) | 独立图片生成、高级参数设置 |
| `VideoLab` | [VideoLab.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/pages/VideoLab.tsx) | 独立视频生成、多模式选择 |
| `VoiceLab` | [VoiceLab.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/pages/VoiceLab.tsx) | 语音克隆/设计/合成、流式播放 |
| `MusicLab` | [MusicLab.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/pages/MusicLab.tsx) | 音乐生成、歌词创作、翻唱 |
| `TextLab` | [TextLab.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/pages/TextLab.tsx) | 文本润色/增强 |
| `StorySpaceManagement` | [StorySpaceManagement.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/pages/StorySpaceManagement.tsx) | 空间创建/切换/删除 |
| `Settings` | [Settings.tsx](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/pages/Settings.tsx) | API Key / Group ID 配置 |

---

## 12. 国际化 (i18n)

文件：[i18n.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/i18n.ts)

### 支持语言

| 代码 | 语言 | 原生名称 |
|------|------|----------|
| `en` | English | English |
| `zh` | Chinese (Simplified) | 简体中文 |
| `ja` | Japanese | 日本語 |
| `ko` | Korean | 한국어 |
| `es` | Spanish | Español |
| `fr` | French | Français |
| `de` | German | Deutsch |
| `ru` | Russian | Русский |
| `pt` | Portuguese | Português |
| `it` | Italian | Italiano |

### 配置

- **回退语言**：`en`
- **语言检测顺序**：`localStorage` → `navigator` → `htmlTag`
- **缓存**：`localStorage` (key: `i18nextLng`)
- **翻译文件**：`src/locales/{lang}/translation.json`

---

## 13. 数据持久化 (IndexedDB)

文件：[DexieDatabase.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/adapters/outbound/repositories/DexieDatabase.ts)

### 数据库：`AiVideoDatabase`

基于 [Dexie.js](https://dexie.org/) 的 IndexedDB ORM，当前版本 **v8**。

### 表结构与索引

| 表名 | 索引字段 | 版本 |
|------|----------|------|
| `storySpaces` | `id`, `name`, `createdAt` | v3 |
| `characters` | `id`, `spaceId`, `name`, `createdAt` | v3 |
| `backgrounds` | `id`, `spaceId`, `name`, `createdAt` | v3 |
| `stories` | `id`, `spaceId`, `status`, `createdAt` | v3 |
| `segments` | `id`, `storyId`, `sequenceOrder` | v1 |
| `videoTasks` | `id`, `segmentId`, `status`, `createdAt` | v1 |
| `pipelineTasks` | `id`, `storyId`, `status`, `createdAt` | v7 |
| `finalCuts` | `id`, `storyId`, `pipelineTaskId`, `createdAt` | v7 |
| `savedImages` | `id`, `spaceId`, `name`, `sourceType`, `createdAt` | v8 |
| `savedVoices` | `id`, `spaceId`, `name`, `sourceType`, `createdAt` | v8 |
| `savedPrompts` | `id`, `spaceId`, `name`, `category`, `createdAt` | v8 |

### 版本迁移历史

| 版本 | 变更 |
|------|------|
| v1 | 初始表结构 |
| v2 | 为 Character 添加 `characterBackground` 字段 |
| v3 | 新增 `storySpaces` 表，所有实体添加 `spaceId`，创建默认空间并迁移数据 |
| v4 | 为 Character 添加 `voiceId` 字段 |
| v5 | 为 Segment 添加 BGM 相关字段 |
| v6 | 为 VideoTask 添加 mode/model/resolution/duration 字段 |
| v7 | 新增 `pipelineTasks` 和 `finalCuts` 表 |
| v8 | 新增 `savedImages`、`savedVoices`、`savedPrompts` 素材库表 |

---

## 14. 工具与基础设施

### 通用工具 (src/utils/)

| 文件 | 说明 |
|------|------|
| [offlineCache.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/utils/offlineCache.ts) | 离线缓存管理，支持网络不佳时的数据缓存与恢复 |
| [cacheMonitor.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/utils/cacheMonitor.ts) | 缓存命中率统计与状态监控 |
| [retryUtils.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/utils/retryUtils.ts) | 可配置重试机制（次数/延迟策略） |

### UI 工具 (src/ui/utils/)

| 文件 | 说明 |
|------|------|
| [errorUtils.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/utils/errorUtils.ts) | 错误信息提取与格式化 |
| [imageUtils.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/ui/utils/imageUtils.ts) | 图片处理工具（压缩/裁剪/格式转换） |

### 静态数据

| 文件 | 说明 |
|------|------|
| [systemVoices.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/src/domain/data/systemVoices.ts) | 系统内置音色列表数据 |

---

## 15. 核心业务流程

### 15.1 一键成片流程 (Pipeline)

```
用户输入故事文本
       │
       ▼
  ┌─────────┐    AI 拆分    ┌──────────────┐
  │  Story   │ ──────────► │ StorySegments │
  │ (DRAFT)  │             │   (SPLIT)     │
  └─────────┘              └──────┬───────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
             ┌──────────┐ ┌──────────┐ ┌──────────┐
             │ 生成图片  │ │ 生成旁白  │ │ 生成 BGM  │
             │(Image API)│ │(Voice API)│ │(Music API)│
             └────┬─────┘ └────┬─────┘ └────┬─────┘
                  │            │             │
                  └─────────────┼─────────────┘
                                ▼
                        ┌──────────────┐
                        │  生成视频     │
                        │ (Video API)  │
                        │ T2V/I2V/S2V  │
                        └──────┬───────┘
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
             ┌──────────┐ ┌────────┐ ┌──────────┐
             │后期合成   │ │字幕生成 │ │字幕烧录  │
             │(FFmpeg)  │ │(Whisper)│ │(FFmpeg)  │
             └────┬─────┘ └───┬────┘ └────┬─────┘
                  │           │           │
                  └───────────┼───────────┘
                              ▼
                      ┌──────────────┐
                      │  FinalCut    │
                      │  (成片导出)   │
                      └──────────────┘
```

### 15.2 视频生成模式

| 模式 | 说明 | 输入 |
|------|------|------|
| `t2v` | 文本生成视频 | 文本 Prompt |
| `i2v` | 图片生成视频 | 首帧图片 + Prompt |
| `fl2v` | 首尾帧生成视频 | 首帧图片 + 尾帧图片 + Prompt |
| `s2v` | 主体参考生成视频 | 角色参考图 + Prompt |

### 15.3 依赖关系图

```
PipelineService
├── StoryRepository ─────────► 加载故事
├── StorySegmentRepository ──► 加载/保存分镜
├── CharacterRepository ─────► 查找角色
├── BackgroundRepository ────► 查找背景
├── VideoTaskRepository ─────► 保存视频任务
├── FinalCutRepository ──────► 保存成片
├── ITextGenerationPort ─────► 文本生成
├── IImageGeneratorPort ─────► 图片生成
├── IVideoGeneratorPort ─────► 视频生成
├── IVoicePort ──────────────► 语音合成
├── IMusicPort ──────────────► 音乐生成
├── PostProcessService ──────► FFmpeg 后期
│   ├── IFFmpegPort
│   └── IWhisperPort
└── SubtitleService ─────────► 字幕生成
    ├── IWhisperPort
    └── ITextGenerationPort
```

---

## 16. 项目运行方式

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装与启动

```bash
# 安装依赖
npm install

# 开发模式启动
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 代码检查
npm run lint
```

### 开发环境配置

1. 启动开发服务器后，访问 `http://localhost:5173`
2. 进入 **设置页面** (`/settings`) 配置：
   - MiniMax API Key
   - MiniMax Group ID
3. Vite 开发服务器自动代理 `/anthropic` 路径到 `https://api.minimaxi.com/anthropic`，解决 CORS 问题

### Vite 代理配置

文件：[vite.config.ts](file:///Users/ak47wyh/Downloads/work/kt_project/ai-vido-web/vite.config.ts)

```typescript
server: {
  proxy: {
    '/anthropic': {
      target: 'https://api.minimaxi.com',
      changeOrigin: true,
      secure: true,
    },
  },
}
```

### 生产环境

生产环境下 `minimaxAnthropicBaseUrl` 直接指向 `https://api.minimaxi.com/anthropic`，不使用代理。

---

> 本文档由代码分析自动生成，如有疑问请参考源码或联系项目维护者。
