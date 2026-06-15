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

export type VideoModel =
  | 'MiniMax-Hailuo-2.3' | 'MiniMax-Hailuo-2.3-Fast' | 'MiniMax-Hailuo-02'
  | 'T2V-01-Director' | 'T2V-01'
  | 'I2V-01-Director' | 'I2V-01-live' | 'I2V-01'
  | 'S2V-01';
export type VideoResolution = '512P' | '720P' | '768P' | '1080P';
export type VideoGenerationMode = 't2v' | 'i2v' | 'fl2v' | 's2v';

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
  firstFrameImage?: string;
  lastFrameImage?: string;
  subjectReference?: VideoSubjectReference[];
  characterVoiceIds?: Record<string, string>;
  bgmAudioUrl?: string;
  actionContent?: string;
  characters?: import('../entities/models').Character[];
  background?: import('../entities/models').Background;
  videoStyle?: string;
  aigcWatermark?: boolean;
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
  createAgentTask(context: VideoAgentContext): Promise<string>;
  queryAgentTask(taskId: string): Promise<VideoAgentTaskResult>;
}

// --- Video Agent ---

export interface VideoAgentTextInput {
  value: string;
}

export interface VideoAgentMediaInput {
  value: string;
}

export interface VideoAgentContext {
  templateId: string;
  textInputs?: VideoAgentTextInput[];
  mediaInputs?: VideoAgentMediaInput[];
  callbackUrl?: string;
}

export interface VideoAgentTaskResult {
  status: 'Preparing' | 'Processing' | 'Success' | 'Fail';
  videoUrl?: string;
  errorMessage?: string;
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

export type T2ASyncModel = 'speech-2.8-hd' | 'speech-2.8-turbo' | 'speech-2.6-hd' | 'speech-2.6-turbo' | 'speech-02-hd' | 'speech-02-turbo' | 'speech-01-hd' | 'speech-01-turbo';

export interface VoiceModify {
  pitch?: number;
  intensity?: number;
  timbre?: number;
  sound_effects?: string;
}

export interface PronunciationDict {
  tone: string[];
}

export interface VoiceSubtitle {
  text: string;
  startTime: number;
  endTime: number;
}

export interface VoiceCloneContext {
  fileId: string;
  voiceId: string;
  text?: string;
  model?: string;
  promptAudioFileId?: string;
  promptText?: string;
  languageBoost?: string;
  needNoiseReduction?: boolean;
  needVolumeNormalization?: boolean;
  aigcWatermark?: boolean;
}

export interface VoiceCloneResult {
  voiceId: string;
  previewAudioUrl?: string;
  previewAudioHex?: string;
  inputSensitive?: boolean;
  inputSensitiveType?: number;
  usageCharacters?: number;
  audioLength?: number;
}

export interface T2AAsyncContext {
  text?: string;
  textFileId?: string;
  voiceId: string;
  model?: string;
  speed?: number;
  vol?: number;
  pitch?: number;
  audioFormat?: string;
  sampleRate?: number;
  channel?: number;
  languageBoost?: string;
  pronunciationDict?: PronunciationDict;
  voiceModify?: VoiceModify;
  aigcWatermark?: boolean;
}

export interface T2AAsyncResult {
  taskId: string;
  taskToken?: string;
  fileId?: string;
  usageCharacters?: number;
}

export interface T2AAsyncStatus {
  status: 'processing' | 'success' | 'failed' | 'expired';
  fileId?: string;
  audioUrl?: string;
  audioDuration?: number;
  errorMessage?: string;
}

export interface T2ASyncContext {
  model?: T2ASyncModel;
  text: string;
  voiceId: string;
  speed?: number;
  volume?: number;
  pitch?: number;
  emotion?: string;
  audioFormat?: string;
  sampleRate?: number;
  stream?: boolean;
  outputFormat?: 'hex' | 'url';
  languageBoost?: string;
  aigcWatermark?: boolean;
  pronunciationDict?: PronunciationDict;
  voiceModify?: VoiceModify;
  subtitleEnable?: boolean;
  subtitleType?: 'sentence' | 'word' | 'word_streaming';
  channel?: number;
}

export interface T2ASyncResult {
  audioHex?: string;
  audioUrl?: string;
  audioLength?: number;
  audioSize?: number;
  usageCharacters?: number;
  subtitles?: VoiceSubtitle[];
}

export interface VoiceDesignResult {
  voiceId: string;
  trialAudioHex: string;
}

export type VoiceType = 'system' | 'voice_cloning' | 'voice_generation' | 'all';

export interface VoiceInfo {
  voiceId: string;
  description: string;
  voiceName: string;
  createdTime?: string;
  type: 'system' | 'voice_cloning' | 'voice_generation';
  isActive?: boolean;
  usedByCharacters?: string[];
}

export interface VoiceListResult {
  systemVoices?: VoiceInfo[];
  clonedVoices?: VoiceInfo[];
  designedVoices?: VoiceInfo[];
}

export interface FileUploadResult {
  fileId: string;
}

export interface T2AStreamCallbacks {
  onAudioChunk: (chunk: ArrayBuffer) => void;
  onComplete?: (totalLength?: number) => void;
  onError?: (error: Error) => void;
  onSubtitle?: (subtitle: VoiceSubtitle) => void;
}

export interface T2AStreamHandle {
  close: () => void;
  sendText?: (text: string) => void;
  finish?: () => void;
}

export interface IVoicePort {
  uploadFile(file: File, purpose: 'voice_clone' | 'prompt_audio' | 't2a_async_input'): Promise<FileUploadResult>;
  cloneVoice(context: VoiceCloneContext): Promise<VoiceCloneResult>;
  createT2ATask(context: T2AAsyncContext): Promise<T2AAsyncResult>;
  queryT2ATask(taskId: string): Promise<T2AAsyncStatus>;
  getFileUrl(fileId: string): string;
  /** 带 Bearer 认证下载音频文件，返回 Blob URL（可直接用于 <audio> 播放和下载） */
  fetchAudioAsBlobUrl(audioUrl: string): Promise<string>;
  synthesizeSpeechSync(context: T2ASyncContext): Promise<T2ASyncResult>;
  designVoice(prompt: string, previewText: string, voiceId?: string, aigcWatermark?: boolean): Promise<VoiceDesignResult>;
  getAvailableVoices(voiceType: VoiceType): Promise<VoiceListResult>;
  deleteVoice(voiceType: 'voice_cloning' | 'voice_generation', voiceId: string): Promise<void>;
  /** WebSocket 流式合成 — 边生成边推送音频块。返回 handle 用于中止 */
  synthesizeSpeechStream(context: T2ASyncContext, callbacks: T2AStreamCallbacks): T2AStreamHandle;
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

// --- Model Management ---

export interface ModelInfo {
  id: string;
  createdAt: string;
  displayName: string;
  type: string;
}

export interface ModelListResult {
  models: ModelInfo[];
  firstId?: string;
  lastId?: string;
  hasMore: boolean;
}

export interface IModelManagementPort {
  listModels(limit?: number, afterId?: string): Promise<ModelListResult>;
  retrieveModel(modelId: string): Promise<ModelInfo>;
}

// --- File Management ---

export interface FileItem {
  fileId: string;
  filename: string;
  bytes: number;
  purpose: string;
  createdAt: number;
}

export interface FileListResult {
  files: FileItem[];
  hasMore: boolean;
}

export interface IFileManagementPort {
  listFiles(purpose?: string, limit?: number): Promise<FileListResult>;
  deleteFile(fileId: string): Promise<void>;
}
