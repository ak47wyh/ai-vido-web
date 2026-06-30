/**
 * useVideoImport —— 视频上传导入 hook
 *
 * 串联完整上传链路（PRD F-03 ~ F-06）：
 *   校验格式/体积/空间 → 探测元数据(duration/width/height) → 抽帧缩略图 → 落盘入库
 *
 * 元数据探测用 HTMLVideoElement.onloadedmetadata（轻量，无需 FFmpeg）。
 * 缩略图抽帧用 ffmpegAdapter.extractFrame（从 durationSec*0.25 处取 PNG）。
 * 落盘用 assetLibraryService.saveVideoFromBlob（sourceType: 'import'）。
 */

import { useCallback, useState } from 'react';
import { assetLibraryService, ffmpegAdapter } from '../../dependencies';
import type { SavedVideo } from '../../domain/entities/models';

// ===== 常量（PRD §F-03 / §7.1 / §7.2）=====
const MAX_VIDEO_SIZE_MB = 500;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
const VALID_EXTENSIONS = ['mp4', 'webm', 'mov'];
const VALID_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-quicktime',
];
/** 缩略图抽帧位置：时长 25% 处（避开黑场开头与结尾字幕区） */
const THUMBNAIL_POSITION_RATIO = 0.25;
/** 空间冗余系数（落盘含元数据等额外开销） */
const SPACE_REDUNDANCY_FACTOR = 1.1;

export type VideoImportState =
  | 'idle'
  | 'validating'
  | 'probing'
  | 'extracting'
  | 'saving'
  | 'success'
  | 'error';

export interface VideoImportResult {
  state: VideoImportState;
  /** 0~100 */
  progress: number;
  error: string | null;
  importedName: string | null;
  importedVideo: SavedVideo | null;
  /** 导入视频（校验 → 探测 → 抽帧 → 落盘） */
  importVideo: (file: File, spaceId: string) => Promise<SavedVideo | null>;
  /** 重置到 idle 态 */
  reset: () => void;
}

/**
 * 校验视频文件格式与体积（PRD F-03）。
 * 返回 null 表示通过，否则返回错误消息 key（由调用方翻译）。
 */
function validateVideoFile(file: File): { key: string; params?: Record<string, number | string> } | null {
  // 格式校验：MIME 或扩展名任一命中即可
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeOk = VALID_MIME_TYPES.some(t => file.type === t || file.type.includes(t.split('/')[1]));
  const extOk = VALID_EXTENSIONS.includes(ext);
  if (!mimeOk && !extOk) {
    return { key: 'editor.media.import.unsupportedFormat' };
  }
  // 体积校验
  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    return {
      key: 'editor.media.import.tooLarge',
      params: { size: Math.round(file.size / 1024 / 1024) },
    };
  }
  return null;
}

/** 检查 OPFS 可用空间（PRD §7.2） */
async function checkStorageSpace(fileSize: number): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return true;
  try {
    const est = await navigator.storage.estimate();
    if (!est.quota) return true;
    const remaining = est.quota - (est.usage ?? 0);
    return remaining >= fileSize * SPACE_REDUNDANCY_FACTOR;
  } catch {
    return true; // 探测失败不阻塞（降级乐观）
  }
}

/**
 * 探测视频元数据：duration / width / height（PRD F-04）。
 * 用 HTMLVideoElement.onloadedmetadata，不依赖 FFmpeg。
 * 返回 null 表示探测失败（文件可能损坏）。
 */
function probeVideoMetadata(blob: Blob): Promise<{ durationSec: number; width: number; height: number } | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const width = video.videoWidth || 0;
      const height = video.videoHeight || 0;
      if (duration <= 0 && width === 0) {
        resolve(null);
      } else {
        resolve({ durationSec: Math.round(duration * 10) / 10, width, height });
      }
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}

export function useVideoImport(): VideoImportResult {
  const [state, setState] = useState<VideoImportState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [importedName, setImportedName] = useState<string | null>(null);
  const [importedVideo, setImportedVideo] = useState<SavedVideo | null>(null);

  const reset = useCallback(() => {
    setState('idle');
    setProgress(0);
    setError(null);
    setImportedName(null);
    setImportedVideo(null);
  }, []);

  const importVideo = useCallback(async (file: File, spaceId: string): Promise<SavedVideo | null> => {
    // 阶段 1：校验（PRD F-03）
    setState('validating');
    setProgress(5);
    setError(null);
    setImportedName(file.name);

    const validationError = validateVideoFile(file);
    if (validationError) {
      setState('error');
      setError(validationError.key);
      return null;
    }

    // 存储空间预检
    const hasSpace = await checkStorageSpace(file.size);
    if (!hasSpace) {
      setState('error');
      setError('editor.media.import.insufficientSpace');
      return null;
    }

    // 阶段 2：探测元数据（PRD F-04）
    setState('probing');
    setProgress(15);
    const meta = await probeVideoMetadata(file);
    if (!meta) {
      setState('error');
      setError('editor.media.import.metadataFailed');
      return null;
    }

    // 阶段 3：抽帧缩略图（PRD F-04，从 25% 处抽 PNG）
    setState('extracting');
    setProgress(35);
    let thumbnailBlob: Blob | undefined;
    try {
      const frameSec = Math.max(0.1, meta.durationSec * THUMBNAIL_POSITION_RATIO);
      thumbnailBlob = await ffmpegAdapter.extractFrame(file, frameSec, 'png');
      setProgress(55);
    } catch {
      // 缩略图失败不阻塞主流程（PRD §7.1）
      thumbnailBlob = undefined;
    }

    // 阶段 4：落盘入库（PRD F-05）
    setState('saving');
    setProgress(65);
    const name = file.name.replace(/\.[^.]+$/, ''); // 去扩展名
    try {
      const saved = await assetLibraryService.saveVideoFromBlob({
        spaceId,
        name,
        blob: file,
        durationSec: meta.durationSec,
        width: meta.width || undefined,
        height: meta.height || undefined,
        mimeType: file.type || 'video/mp4',
        tags: ['imported'],
        sourceType: 'import',
        thumbnailBlob,
      });
      setProgress(100);
      setState('success');
      setImportedVideo(saved);
      return saved;
    } catch (e) {
      setState('error');
      setError(e instanceof Error ? e.message : 'editor.media.import.failed');
      return null;
    }
  }, []);

  return {
    state,
    progress,
    error,
    importedName,
    importedVideo,
    importVideo,
    reset,
  };
}
