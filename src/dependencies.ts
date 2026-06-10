import { StoryService } from './domain/services/StoryService';
import { VideoGenerationService } from './domain/services/VideoGenerationService';
import { CharacterRepositoryAdapter, StoryRepositoryAdapter, StorySegmentRepositoryAdapter, BackgroundRepositoryAdapter, VideoTaskRepositoryAdapter } from './adapters/outbound/repositories/IndexedDBAdapters';
import { MiniMaxVideoAdapter } from './adapters/outbound/api/MiniMaxVideoAdapter';
import { MockTextSplitterAdapter } from './adapters/outbound/api/MockTextSplitter';

export const characterRepo = new CharacterRepositoryAdapter();
export const storyRepo = new StoryRepositoryAdapter();
export const segmentRepo = new StorySegmentRepositoryAdapter();
export const backgroundRepo = new BackgroundRepositoryAdapter();
export const videoTaskRepo = new VideoTaskRepositoryAdapter();

export const videoAdapter = new MiniMaxVideoAdapter();
export const textSplitterAdapter = new MockTextSplitterAdapter();

export const storyService = new StoryService(
  storyRepo,
  segmentRepo,
  characterRepo,
  textSplitterAdapter
);

export const videoGenerationService = new VideoGenerationService(
  videoTaskRepo,
  segmentRepo,
  characterRepo,
  backgroundRepo,
  videoAdapter
);
