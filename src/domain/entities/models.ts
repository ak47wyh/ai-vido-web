export interface Character {
  id: string;
  name: string;
  appearancePrompt: string;
  personalityPrompt: string;
  referenceImageUrl?: string;
  createdAt: number;
}

export interface Background {
  id: string;
  name: string;
  environmentPrompt: string;
  referenceImageUrl?: string;
  createdAt: number;
}

export type StoryStatus = 'DRAFT' | 'SPLIT';

export interface Story {
  id: string;
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
  mentionedCharacters: string[]; // Array of Character IDs
  selectedBackgroundId?: string;
}

export type VideoTaskStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export interface VideoTask {
  id: string;
  segmentId: string;
  targetPlatform: string;
  status: VideoTaskStatus;
  videoUrl?: string;
  errorMessage?: string;
  externalTaskId?: string;
  createdAt: number;
}
