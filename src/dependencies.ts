import { StoryService } from './domain/services/StoryService';
import { VideoGenerationService } from './domain/services/VideoGenerationService';
import { StorySpaceService } from './domain/services/StorySpaceService';
import { StorySpaceRepositoryAdapter, CharacterRepositoryAdapter, StoryRepositoryAdapter, StorySegmentRepositoryAdapter, BackgroundRepositoryAdapter, VideoTaskRepositoryAdapter } from './adapters/outbound/repositories/IndexedDBAdapters';
import { MiniMaxVideoAdapter } from './adapters/outbound/api/MiniMaxVideoAdapter';
import { MiniMaxImageAdapter } from './adapters/outbound/api/MiniMaxImageAdapter';
import { MockTextSplitterAdapter } from './adapters/outbound/api/MockTextSplitter';
import { MockStoryBreakdownAdapter } from './adapters/outbound/api/MockStoryBreakdown';
import { ImageGenerationService } from './domain/services/ImageGenerationService';

export const spaceRepo = new StorySpaceRepositoryAdapter();
export const characterRepo = new CharacterRepositoryAdapter();
export const storyRepo = new StoryRepositoryAdapter();
export const segmentRepo = new StorySegmentRepositoryAdapter();
export const backgroundRepo = new BackgroundRepositoryAdapter();
export const videoTaskRepo = new VideoTaskRepositoryAdapter();

export const videoAdapter = new MiniMaxVideoAdapter();
export const imageAdapter = new MiniMaxImageAdapter();
export const textSplitterAdapter = new MockTextSplitterAdapter();
export const storyBreakdownAdapter = new MockStoryBreakdownAdapter();

export const storyService = new StoryService(
  storyRepo,
  segmentRepo,
  characterRepo,
  backgroundRepo,
  textSplitterAdapter,
  storyBreakdownAdapter,
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
