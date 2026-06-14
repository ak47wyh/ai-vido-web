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
}

export type VideoTaskStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export type VideoModel = 'MiniMax-Hailuo-2.3' | 'MiniMax-Hailuo-02' | 'T2V-01-Director' | 'T2V-01' | 'S2V-01';
export type VideoResolution = '720P' | '768P' | '1080P';
export type VideoGenerationMode = 't2v' | 'fl2v' | 's2v';

export interface VideoTask {
  id: string;
  segmentId: string;
  targetPlatform: string;
  status: VideoTaskStatus;
  videoUrl?: string;
  errorMessage?: string;
  externalTaskId?: string;
  createdAt: number;
  // New fields for extended video generation
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
