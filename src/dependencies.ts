// ========================================
// 依赖注入容器
// ========================================

// ==================== 仓储层（数据持久化） ====================
import { StorySpaceRepositoryAdapter, CharacterRepositoryAdapter, StoryRepositoryAdapter, StorySegmentRepositoryAdapter, BackgroundRepositoryAdapter, VideoTaskRepositoryAdapter, FinalCutRepositoryAdapter } from './adapters/outbound/repositories/IndexedDBAdapters';
import { SnapshotRepositoryAdapter } from './adapters/outbound/repositories/SnapshotRepositoryAdapter';
import { TimelineRepositoryAdapter } from './adapters/outbound/repositories/TimelineRepositoryAdapter';

// ==================== 基础设施层（外部API适配器） ====================
import { MiniMaxVideoAdapter } from './adapters/outbound/api/MiniMaxVideoAdapter';
import { MiniMaxImageAdapter } from './adapters/outbound/api/MiniMaxImageAdapter';
import { MiniMaxVoiceAdapter } from './adapters/outbound/api/MiniMaxVoiceAdapter';
import { MiniMaxMusicAdapter } from './adapters/outbound/api/MiniMaxMusicAdapter';
import { MiniMaxTextAdapter } from './adapters/outbound/api/MiniMaxTextAdapter';
import { MiniMaxTextSplitterAdapter } from './adapters/outbound/api/MiniMaxTextSplitterAdapter';
import { MiniMaxStoryBreakdownAdapter } from './adapters/outbound/api/MiniMaxStoryBreakdownAdapter';
import { MiniMaxModelAdapter } from './adapters/outbound/api/MiniMaxModelAdapter';
import { MiniMaxFileAdapter } from './adapters/outbound/api/MiniMaxFileAdapter';
import { FFmpegAdapter } from './adapters/outbound/api/FFmpegAdapter';
import { WhisperAdapter } from './adapters/outbound/api/WhisperAdapter';

// ==================== Mock / 降级适配器 ====================
import { MockTextSplitterAdapter } from './adapters/outbound/api/MockTextSplitter';
import { MockStoryBreakdownAdapter } from './adapters/outbound/api/MockStoryBreakdown';

// ==================== 领域服务层 ====================
import { StoryService } from './domain/services/StoryService';
import { VideoGenerationService } from './domain/services/VideoGenerationService';
import { VideoLabService } from './domain/services/VideoLabService';
import { StorySpaceService } from './domain/services/StorySpaceService';
import { PostProcessService } from './domain/services/PostProcessService';
import { PipelineService } from './domain/services/PipelineService';
import { SubtitleService } from './domain/services/SubtitleService';
import { ImageGenerationService } from './domain/services/ImageGenerationService';
import { VoiceService } from './domain/services/VoiceService';
import { MusicService } from './domain/services/MusicService';
import { MusicLabService } from './domain/services/MusicLabService';
import { TextGenerationService } from './domain/services/TextGenerationService';
import { TextLabService } from './domain/services/TextLabService';
import { ModelManagementService } from './domain/services/ModelManagementService';
import { FileManagementService } from './domain/services/FileManagementService';
import { AgentService } from './domain/services/AgentService';
import { AutoEditService } from './domain/services/AutoEditService';
import { CinematographyService } from './domain/services/CinematographyService';
import { BGMRecommendationService } from './domain/services/BGMRecommendationService';

// ==================== 平台路由 ====================
import { platformRouter } from './domain/services/PlatformRouter';

// ==================== 基础设施层（横切关注点） ====================
import { defaultLogger } from './adapters/outbound/infrastructure/ConsoleLoggerAdapter';
import { defaultEventBus } from './adapters/outbound/infrastructure/MemoryEventBusAdapter';
import { defaultMetrics } from './adapters/outbound/infrastructure/NoopMetricsAdapter';
import { defaultResilience } from './adapters/outbound/infrastructure/DefaultResilienceAdapter';

// ========================================
// 仓储实例
// ========================================
export const spaceRepo = new StorySpaceRepositoryAdapter();
export const characterRepo = new CharacterRepositoryAdapter();
export const storyRepo = new StoryRepositoryAdapter();
export const segmentRepo = new StorySegmentRepositoryAdapter();
export const backgroundRepo = new BackgroundRepositoryAdapter();
export const videoTaskRepo = new VideoTaskRepositoryAdapter();
export const finalCutRepo = new FinalCutRepositoryAdapter();
export const snapshotRepo = new SnapshotRepositoryAdapter();
export const timelineRepo = new TimelineRepositoryAdapter();

// ========================================
// 横切关注点（基础设施）
// ========================================
export const logger = defaultLogger;
export const eventBus = defaultEventBus;
export const metrics = defaultMetrics;
export const resilience = defaultResilience;

// ========================================
// 基础设施实例
// ========================================
export const videoAdapter = new MiniMaxVideoAdapter();
export const imageAdapter = new MiniMaxImageAdapter();
export const voiceAdapter = new MiniMaxVoiceAdapter();
export const musicAdapter = new MiniMaxMusicAdapter();
export const textAdapter = new MiniMaxTextAdapter();
export const modelAdapter = new MiniMaxModelAdapter();
export const fileAdapter = new MiniMaxFileAdapter();
export const ffmpegAdapter = new FFmpegAdapter();
export const whisperAdapter = new WhisperAdapter();

