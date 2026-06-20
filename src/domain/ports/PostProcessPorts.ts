// --- FFmpeg 后期处理 ---

export type TransitionType = 'fade' | 'fadeblack' | 'fadewhite' | 'wipeleft' | 'wiperight' | 'slideup' | 'slidedown' | 'circlecrop' | 'rectcrop' | 'distance';
export type OutputFormat = 'mp4' | 'webm' | 'mov';

export interface CropOptions {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MergeContext {
  video: Blob;
  audio: Blob;
  audioOffset?: number;
}

export interface SubtitleStyle {
  fontName?: string;
  fontSize?: number;
  primaryColor?: string;
  outlineColor?: string;
  outlineWidth?: number;
  position?: 'top' | 'middle' | 'bottom';
}

export interface VideoClip {
  blob: Blob;
  duration?: number;
  transitionIn?: { type: TransitionType; duration: number };
}

export interface BgmMixConfig {
  voiceVolume: number;
  bgmVolume: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface IFFmpegPort {
  load(): Promise<void>;
  isLoaded(): boolean;
  merge(ctx: MergeContext): Promise<Blob>;
  concat(clips: VideoClip[]): Promise<Blob>;
  burnSubtitles(video: Blob, srt: string, style?: SubtitleStyle): Promise<Blob>;
  mixAudio(voice: Blob, bgm: Blob, config: BgmMixConfig): Promise<Blob>;
  applyTransition(clip1: Blob, clip2: Blob, transition: TransitionType, duration: number): Promise<Blob>;
  compress(video: Blob, crf?: number): Promise<Blob>;
  convertFormat(input: Blob, format: OutputFormat): Promise<Blob>;
  changeSpeed(video: Blob, speed: number): Promise<Blob>;
  trim(video: Blob, startSec: number, endSec: number): Promise<Blob>;
  crop(video: Blob, opts: CropOptions): Promise<Blob>;
  resize(video: Blob, width: number, height: number): Promise<Blob>;
  extractFrame(video: Blob, atSec: number, format?: 'png' | 'jpg'): Promise<Blob>;
  reverse(video: Blob): Promise<Blob>;
  fadeInOut(video: Blob, fadeInSec: number, fadeOutSec: number): Promise<Blob>;
}

// --- 字幕转录 ---

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  confidence?: number;
}

export interface IWhisperPort {
  load(): Promise<void>;
  isLoaded(): boolean;
  transcribe(audio: Blob | string, language?: string): Promise<TranscriptSegment[]>;
}

// --- 时间线 ---

export type TimelineClipType = 'video' | 'audio' | 'subtitle' | 'transition';

export interface TimelineClip {
  id: string;
  type: TimelineClipType;
  trackId: string;
  startTime: number;
  duration: number;
  source?: string;
  text?: string;
  transition?: TransitionType | 'none';
}

export interface TimelineTrack {
  id: string;
  type: 'video' | 'audio' | 'subtitle';
  clips: TimelineClip[];
  muted?: boolean;
  locked?: boolean;
}

export interface TimelineTransition {
  fromClipId: string;
  toClipId: string;
  type: TransitionType;
  duration: number;
}

export interface Timeline {
  id: string;
  storyId: string;
  duration: number;
  tracks: TimelineTrack[];
  transitions: TimelineTransition[];
  createdAt: number;
  updatedAt: number;
}
