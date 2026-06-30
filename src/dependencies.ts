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

// ==================== API 配置 Port 适配器 ====================
import { apiConfigStoreAdapter } from './adapters/outbound/config/ApiConfigStoreAdapter';

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
import { TimelineRenderService } from './domain/services/TimelineRenderService';
import { TimelineService } from './domain/services/TimelineService';

// ==================== 平台路由 ====================
import { platformRouter } from './domain/services/PlatformRouter';

// ==================== 基础设施层（横切关注点） ====================
import { ConsoleLoggerAdapter } from './adapters/outbound/infrastructure/ConsoleLoggerAdapter';
import { CompositeLoggerAdapter, ConsoleSinkAdapter } from './adapters/outbound/infrastructure/CompositeLoggerAdapter';
import { logSink } from './adapters/outbound/infrastructure/RingBufferLogSinkAdapter';
import { defaultEventBus } from './adapters/outbound/infrastructure/MemoryEventBusAdapter';
import { defaultMetrics } from './adapters/outbound/infrastructure/NoopMetricsAdapter';
import { defaultResilience } from './adapters/outbound/infrastructure/DefaultResilienceAdapter';

export const defaultLogger = new CompositeLoggerAdapter([
  new ConsoleSinkAdapter(new ConsoleLoggerAdapter(), { service: 'app' }),
  logSink,
], { service: 'app' });


// ==================== 文件存储层（OPFS / IndexedDB） ====================
import { createFileStorageAdapter } from './adapters/outbound/storage/FileStorageAdapterFactory';
import { GeneratedFileRepository } from './adapters/outbound/repositories/GeneratedFileRepository';
import type { IFileStoragePort } from './domain/ports/FileStoragePorts';
import { migrateOfflineCache, needsMigration } from './adapters/outbound/storage/OfflineCacheMigration';

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
// 文件存储层（OPFS / IndexedDB）
// 需要异步初始化，在应用入口调用 await initializeFileStorage()
// ========================================
let _fileStorageAdapter: IFileStoragePort | null = null;

/**
 * 异步初始化文件存储。必须在应用启动时调用。
 * 同时执行旧 OfflineCache 数据迁移。
 *
 * 错误信息会写入 logger，可在应用内日志面板（Ctrl+`）查看。
 */
export async function initializeFileStorage(): Promise<IFileStoragePort> {
  if (_fileStorageAdapter) return _fileStorageAdapter;
  try {
    _fileStorageAdapter = await createFileStorageAdapter(defaultLogger);
    defaultLogger.info('[FileStorage] initialized', {
      service: 'fileStorage',
      storageType: _fileStorageAdapter.getStorageType?.() ?? 'unknown',
    });

    // 执行旧数据迁移（首次启动时）
    if (needsMigration()) {
      defaultLogger.info('[FileStorage] migrating offline cache', {
        service: 'fileStorage',
      });
      await migrateOfflineCache(_fileStorageAdapter, generatedFileRepo);
    }

    return _fileStorageAdapter;
  } catch (err) {
    defaultLogger.error('[FileStorage] initialization failed', err, {
      service: 'fileStorage',
    });
    throw err;
  }
}

/** 获取已初始化的文件存储端口（同步） */
export function getFileStorage(): IFileStoragePort {
  if (!_fileStorageAdapter) {
    const err = new Error('[DI] FileStorage not initialized. Call await initializeFileStorage() first.');
    defaultLogger.error('[DI] getFileStorage called before initialization', err, {
      service: 'fileStorage',
    });
    throw err;
  }
  return _fileStorageAdapter;
}

export const generatedFileRepo = new GeneratedFileRepository();

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
  characterRepo, backgroundRepo, platformRouter, apiConfigStoreAdapter, getFileStorage, defaultLogger.child({ service: 'ImageGenerationService' })
);

export const textGenerationService = new TextGenerationService(
  platformRouter, apiConfigStoreAdapter,
  defaultLogger.child({ service: 'TextGenerationService' })
);

export const textLabService = new TextLabService(
  platformRouter, apiConfigStoreAdapter,
  defaultLogger.child({ service: 'TextLabService' })
);

// ========================================
// 视音频域服务（视频生成/配音/BGM/后期）
// ========================================
export const videoGenerationService = new VideoGenerationService(
  videoTaskRepo, segmentRepo, characterRepo, backgroundRepo, platformRouter, getFileStorage,
  apiConfigStoreAdapter, defaultLogger.child({ service: 'VideoGenerationService' })
);

