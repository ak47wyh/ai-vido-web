import type { Character, Background, Story, StorySegment, VideoTask, VideoTaskStatus } from '../entities/models';

// --- Repositories ---

export interface ICharacterRepository {
  save(character: Character): Promise<void>;
  findById(id: string): Promise<Character | null>;
  findAll(): Promise<Character[]>;
  delete(id: string): Promise<void>;
}

export interface IBackgroundRepository {
  save(background: Background): Promise<void>;
  findById(id: string): Promise<Background | null>;
  findAll(): Promise<Background[]>;
  delete(id: string): Promise<void>;
}

export interface IStoryRepository {
  save(story: Story): Promise<void>;
  findById(id: string): Promise<Story | null>;
  findAll(): Promise<Story[]>;
  delete(id: string): Promise<void>;
}

export interface IStorySegmentRepository {
  save(segment: StorySegment): Promise<void>;
  findByStoryId(storyId: string): Promise<StorySegment[]>;
  deleteByStoryId(storyId: string): Promise<void>;
}

export interface IVideoTaskRepository {
  save(task: VideoTask): Promise<void>;
  findBySegmentId(segmentId: string): Promise<VideoTask[]>;
  updateStatus(taskId: string, status: VideoTaskStatus, videoUrl?: string, error?: string): Promise<void>;
}

// --- external APIs ---

export interface VideoPromptContext {
  actionContent: string;
  characters: Character[];
  background?: Background;
  videoStyle?: string;
}

export interface VideoTaskResult {
  status: VideoTaskStatus;
  videoUrl?: string;
  errorMessage?: string;
}

export interface IVideoGeneratorPort {
  submitVideoTask(context: VideoPromptContext): Promise<string>;
  queryTaskStatus(externalTaskId: string): Promise<VideoTaskResult>;
}

export interface SegmentDraft {
  content: string;
  mentionedCharacters: string[];
}

export interface ITextSplitterPort {
  splitStoryToSegments(text: string, knownCharacterNames: string[]): Promise<SegmentDraft[]>;
}
