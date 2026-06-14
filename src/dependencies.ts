import { StoryService } from './domain/services/StoryService';
import { VideoGenerationService } from './domain/services/VideoGenerationService';
import { StorySpaceService } from './domain/services/StorySpaceService';
import { StorySpaceRepositoryAdapter, CharacterRepositoryAdapter, StoryRepositoryAdapter, StorySegmentRepositoryAdapter, BackgroundRepositoryAdapter, VideoTaskRepositoryAdapter } from './adapters/outbound/repositories/IndexedDBAdapters';
import { MiniMaxVideoAdapter } from './adapters/outbound/api/MiniMaxVideoAdapter';
import { MiniMaxImageAdapter } from './adapters/outbound/api/MiniMaxImageAdapter';
import { MiniMaxVoiceAdapter } from './adapters/outbound/api/MiniMaxVoiceAdapter';
import { MiniMaxMusicAdapter } from './adapters/outbound/api/MiniMaxMusicAdapter';
import { MiniMaxTextAdapter } from './adapters/outbound/api/MiniMaxTextAdapter';
import { MiniMaxTextSplitterAdapter } from './adapters/outbound/api/MiniMaxTextSplitterAdapter';
import { MiniMaxStoryBreakdownAdapter } from './adapters/outbound/api/MiniMaxStoryBreakdownAdapter';
import { MiniMaxModelAdapter } from './adapters/outbound/api/MiniMaxModelAdapter';
import { MiniMaxFileAdapter } from './adapters/outbound/api/MiniMaxFileAdapter';
import { MockTextSplitterAdapter } from './adapters/outbound/api/MockTextSplitter';
import { MockStoryBreakdownAdapter } from './adapters/outbound/api/MockStoryBreakdown';
import { ImageGenerationService } from './domain/services/ImageGenerationService';
import { VoiceService } from './domain/services/VoiceService';
import { MusicService } from './domain/services/MusicService';
import { TextGenerationService } from './domain/services/TextGenerationService';
import { ModelManagementService } from './domain/services/ModelManagementService';
import { FileManagementService } from './domain/services/FileManagementService';

export const spaceRepo = new StorySpaceRepositoryAdapter();
export const characterRepo = new CharacterRepositoryAdapter();
export const storyRepo = new StoryRepositoryAdapter();
export const segmentRepo = new StorySegmentRepositoryAdapter();
export const backgroundRepo = new BackgroundRepositoryAdapter();
export const videoTaskRepo = new VideoTaskRepositoryAdapter();

export const videoAdapter = new MiniMaxVideoAdapter();
export const imageAdapter = new MiniMaxImageAdapter();
export const voiceAdapter = new MiniMaxVoiceAdapter();
export const musicAdapter = new MiniMaxMusicAdapter();
export const textAdapter = new MiniMaxTextAdapter();
export const modelAdapter = new MiniMaxModelAdapter();
export const fileAdapter = new MiniMaxFileAdapter();

// Mock adapters (used as fallback when API is unavailable)
export const mockTextSplitter = new MockTextSplitterAdapter();
export const mockStoryBreakdown = new MockStoryBreakdownAdapter();

// Smart adapters with AI + fallback to mock
export const smartTextSplitter = new MiniMaxTextSplitterAdapter(textAdapter, mockTextSplitter);
export const smartStoryBreakdown = new MiniMaxStoryBreakdownAdapter(textAdapter, mockStoryBreakdown);

export const storyService = new StoryService(
  storyRepo,
  segmentRepo,
  characterRepo,
  backgroundRepo,
  smartTextSplitter,
  smartStoryBreakdown,
  videoTaskRepo
);

export const storySpaceService = new StorySpaceService(
  spaceRepo,
  characterRepo,
  backgroundRepo,
  storyRepo,
  segmentRepo,
  videoTaskRepo
);

export const videoGenerationService = new VideoGenerationService(
  videoTaskRepo,
  segmentRepo,
  characterRepo,
  backgroundRepo,
  videoAdapter
);

export const imageGenerationService = new ImageGenerationService(
  imageAdapter,
  characterRepo,
  backgroundRepo
);

export const voiceService = new VoiceService(voiceAdapter, characterRepo);

export const musicService = new MusicService(musicAdapter, segmentRepo);

export const textGenerationService = new TextGenerationService(textAdapter);

export const modelManagementService = new ModelManagementService(modelAdapter);

export const fileManagementService = new FileManagementService(fileAdapter);