// ========================================
// Mock / 智能降级实例
// ========================================
export const mockTextSplitter = new MockTextSplitterAdapter();
export const mockStoryBreakdown = new MockStoryBreakdownAdapter();
export const smartTextSplitter = new MiniMaxTextSplitterAdapter(textAdapter, mockTextSplitter);
export const smartStoryBreakdown = new MiniMaxStoryBreakdownAdapter(textAdapter, mockStoryBreakdown);

// ========================================
// 创作域服务（故事→分镜→角色/场景生成）
// ========================================
export const storyService = new StoryService(
  storyRepo, segmentRepo, characterRepo, backgroundRepo,
  smartTextSplitter, smartStoryBreakdown, videoTaskRepo
);

export const imageGenerationService = new ImageGenerationService(
  characterRepo, backgroundRepo, platformRouter
);

export const textGenerationService = new TextGenerationService(platformRouter);

export const textLabService = new TextLabService(platformRouter);

// ========================================
// 视音频域服务（视频生成/配音/BGM/后期）
// ========================================
export const videoGenerationService = new VideoGenerationService(
  videoTaskRepo, segmentRepo, characterRepo, backgroundRepo, platformRouter
);

export const videoLabService = new VideoLabService(platformRouter);

export const voiceService = new VoiceService(platformRouter, characterRepo);

export const musicService = new MusicService(platformRouter, segmentRepo);

export const musicLabService = new MusicLabService(platformRouter);

export const postProcessService = new PostProcessService(ffmpegAdapter, whisperAdapter);

export const subtitleService = new SubtitleService(whisperAdapter, platformRouter);

// ========================================
// 业务管线服务（全流程编排）
// ========================================
export const pipelineService = new PipelineService({
  storyRepo, segmentRepo, characterRepo, backgroundRepo, videoTaskRepo, finalCutRepo,
  router: platformRouter,
  postProcess: postProcessService, subtitle: subtitleService,
});

// ========================================
// 空间管理
// ========================================
export const storySpaceService = new StorySpaceService(
  spaceRepo, characterRepo, backgroundRepo, storyRepo, segmentRepo, videoTaskRepo
);

// ========================================
// 模型 / 文件管理
// 注意：ModelManagementService / FileManagementService 使用 MiniMax 专属 API，
// 暂保持硬编码 MiniMax 适配器，不接入 platformRouter。
// ========================================
import { ModelCacheAdapter } from './adapters/outbound/repositories/ModelCacheAdapter';
const modelCache = new ModelCacheAdapter<import('./domain/entities/models').ModelInfo>('minimax_cached_models', 60 * 60 * 1000);
export const modelManagementService = new ModelManagementService(modelAdapter, modelCache);
export const fileManagementService = new FileManagementService(fileAdapter);

// ========================================
// AI 增强服务
// ========================================
export const agentService = new AgentService(platformRouter);
export const autoEditService = new AutoEditService(ffmpegAdapter);
export const cinematographyService = new CinematographyService(platformRouter);
export const bgmRecommendationService = new BGMRecommendationService(platformRouter);

// ==================== 素材库（离线存储） ====================
import { AssetLibraryService } from './domain/services/AssetLibraryService';
import { SavedImageRepository, SavedVoiceRepository, SavedPromptRepository } from './adapters/outbound/repositories/AssetLibraryRepositories';

export const savedImageRepo = new SavedImageRepository();
export const savedVoiceRepo = new SavedVoiceRepository();
export const savedPromptRepo = new SavedPromptRepository();

export const assetLibraryService = new AssetLibraryService(
  savedImageRepo, savedVoiceRepo, savedPromptRepo
);

// ==================== 快照服务（v2.0：使用 ISnapshotRepository） ====================
import { SnapshotService } from './domain/services/SnapshotService';
export const snapshotService = new SnapshotService(
  spaceRepo,
  snapshotRepo,
  { logger, eventBus, maxPerSpace: 50 }
);

// ========================================
// Port 适配器（把现有 Service 包装为 Port 契约）
// 业务编排层（PipelineService 等）后续可通过这些 Port 注入。
// ========================================
import { AgentPortAdapter } from './adapters/outbound/services/AgentPortAdapter';
import { BGMPortAdapter } from './adapters/outbound/services/BGMPortAdapter';
import { CinematographyPortAdapter } from './adapters/outbound/services/CinematographyPortAdapter';
import { PostProcessPortAdapter } from './adapters/outbound/services/PostProcessPortAdapter';
import { SubtitlePortAdapter } from './adapters/outbound/services/SubtitlePortAdapter';

export const agentPort: import('./domain/ports/DomainServicePorts').IAgentPort = new AgentPortAdapter(agentService);
export const bgmPort: import('./domain/ports/DomainServicePorts').IBGMRecommendationPort = new BGMPortAdapter(bgmRecommendationService);
export const cinematographyPort: import('./domain/ports/DomainServicePorts').ICinematographyPort = new CinematographyPortAdapter(cinematographyService);
export const postProcessPort: import('./domain/ports/DomainServicePorts').IPostProcessPort = new PostProcessPortAdapter(postProcessService);
export const subtitlePort: import('./domain/ports/DomainServicePorts').ISubtitlePort = new SubtitlePortAdapter(subtitleService);

// ========================================
// UI 副作用 Port 适配器（Service 主动弹 Toast / Confirm）
// ========================================
import { reactNotificationAdapter } from './adapters/outbound/ui/ReactNotificationAdapter';
import { reactConfirmAdapter } from './adapters/outbound/ui/ReactConfirmAdapter';

export const notifier: import('./domain/ports/CrossCuttingPorts').INotificationPort = reactNotificationAdapter;
export const confirmer: import('./domain/ports/CrossCuttingPorts').IConfirmPort = reactConfirmAdapter;