import type { Character, Background, Story, StorySegment, StorySpace, VideoTask, VideoTaskStatus } from '../entities/models';

// --- Repositories ---

export interface IStorySpaceRepository {
  save(space: StorySpace): Promise<void>;
  findById(id: string): Promise<StorySpace | null>;
  findAll(): Promise<StorySpace[]>;
  delete(id: string): Promise<void>;
}

export interface ICharacterRepository {
  save(character: Character): Promise<void>;
  findById(id: string): Promise<Character | null>;
  findAll(): Promise<Character[]>;
  findBySpaceId(spaceId: string): Promise<Character[]>;
  delete(id: string): Promise<void>;
}

export interface IBackgroundRepository {
  save(background: Background): Promise<void>;
  findById(id: string): Promise<Background | null>;
  findAll(): Promise<Background[]>;
  findBySpaceId(spaceId: string): Promise<Background[]>;
  delete(id: string): Promise<void>;
}

export interface IStoryRepository {
  save(story: Story): Promise<void>;
  findById(id: string): Promise<Story | null>;
  findAll(): Promise<Story[]>;
  findBySpaceId(spaceId: string): Promise<Story[]>;
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
  findLatestBySegmentId(segmentId: string): Promise<VideoTask | null>;
  deleteBySegmentIds(segmentIds: string[]): Promise<void>;
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
  suggestedBackgroundName?: string;
}

export interface ITextSplitterPort {
  splitStoryToSegments(text: string, knownCharacterNames: string[]): Promise<SegmentDraft[]>;
}

// --- Story Breakdown (One-click decompose) ---

export interface CharacterDraft {
  name: string;
  appearancePrompt: string;
  personalityPrompt: string;
  characterBackground: string;
}

export interface BackgroundDraft {
  name: string;
  environmentPrompt: string;
}

export interface BreakdownSegmentDraft {
  content: string;
  mentionedCharacterNames: string[];
  suggestedBackgroundName: string;
}

export interface StoryBreakdownResult {
  characters: CharacterDraft[];
  backgrounds: BackgroundDraft[];
  segments: BreakdownSegmentDraft[];
}

export interface IStoryBreakdownPort {
  breakdownStory(text: string): Promise<StoryBreakdownResult>;
}
