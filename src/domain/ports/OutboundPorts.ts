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
  findById(id: string): Promise<StorySegment | null>;
  findByStoryId(storyId: string): Promise<StorySegment[]>;
  deleteByStoryId(storyId: string): Promise<void>;
}

export interface IVideoTaskRepository {
  save(task: VideoTask): Promise<void>;
  findBySegmentId(segmentId: string): Promise<VideoTask[]>;
  findLatestBySegmentId(segmentId: string): Promise<VideoTask | null>;
  findByStatuses(statuses: VideoTaskStatus[]): Promise<VideoTask[]>;
  deleteBySegmentIds(segmentIds: string[]): Promise<void>;
  updateStatus(taskId: string, status: VideoTaskStatus, videoUrl?: string, error?: string): Promise<void>;
}

// --- Video Generation ---

export type VideoModel = 'MiniMax-Hailuo-2.3' | 'MiniMax-Hailuo-02' | 'T2V-01-Director' | 'T2V-01' | 'S2V-01';
export type VideoResolution = '720P' | '768P' | '1080P';
export type VideoGenerationMode = 't2v' | 'fl2v' | 's2v';

export interface VideoSubjectReference {
  type: string;
  image: string[];
}

export interface VideoPromptContext {
  mode?: VideoGenerationMode;
  model?: VideoModel;
  prompt: string;
  promptOptimizer?: boolean;
  fastPretreatment?: boolean;
  duration?: 6 | 10;
  resolution?: VideoResolution;
  callbackUrl?: string;
  // FL2V: first/last frame images
  firstFrameImage?: string;
  lastFrameImage?: string;
  // S2V: subject reference
  subjectReference?: VideoSubjectReference[];
  // T2V with voice/BGM
  characterVoiceIds?: Record<string, string>;
  bgmAudioUrl?: string;
  // Legacy fields (kept for backward compatibility)
  actionContent?: string;
  characters?: import('../entities/models').Character[];
  background?: import('../entities/models').Background;
  videoStyle?: string;
}

export interface VideoTaskResult {
  status: VideoTaskStatus;
  videoUrl?: string;
  videoWidth?: number;
  videoHeight?: number;
  fileId?: string;
  errorMessage?: string;
}

export interface VideoDownloadResult {
  downloadUrl: string;
  filename: string;
  bytes: number;
  createdAt: number;
}

export interface IVideoGeneratorPort {
  submitVideoTask(context: VideoPromptContext): Promise<string>;
  queryTaskStatus(externalTaskId: string): Promise<VideoTaskResult>;
  downloadVideo(fileId: string): Promise<VideoDownloadResult>;
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
  referenceImageUrl?: string;
  voiceId?: string;
}

