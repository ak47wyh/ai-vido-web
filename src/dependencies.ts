// ========================================
// 依赖注入容器
// ========================================

// ==================== 仓储层（数据持久化） ====================
import { StorySpaceRepositoryAdapter, CharacterRepositoryAdapter, StoryRepositoryAdapter, StorySegmentRepositoryAdapter, BackgroundRepositoryAdapter, VideoTaskRepositoryAdapter, FinalCutRepositoryAdapter } from './adapters/outbound/repositories/IndexedDBAdapters';

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
import { PlatformRouter, platformRouter } from './domain/services/PlatformRouter';

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

export const videoLabService = new VideoLabService(videoAdapter);

export const voiceService = new VoiceService(voiceAdapter, characterRepo);

export const musicService = new MusicService(musicAdapter, segmentRepo);

export const musicLabService = new MusicLabService(musicAdapter);

export const postProcessService = new PostProcessService(ffmpegAdapter, whisperAdapter);

export const subtitleService = new SubtitleService(whisperAdapter, textAdapter);

// ========================================
// 业务管线服务（全流程编排）
// ========================================
export const pipelineService = new PipelineService({
  storyRepo, segmentRepo, characterRepo, backgroundRepo, videoTaskRepo, finalCutRepo,
  textPort: textAdapter, imagePort: imageAdapter, videoPort: videoAdapter,
  voicePort: voiceAdapter, musicPort: musicAdapter,
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
// ========================================
export const modelManagementService = new ModelManagementService(modelAdapter);
export const fileManagementService = new FileManagementService(fileAdapter);

// ========================================
// AI 增强服务
// ========================================
export const agentService = new AgentService(textAdapter);
export const autoEditService = new AutoEditService(ffmpegAdapter);
export const cinematographyService = new CinematographyService(textAdapter);
export const bgmRecommendationService = new BGMRecommendationService(textAdapter);

// ==================== 素材库（离线存储） ====================
import { AssetLibraryService } from './domain/services/AssetLibraryService';
import { SavedImageRepository, SavedVoiceRepository, SavedPromptRepository } from './adapters/outbound/repositories/AssetLibraryRepositories';

export const savedImageRepo = new SavedImageRepository();
export const savedVoiceRepo = new SavedVoiceRepository();
export const savedPromptRepo = new SavedPromptRepository();

export const assetLibraryService = new AssetLibraryService(
  savedImageRepo, savedVoiceRepo, savedPromptRepo
);