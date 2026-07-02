/**
 * useLinkImport —— 视频链接导入 hook
 *
 * 串联完整导入链路（PRD §3.2 / §4.2）：
 *   解析（直链无需解析 / 抖音分享链接）→ 下载 → 探测元数据 → 抽帧缩略图 → 落盘入库
 *
 * 复用了 useVideoImport 的探测/抽帧/入库步骤。
 */

import { useCallback, useState } from 'react';
import { assetLibraryService, videoAddressResolver, ffmpegAdapter } from '../../dependencies';
import { detectVideoAddressType, fetchVideoAsFile, extractFileNameFromUrl } from '../utils/videoAddress';
import type { SavedVideo } from '../../domain/entities/models';
import type { VideoAddressType } from '../../domain/ports/WatermarkRemovalPorts';

// ===== 常量（PRD §3.3 / §7.1）=====
const MAX_VIDEO_SIZE_MB = 500;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
const THUMBNAIL_POSITION_RATIO = 0.25;
const SPACE_REDUNDANCY_FACTOR = 1.1;
const URL_MAX_LENGTH = 2048;

export type LinkImportState =
  | 'idle'
  | 'parsing'
  | 'downloading'
  | 'validating'
  | 'probing'
  | 'extracting'
  | 'saving'
  | 'success'
  | 'error';

export interface LinkImportResult {
  state: LinkImportState;
  /** 0~100 */
  progress: number;
  error: string | null;
  importedName: string | null;
  importedVideo: SavedVideo | null;
  /** 当前输入的 URL */
  currentUrl: string;
  /** 检测到的平台 */
  detectedPlatform: string | null;
  /** 导入视频（链接 → 下载 → 入库） */
  importFromUrl: (url: string, spaceId: string) => Promise<SavedVideo | null>;
  /** 重置到 idle 态 */
  reset: () => void;
  /** 检测 URL 类型并更新 detectedPlatform */
  detectUrl: (url: string) => VideoAddressType;
}

/** 平台显示名称映射 */
function getPlatformName(type: VideoAddressType | string): string {
  switch (type) {
    case 'direct': return '直链视频';
    case 'douyin': return '抖音视频';
    case 'bilibili': return 'B站视频';
    case 'xiaohongshu': return '小红书视频';
    case 'youtube': return 'YouTube 视频';
    default: return '视频链接';
  }
}

/** 检查 OPFS 可用空间 */
async function checkStorageSpace(fileSize: number): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return true;
  try {
    const est = await navigator.storage.estimate();
    if (!est.quota) return true;
    const remaining = est.quota - (est.usage ?? 0);
    return remaining >= fileSize * SPACE_REDUNDANCY_FACTOR;
  } catch {
    return true;
  }
}

/** 探测视频元数据 */
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

/**
 * 校验视频文件大小（PRD §3.3 FR-3.6）。
 * 返回 null 表示通过，否则返回错误消息 key。
 */
function validateVideoSize(size: number): { key: string; params?: Record<string, number | string> } | null {
  if (size > MAX_VIDEO_SIZE_BYTES) {
    return {
      key: 'editor.media.import.tooLarge',
      params: { size: Math.round(size / 1024 / 1024) },
    };
  }
  return null;
}

export function useLinkImport(): LinkImportResult {
  const [state, setState] = useState<LinkImportState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [importedName, setImportedName] = useState<string | null>(null);
  const [importedVideo, setImportedVideo] = useState<SavedVideo | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null);

  const reset = useCallback(() => {
    setState('idle');
    setProgress(0);
    setError(null);
    setImportedName(null);
    setImportedVideo(null);
    setDetectedPlatform(null);
  }, []);

  /**
   * 检测 URL 类型并更新 detectedPlatform
   */
  const detectUrl = useCallback((url: string): VideoAddressType => {
    setCurrentUrl(url);
    if (!url.trim()) {
      setDetectedPlatform(null);
      return 'share';
    }
    const type = detectVideoAddressType(url);
    const platform = getPlatformName(type);
    setDetectedPlatform(platform);
    return type;
  }, []);

  const importFromUrl = useCallback(async (url: string, spaceId: string): Promise<SavedVideo | null> => {
    const trimmed = url.trim();
    if (!trimmed) {
      setState('error');
      setError('请输入视频链接');
      return null;
    }

    if (trimmed.length > URL_MAX_LENGTH) {
      setState('error');
      setError('editor.media.import.urlTooLong');
      return null;
    }

    setState('parsing');
    setProgress(5);
    setError(null);
    setImportedName(extractFileNameFromUrl(trimmed));
    setCurrentUrl(trimmed);

    let resolvedUrl: string;
    let platform: string;

    try {
      // 步骤1：解析链接（直链直接返回，分享链接走 videoAddressResolver）
      const resolved = await videoAddressResolver.resolve(trimmed);
      resolvedUrl = resolved.directUrl;
      platform = resolved.sourcePlatform || 'direct';
      setDetectedPlatform(getPlatformName(platform));
    } catch (e) {
      setState('error');
      setError(e instanceof Error ? e.message : 'editor.media.import.resolveFailed');
      return null;
    }

    // 步骤2：下载视频
    setState('downloading');
    setProgress(20);
    let file: File;
    try {
      file = await fetchVideoAsFile(resolvedUrl);
    } catch (e) {
      setState('error');
      const isCors = e instanceof Error && (e.message.includes('CORS') || e.message.includes('cors') || e.message.includes('跨域'));
      const errorMsg = isCors 
        ? '该链接无法直接下载（跨域限制），请先下载到本地后通过本地上传导入'
        : (e instanceof Error ? e.message : 'editor.media.import.downloadFailed');
      setError(errorMsg);
      return null;
    }

    // 步骤3：校验文件大小（PRD §3.3 FR-3.6）
    setState('validating');
    setProgress(40);
    const sizeError = validateVideoSize(file.size);
    if (sizeError) {
      setState('error');
      setError(sizeError.key);
      return null;
    }

    const hasSpace = await checkStorageSpace(file.size);
    if (!hasSpace) {
      setState('error');
      setError('editor.media.import.insufficientSpace');
      return null;
    }

    // 步骤4：探测元数据
    setState('probing');
    setProgress(55);
    const meta = await probeVideoMetadata(file);
    if (!meta) {
      setState('error');
      setError('editor.media.import.metadataFailed');
      return null;
    }

    // 步骤5：抽帧缩略图
    setState('extracting');
    setProgress(70);
    let thumbnailBlob: Blob | undefined;
    try {
      const frameSec = Math.max(0.1, meta.durationSec * THUMBNAIL_POSITION_RATIO);
      thumbnailBlob = await ffmpegAdapter.extractFrame(file, frameSec, 'png');
      setProgress(85);
    } catch {
      thumbnailBlob = undefined;
    }

    // 步骤6：落盘入库
    setState('saving');
    setProgress(90);
    const name = importedName?.replace(/\.[^.]+$/, '') || extractFileNameFromUrl(resolvedUrl).replace(/\.[^.]+$/, '');
    try {
      const saved = await assetLibraryService.saveVideoFromBlob({
        spaceId,
        name,
        blob: file,
        durationSec: meta.durationSec,
        width: meta.width || undefined,
        height: meta.height || undefined,
        mimeType: file.type || 'video/mp4',
        tags: ['imported', platform],
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
  }, [importedName]);

  return {
    state,
    progress,
    error,
    importedName,
    importedVideo,
    currentUrl,
    detectedPlatform,
    importFromUrl,
    reset,
    // 暴露 detectUrl 供外部调用（如 Input onChange）
    detectUrl,
  };
}