export const videoLabService = new VideoLabService(
  platformRouter, apiConfigStoreAdapter,
  defaultLogger.child({ service: 'VideoLabService' })
);

export const voiceService = new VoiceService(
  platformRouter, characterRepo, segmentRepo, getFileStorage,
  apiConfigStoreAdapter, defaultLogger.child({ service: 'VoiceService' })
);

export const musicService = new MusicService(platformRouter, apiConfigStoreAdapter, segmentRepo, getFileStorage, defaultLogger.child({ service: 'MusicService' }));

export const musicLabService = new MusicLabService(
  platformRouter, apiConfigStoreAdapter, getFileStorage,
  defaultLogger.child({ service: 'MusicLabService' })
);

export const postProcessService = new PostProcessService(ffmpegAdapter, whisperAdapter);

// ========================================
// 时间线渲染服务（剪辑工作台 → 最终视频）
// - fileStorage 用 lazy accessor，支持应用启动时未完成异步初始化的场景
// ========================================
export const timelineRenderService = new TimelineRenderService({
  ffmpegPort: ffmpegAdapter,
  fileStorage: getFileStorage,
  videoTaskRepo,
  finalCutRepo,
  savedVideoRepo,
  savedVoiceRepo,
  logger: defaultLogger.child({ service: 'TimelineRenderService' }),
});

export const timelineService = new TimelineService({
  timelineRepo,
  storyRepo,
  segmentRepo,
  videoTaskRepo,
});

export const subtitleService = new SubtitleService(
  whisperAdapter, platformRouter, apiConfigStoreAdapter,
  defaultLogger.child({ service: 'SubtitleService' })
);