export interface BackgroundDraft {
  name: string;
  environmentPrompt: string;
  referenceImageUrl?: string;
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

// --- Image Generation ---

export type ImageModel = 'image-01' | 'image-01-live';
export type ImageResponseFormat = 'url' | 'base64';
export type ImageAspectRatio = '1:1' | '16:9' | '4:3' | '3:2' | '2:3' | '3:4' | '9:16' | '21:9';

export interface ImageSubjectReference {
  type: string;
  image_file: string;
}

export interface ImageStyle {
  [key: string]: string;
}

export interface ImageGenerationContext {
  prompt: string;
  model?: ImageModel;
  aspectRatio?: ImageAspectRatio;
  width?: number;
  height?: number;
  responseFormat?: ImageResponseFormat;
  seed?: number;
  n?: number;
  promptOptimizer?: boolean;
  aigcWatermark?: boolean;
  subjectReference?: ImageSubjectReference[];
  style?: ImageStyle;
  // Legacy field
  subjectReferenceUrl?: string;
}

export interface ImageGenerationResult {
  imageDataUri?: string;
  imageUrls?: string[];
  metadata?: {
    successCount: number;
    failedCount: number;
  };
}

export interface IImageGeneratorPort {
  generateImage(context: ImageGenerationContext): Promise<ImageGenerationResult>;
}

// --- Voice ---

export interface VoiceCloneContext {
  fileId: string;
  voiceId: string;
  text: string;
  promptAudioFileId?: string;
  promptText?: string;
}

export interface VoiceCloneResult {
  voiceId: string;
  previewAudioUrl?: string;
}

export interface T2AAsyncContext {
  text: string;
  voiceId: string;
  model?: string;
  speed?: number;
  vol?: number;
  pitch?: number;
  audioFormat?: string;
  sampleRate?: number;
}

export interface T2AAsyncResult {
  taskId: string;
}

export interface T2AAsyncStatus {
  status: 'pending' | 'running' | 'done' | 'failed';
  audioFileId?: string;
  audioUrl?: string;
  audioDuration?: number;
  errorMessage?: string;
}

export interface FileUploadResult {
  fileId: string;
}

export interface IVoicePort {
  uploadFile(file: File, purpose: 'voice_clone' | 'prompt_audio' | 't2a_async_input'): Promise<FileUploadResult>;
  cloneVoice(context: VoiceCloneContext): Promise<VoiceCloneResult>;
  createT2ATask(context: T2AAsyncContext): Promise<T2AAsyncResult>;
  queryT2ATask(taskId: string): Promise<T2AAsyncStatus>;
  getFileUrl(fileId: string): string;
}

// --- Music Generation ---

export type MusicModel = 'music-2.6' | 'music-2.6-free' | 'music-cover' | 'music-cover-free';

export interface MusicGenerationContext {
  prompt: string;
  lyrics?: string;
  isInstrumental?: boolean;
  lyricsOptimizer?: boolean;
  model?: MusicModel;
  outputFormat?: 'url' | 'hex';
  stream?: boolean;
  aigcWatermark?: boolean;
  audioSetting?: {
    sampleRate?: number;
    bitrate?: number;
    format?: string;
  };
  // Cover mode: reference audio
  audioUrl?: string;
  audioBase64?: string;
  coverFeatureId?: string;
}

export interface MusicGenerationResult {
  audioUrl?: string;
  audioHex?: string;
  duration?: number;
  sampleRate?: number;
  bitrate?: number;
  channel?: number;
  size?: number;
  status?: number;
}

export interface LyricsGenerationContext {
  mode: 'write_full_song' | 'edit';
  prompt?: string;
  lyrics?: string;
  title?: string;
}

export interface LyricsGenerationResult {
  songTitle: string;
  styleTags: string;
  lyrics: string;
}

export interface CoverPreprocessResult {
  coverFeatureId: string;
  formattedLyrics: string;
  structureResult: string;
  audioDuration: number;
}

export interface IMusicPort {
  generateMusic(context: MusicGenerationContext): Promise<MusicGenerationResult>;
  generateLyrics(context: LyricsGenerationContext): Promise<LyricsGenerationResult>;
  preprocessCover(audioUrl: string): Promise<CoverPreprocessResult>;
}

// --- Text Generation ---

export interface TextGenerationCacheControl {
  type: 'ephemeral';
}

export interface TextGenerationSystemBlock {
  type: 'text';
  text: string;
  cache_control?: TextGenerationCacheControl;
}

export interface TextGenerationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  cache_control?: TextGenerationCacheControl;
}

export interface TextGenerationContext {
  model?: 'MiniMax-M3' | 'MiniMax-M2.5' | 'MiniMax-M2.5-highspeed' | 'MiniMax-M2.1' | 'MiniMax-M2.1-highspeed' | 'MiniMax-M2';
  messages: TextGenerationMessage[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  tools?: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
  useAnthropicEndpoint?: boolean;
  systemBlocks?: TextGenerationSystemBlock[];
}

export interface TextGenerationResult {
  content: string;
  thinking?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    cachedTokens?: number;
    cacheCreationTokens?: number;
  };
}

export interface RefineResult {
  content: string;
  cachedTokens?: number;
  totalTokens?: number;
}

export interface ITextGenerationPort {
  chatCompletion(context: TextGenerationContext): Promise<TextGenerationResult>;
}
