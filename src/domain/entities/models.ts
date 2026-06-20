export interface StorySpace {
  id: string;
  name: string;
  description: string;
  createdAt: number;
}

export interface Character {
  id: string;
  spaceId: string;
  name: string;
  appearancePrompt: string;
  personalityPrompt: string;
  characterBackground: string;
  referenceImageUrl?: string;
  voiceId?: string;
  createdAt: number;
}

export interface Background {
  id: string;
  spaceId: string;
  name: string;
  environmentPrompt: string;
  referenceImageUrl?: string;
  createdAt: number;
}

export type StoryStatus = 'DRAFT' | 'SPLIT';

export interface Story {
  id: string;
  spaceId: string;
  title: string;
  originalText: string;
  status: StoryStatus;
  createdAt: number;
}

export interface StorySegment {
  id: string;
  storyId: string;
  sequenceOrder: number;
  content: string;
  mentionedCharacters: string[];
  selectedBackgroundId?: string;
  bgmAudioUrl?: string;
  bgmPrompt?: string;
  bgmLyrics?: string;
  bgmIsInstrumental?: boolean;
  actionContent?: string;
  firstFrameImage?: string;
}

export type VideoTaskStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export type VideoModel = 'MiniMax-Hailuo-2.3' | 'MiniMax-Hailuo-2.3-Fast' | 'MiniMax-Hailuo-02' | 'T2V-01-Director' | 'T2V-01' | 'I2V-01-Director' | 'I2V-01-live' | 'I2V-01' | 'S2V-01';
export type VideoResolution = '512P' | '720P' | '768P' | '1080P';
export type VideoGenerationMode = 't2v' | 'i2v' | 'fl2v' | 's2v';

export interface VideoTask {
  id: string;
  segmentId: string;
  targetPlatform: string;
  status: VideoTaskStatus;
  videoUrl?: string;
  errorMessage?: string;
  externalTaskId?: string;
  createdAt: number;
  updatedAt?: number;
  mode?: VideoGenerationMode;
  model?: VideoModel;
  resolution?: VideoResolution;
  duration?: 6 | 10;
  fileId?: string;
  videoWidth?: number;
  videoHeight?: number;
  promptOptimizer?: boolean;
  firstFrameImage?: string;
  lastFrameImage?: string;
}

// --- Final Cut & Pipeline (v7) ---

export type PipelineStatus =
  | 'idle'
  | 'splitting'
  | 'generating_images'
  | 'generating_audio'
  | 'generating_bgm'
  | 'generating_videos'
  | 'post_processing'
  | 'generating_srt'
  | 'burning_subtitles'
  | 'complete'
  | 'failed';

export interface PipelineStep {
  name: PipelineStatus;
  status: 'pending' | 'running' | 'done' | 'failed';
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface PipelineTask {
  id: string;
  storyId: string;
  status: PipelineStatus;
  progress: number;
  currentStep: string;
  steps: PipelineStep[];
  finalVideoUrl?: string;
  createdAt: number;
  completedAt?: number;
  error?: string;
}

export interface FinalCut {
  id: string;
  storyId: string;
  pipelineTaskId?: string;
  videoBlob: Blob;
  thumbnailUrl?: string;
  duration: number;
  size: number;
  hasSubtitles: boolean;
  srtContent?: string;
  createdAt: number;
}

// --- Asset Library (v8) ---

export type SavedImageSource = 'lab' | 'pipeline' | 'character' | 'background';
export type SavedVoiceSource = 'lab' | 'clone' | 'pipeline';
export type PromptCategory = 'image' | 'voice' | 'story' | 'scene' | 'narration' | 'other';
export type SavedPromptSource = 'lab' | 'pipeline' | 'manual';

export interface SavedImage {
  id: string;
  spaceId: string;
  name: string;
  prompt: string;
  model: string;
  aspectRatio: string;
  blobKey: string;
  thumbnailBlobKey?: string;
  tags: string[];
  sourceType: SavedImageSource;
  sourceId?: string;
  createdAt: number;
}

export interface SavedVoice {
  id: string;
  spaceId: string;
  name: string;
  voiceId: string;
  model: string;
  speed: number;
  sampleText: string;
  audioBlobKey: string;
  tags: string[];
  sourceType: SavedVoiceSource;
  sourceId?: string;
  createdAt: number;
}

export interface SavedPrompt {
  id: string;
  spaceId: string;
  name: string;
  content: string;
  category: PromptCategory;
  tags: string[];
  sourceType: SavedPromptSource;
  createdAt: number;
}