// ========================================
// 业务管线服务（全流程编排）
// ========================================
export const pipelineService = new PipelineService({
  storyRepo, segmentRepo, characterRepo, backgroundRepo, videoTaskRepo, finalCutRepo,
  router: platformRouter,
  postProcess: postProcessService, subtitle: subtitleService,
  fileStorage: getFileStorage,
  logger,
  eventBus,
  configStore: apiConfigStoreAdapter,
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
import type { ModelInfo } from './domain/ports/OutboundPorts';
const modelCache = new ModelCacheAdapter<ModelInfo>('minimax_cached_models', 60 * 60 * 1000);
export const modelManagementService = new ModelManagementService(modelAdapter, modelCache);
export const fileManagementService = new FileManagementService(fileAdapter);

// ========================================
// AI 增强服务
// ========================================
export const agentService = new AgentService(
  platformRouter, apiConfigStoreAdapter,
  defaultLogger.child({ service: 'AgentService' })
);
export const autoEditService = new AutoEditService(ffmpegAdapter);
export const cinematographyService = new CinematographyService(
  platformRouter, apiConfigStoreAdapter,
  defaultLogger.child({ service: 'CinematographyService' })
);
export const bgmRecommendationService = new BGMRecommendationService(
  platformRouter, apiConfigStoreAdapter,
  defaultLogger.child({ service: 'BGMRecommendationService' })
);

// ==================== 素材库（离线存储） ====================
import { AssetLibraryService } from './domain/services/AssetLibraryService';
import { SavedImageRepository, SavedVoiceRepository, SavedPromptRepository, SavedVideoRepository } from './adapters/outbound/repositories/AssetLibraryRepositories';

export const savedImageRepo = new SavedImageRepository();
export const savedVoiceRepo = new SavedVoiceRepository();
export const savedPromptRepo = new SavedPromptRepository();
export const savedVideoRepo = new SavedVideoRepository();

// AssetLibraryService 使用延迟获取模式（lazy accessor），
// 允许在模块加载时构造，但实际调用方法时才获取 fileStorage。
// 确保在调用 assetLibraryService 的方法前已执行 await initializeFileStorage()。
export const assetLibraryService = new AssetLibraryService(
  savedImageRepo, savedVoiceRepo, savedPromptRepo, savedVideoRepo,
  getFileStorage,        // 传入函数引用，延迟获取
  () => generatedFileRepo,  // 传入函数引用，延迟获取
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
export const postProcessPort: import('./domain/ports/DomainServicePorts').IPostProcessPort = new PostProcessPortAdapter(
  postProcessService,
  timelineRenderService,
  timelineService,
);
export const subtitlePort: import('./domain/ports/DomainServicePorts').ISubtitlePort = new SubtitlePortAdapter(subtitleService);

// ========================================
// 时间线渲染 Port（供剪辑工作台 UI 注入）
// ========================================
import { TimelineRenderPortAdapter } from './adapters/outbound/services/TimelineRenderPortAdapter';
export const timelineRenderPort: import('./domain/ports/TimelineRenderPorts').ITimelineRenderPort = new TimelineRenderPortAdapter(timelineRenderService);

// ========================================
// UI 副作用 Port 适配器（Service 主动弹 Toast / Confirm）
// ========================================
import { reactNotificationAdapter } from './adapters/outbound/ui/ReactNotificationAdapter';
import { reactConfirmAdapter } from './adapters/outbound/ui/ReactConfirmAdapter';
import { createReactThemeAdapter } from './adapters/outbound/ui/ReactThemeAdapter';
import { createI18nextTranslationAdapter } from './adapters/outbound/ui/I18nextTranslationAdapter';
import { createBrowserNetworkStatusAdapter } from './adapters/outbound/infrastructure/BrowserNetworkStatusAdapter';

export const notifier: import('./domain/ports/CrossCuttingPorts').INotificationPort = reactNotificationAdapter;
export const confirmer: import('./domain/ports/CrossCuttingPorts').IConfirmPort = reactConfirmAdapter;
export const themePort: import('./domain/ports/UiPorts').IThemePort = createReactThemeAdapter(defaultLogger.child({ service: 'ui.theme' }));
export const translationPort: import('./domain/ports/UiPorts').ITranslationPort = createI18nextTranslationAdapter(defaultLogger.child({ service: 'ui.i18n' }));
export const networkPort: import('./domain/ports/UiPorts').INetworkStatusPort = createBrowserNetworkStatusAdapter(defaultLogger.child({ service: 'ui.network' }));

// ========================================
// 业务编排 Port 适配器（IAutoEditPort / IAssetExportPort）
// ========================================
import { AutoEditPortAdapter } from './adapters/outbound/services/AutoEditPortAdapter';
import { AssetExportAdapter } from './adapters/outbound/services/AssetExportAdapter';

export const autoEditPort: import('./domain/ports/DomainServicePorts').IAutoEditPort = new AutoEditPortAdapter(autoEditService);
export const assetExportPort: import('./domain/ports/DomainServicePorts').IAssetExportPort = new AssetExportAdapter(
  spaceRepo, characterRepo, backgroundRepo, storyRepo, segmentRepo, videoTaskRepo, finalCutRepo
);

// ========================================
// 去水印服务（浏览器端本地处理）
// ========================================
import { CanvasInpaintAdapter } from './adapters/outbound/api/inpaint/CanvasInpaintAdapter';
import { PdfWatermarkAdapter } from './adapters/outbound/api/inpaint/PdfWatermarkAdapter';
import { FFmpegVideoInpaintAdapter } from './adapters/outbound/api/inpaint/FFmpegVideoInpaintAdapter';
import type { IImageInpaintPort, IPdfWatermarkPort, IVideoInpaintPort } from './domain/ports/WatermarkRemovalPorts';

export const imageInpaintAdapter: IImageInpaintPort = new CanvasInpaintAdapter();
export const pdfWatermarkAdapter: IPdfWatermarkPort = new PdfWatermarkAdapter();
export const videoInpaintAdapter: IVideoInpaintPort = new FFmpegVideoInpaintAdapter(ffmpegAdapter);

// ========================================
// 清晰度提升服务（浏览器端本地处理）
// 与去水印服务并列，复用 FFmpegAdapter
// ========================================
import { CanvasImageEnhanceAdapter } from './adapters/outbound/api/enhance/CanvasImageEnhanceAdapter';
import { PdfEnhanceAdapter } from './adapters/outbound/api/enhance/PdfEnhanceAdapter';
import { FFmpegVideoEnhanceAdapter } from './adapters/outbound/api/enhance/FFmpegVideoEnhanceAdapter';
import type { IImageEnhancePort, IPdfEnhancePort, IVideoEnhancePort } from './domain/ports/EnhancementPorts';

export const imageEnhanceAdapter: IImageEnhancePort = new CanvasImageEnhanceAdapter();
export const pdfEnhanceAdapter: IPdfEnhancePort = new PdfEnhanceAdapter();
export const videoEnhanceAdapter: IVideoEnhancePort = new FFmpegVideoEnhanceAdapter(ffmpegAdapter);