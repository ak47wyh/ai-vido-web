import type { ISavedImageRepository, ISavedVoiceRepository, ISavedPromptRepository, ISavedVideoRepository, AssetQueryParams } from '../ports/AssetLibraryPorts';
import type { IFileStoragePort, IGeneratedFileRepository } from '../ports/FileStoragePorts';
import type { SavedImage, SavedVoice, SavedPrompt, SavedVideo, SavedImageSource, SavedVoiceSource, PromptCategory, SavedPromptSource, SavedVideoSource, GeneratedFile, GeneratedFileType } from '../entities/models';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 素材库服务 — 管理用户保存的图片、语音、提示词资产。
 *
 * 二进制文件通过 IFileStoragePort 存储（OPFS 或 IndexedDB 降级），
 * 元数据通过 Dexie 仓储持久化。
 *
 * fileStorage 和 fileRepo 支持延迟获取（lazy accessor），
 * 允许在 DI 容器异步初始化完成前构造本服务。
 *
 * 路径约定：
 *   图片 → images/{id}
 *   语音 → audio/{id}
 */
export class AssetLibraryService {
  private imageRepo: ISavedImageRepository;
  private voiceRepo: ISavedVoiceRepository;
  private promptRepo: ISavedPromptRepository;
  private videoRepo: ISavedVideoRepository;
  private getFileStorage: () => IFileStoragePort;
  private getFileRepo: () => IGeneratedFileRepository;

  constructor(
    imageRepo: ISavedImageRepository,
    voiceRepo: ISavedVoiceRepository,
    promptRepo: ISavedPromptRepository,
    videoRepo: ISavedVideoRepository,
    fileStorage: IFileStoragePort | (() => IFileStoragePort),
    fileRepo: IGeneratedFileRepository | (() => IGeneratedFileRepository),
  ) {
    this.imageRepo = imageRepo;
    this.voiceRepo = voiceRepo;
    this.promptRepo = promptRepo;
    this.videoRepo = videoRepo;
    // 支持直接传入实例或延迟获取函数
    this.getFileStorage = typeof fileStorage === 'function' ? fileStorage : () => fileStorage;
    this.getFileRepo = typeof fileRepo === 'function' ? fileRepo : () => fileRepo;
  }

  // ===== Image Assets =====

  /**
   * 把 data URI（"data:image/png;base64,..."）解码为 Blob。
   * 不调用任何外部 API，纯 atob + Uint8Array。
   */
  private dataUriToBlob(dataUri: string): Blob {
    const m = /^data:([^;]+)(;base64)?,(.*)$/s.exec(dataUri);
    if (!m) {
      throw new Error(`[AssetLibrary] 不是合法的 data URI: ${dataUri.slice(0, 60)}...`);
    }
    const mime = m[1] || 'application/octet-stream';
    const isBase64 = !!m[2];
    const payload = m[3];
    if (isBase64) {
      const bytes = atob(payload);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      return new Blob([arr], { type: mime });
    }
    return new Blob([decodeURIComponent(payload)], { type: mime });
  }

  /**
   * 保存图片到素材库。
   *
   * imageUrl 接受两种来源：
   *   1. data URI（"data:image/png;base64,..."）—— 直接解码为 Blob 后写入，
   *      不发起任何外部请求，**规避 CORS**。绝大多数图片生成 API 都支持
   *      base64 返回，这是首选方式。
   *   2. http(s) URL —— 仅在浏览器能直接 fetch（无 CORS 限制）时使用；
   *      否则抛出明确错误，引导调用方改传 Blob 或 data URI。
   */
  async saveImageFromUrl(params: {
    spaceId: string;
    name: string;
    imageUrl: string;
    prompt: string;
    model: string;
    aspectRatio: string;
    tags?: string[];
    sourceType: SavedImageSource;
    sourceId?: string;
  }): Promise<SavedImage> {
    let blob: Blob;
    let mime: string;

    if (params.imageUrl.startsWith('data:')) {
      // 走纯客户端解码，0 网络请求，0 CORS 风险
      blob = this.dataUriToBlob(params.imageUrl);
      mime = blob.type || 'image/png';
    } else if (params.imageUrl.startsWith('blob:')) {
      // 浏览器内 Object URL：调用方应该已经拿到 Blob，建议改用 saveImageFromBlob
      // 这里做兼容处理
      throw new Error(
        '[AssetLibrary] imageUrl 是 blob: URL（仅在浏览器会话内有效）。' +
        '请改用 saveImageFromBlob 直接传入 Blob。'
      );
    } else if (/^https?:\/\//.test(params.imageUrl)) {
      // 外部 URL：尝试 fetch，但很可能因 CORS 失败
      try {
        const response = await fetch(params.imageUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        blob = await response.blob();
        mime = blob.type || 'image/png';
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        throw new Error(
          `[AssetLibrary] 无法从 "${params.imageUrl.slice(0, 80)}..." 拉取图片：${reason}。` +
          `外部图片 URL（OSS/云存储）通常被 CORS 策略阻断。` +
          `解决方案：① 让图片生成 API 直接返回 base64 / data URI；② 在生成时把 Blob 缓存下来后用 saveImageFromBlob 保存。`,
          { cause: e }
        );
      }
    } else {
      throw new Error(`[AssetLibrary] 无法识别的 imageUrl 协议：${params.imageUrl.slice(0, 60)}...`);
    }

    return this.persistImageBlob({
      spaceId: params.spaceId,
      name: params.name,
      blob,
      mime,
      prompt: params.prompt,
      model: params.model,
      aspectRatio: params.aspectRatio,
      tags: params.tags,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      originalUrl: params.imageUrl,
    });
  }

  /** 内部共享：把 Blob 写入 fileStorage 并注册元数据。 */
  private async persistImageBlob(params: {
    spaceId: string;
    name: string;
    blob: Blob;
    mime: string;
    prompt: string;
    model: string;
    aspectRatio: string;
    tags?: string[];
    sourceType: SavedImageSource;
    sourceId?: string;
    originalUrl?: string;
  }): Promise<SavedImage> {
    const fileStorage = this.getFileStorage();
    const fileRepo = this.getFileRepo();
    const id = generateId();
    const storagePath = `images/${id}`;

    await fileStorage.storeBlob(storagePath, params.blob);

    await this.registerFile(fileRepo, {
      id: `file_${id}`,
      spaceId: params.spaceId,
      fileType: 'image',
      mimeType: params.mime,
      fileName: `${params.name || id}.png`,
      fileSize: params.blob.size,
      storagePath,
      originalUrl: params.originalUrl,
      sourceEntityType: 'saved_image',
      sourceEntityId: id,
      tags: params.tags || [],
    });

    const item: SavedImage = {
      id,
      spaceId: params.spaceId,
      name: params.name,
      prompt: params.prompt,
      model: params.model,
      aspectRatio: params.aspectRatio,
      blobKey: storagePath,
      tags: params.tags || [],
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      createdAt: Date.now(),
    };

    await this.imageRepo.save(item);
    return item;
  }

  async saveImageFromBlob(params: {
    spaceId: string;
    name: string;
    blob: Blob;
    prompt: string;
    model: string;
    aspectRatio: string;
    tags?: string[];
    sourceType: SavedImageSource;
    sourceId?: string;
  }): Promise<SavedImage> {
    return this.persistImageBlob({
      spaceId: params.spaceId,
      name: params.name,
      blob: params.blob,
      mime: params.blob.type || 'image/png',
      prompt: params.prompt,
      model: params.model,
      aspectRatio: params.aspectRatio,
      tags: params.tags,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
    });
  }

  async getImageBlobUrl(savedImage: SavedImage): Promise<string> {
    const fileStorage = this.getFileStorage();
    return fileStorage.getObjectUrl(savedImage.blobKey);
  }

  async queryImages(params: AssetQueryParams): Promise<SavedImage[]> {
    return this.imageRepo.query(params);
  }

  async deleteImage(id: string): Promise<void> {
    const fileStorage = this.getFileStorage();
    const fileRepo = this.getFileRepo();
    const item = await this.imageRepo.getById(id);
    if (item) {
      await fileStorage.deleteBlob(item.blobKey);
      await fileRepo.delete(`file_${id}`);
      if (item.thumbnailBlobKey) {
        await fileStorage.deleteBlob(item.thumbnailBlobKey);
      }
      await this.imageRepo.delete(id);
    }
  }

  // ===== Voice Assets =====

  async saveVoiceFromUrl(params: {
    spaceId: string;
    name: string;
    audioUrl: string;
    voiceId: string;
    model: string;
    speed: number;
    sampleText: string;
    tags?: string[];
    sourceType: SavedVoiceSource;
    sourceId?: string;
  }): Promise<SavedVoice> {
    const fileStorage = this.getFileStorage();
    const fileRepo = this.getFileRepo();
    const id = generateId();
    const storagePath = `audio/${id}`;

    const response = await fetch(params.audioUrl);
    if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`);
    const blob = await response.blob();

    await fileStorage.storeBlob(storagePath, blob);

    await this.registerFile(fileRepo, {
      id: `file_${id}`,
      spaceId: params.spaceId,
      fileType: 'audio',
      mimeType: blob.type || 'audio/mpeg',
      fileName: `${params.name || id}.mp3`,
      fileSize: blob.size,
      storagePath,
      originalUrl: params.audioUrl,
      sourceEntityType: 'saved_voice',
      sourceEntityId: id,
      tags: params.tags || [],
    });

    const item: SavedVoice = {
      id,
      spaceId: params.spaceId,
      name: params.name,
      voiceId: params.voiceId,
      model: params.model,
      speed: params.speed,
      sampleText: params.sampleText,
      audioBlobKey: storagePath,
      tags: params.tags || [],
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      createdAt: Date.now(),
    };

    await this.voiceRepo.save(item);
    return item;
  }

  async saveVoiceFromBlob(params: {
    spaceId: string;
    name: string;
    blob: Blob;
    voiceId: string;
    model: string;
    speed: number;
    sampleText: string;
    tags?: string[];
    sourceType: SavedVoiceSource;
    sourceId?: string;
  }): Promise<SavedVoice> {
    const fileStorage = this.getFileStorage();
    const fileRepo = this.getFileRepo();
    const id = generateId();
    const storagePath = `audio/${id}`;

    await fileStorage.storeBlob(storagePath, params.blob);

    await this.registerFile(fileRepo, {
      id: `file_${id}`,
      spaceId: params.spaceId,
      fileType: 'audio',
      mimeType: params.blob.type || 'audio/mpeg',
      fileName: `${params.name || id}.mp3`,
      fileSize: params.blob.size,
      storagePath,
      sourceEntityType: 'saved_voice',
      sourceEntityId: id,
      tags: params.tags || [],
    });

    const item: SavedVoice = {
      id,
      spaceId: params.spaceId,
      name: params.name,
      voiceId: params.voiceId,
      model: params.model,
      speed: params.speed,
      sampleText: params.sampleText,
      audioBlobKey: storagePath,
      tags: params.tags || [],
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      createdAt: Date.now(),
    };

    await this.voiceRepo.save(item);
    return item;
  }

  async getVoiceBlobUrl(savedVoice: SavedVoice): Promise<string> {
    const fileStorage = this.getFileStorage();
    return fileStorage.getObjectUrl(savedVoice.audioBlobKey);
  }

  async queryVoices(params: AssetQueryParams): Promise<SavedVoice[]> {
    return this.voiceRepo.query(params);
  }

  async deleteVoice(id: string): Promise<void> {
    const fileStorage = this.getFileStorage();
    const fileRepo = this.getFileRepo();
    const item = await this.voiceRepo.getById(id);
    if (item) {
      await fileStorage.deleteBlob(item.audioBlobKey);
      await fileRepo.delete(`file_${id}`);
      await this.voiceRepo.delete(id);
    }
  }

  // ===== Video Assets =====

  /**
   * 保存视频到素材库（渲染产物 / 用户导入统一入口）。
   * 二进制写入 OPFS（video/ 目录），元数据进 Dexie savedVideos。
   * durationSec/width/height 由调用方探测后传入（可用 TimelineRenderService.probeDuration）。
   * thumbnailBlob 可选：若提供则写入 OPFS thumbnails/ 目录并记录 thumbnailBlobKey。
   */
  async saveVideoFromBlob(params: {
    spaceId: string;
    name: string;
    blob: Blob;
    durationSec: number;
    width?: number;
    height?: number;
    mimeType?: string;
    tags?: string[];
    sourceType: SavedVideoSource;
    sourceId?: string;
    thumbnailBlob?: Blob;
  }): Promise<SavedVideo> {
    const fileStorage = this.getFileStorage();
    const fileRepo = this.getFileRepo();
    const id = generateId();
    // MOV 归到 mp4 容器（FFmpeg 渲染时统一转 mp4）；webm 保留扩展名
    const mt = params.mimeType || params.blob.type || 'video/mp4';
    const ext = mt.includes('webm') ? 'webm'
      : (mt.includes('quicktime') || mt.includes('mov')) ? 'mov'
      : 'mp4';
    const storagePath = `video/${id}.${ext}`;
    const mimeType = mt;

    await fileStorage.storeBlob(storagePath, params.blob);

    // 可选缩略图落盘
    let thumbnailBlobKey: string | undefined;
    if (params.thumbnailBlob) {
      thumbnailBlobKey = `thumbnails/video_${id}.png`;
      try {
        await fileStorage.storeBlob(thumbnailBlobKey, params.thumbnailBlob);
      } catch {
        // 缩略图写入失败不阻塞主流程（PRD §7.1：缩略图非关键）
        thumbnailBlobKey = undefined;
      }
    }

    await this.registerFile(fileRepo, {
      id: `file_${id}`,
      spaceId: params.spaceId,
      fileType: 'video',
      mimeType,
      fileName: `${params.name || id}.${ext}`,
      fileSize: params.blob.size,
      storagePath,
      sourceEntityType: 'saved_video',
      sourceEntityId: id,
      tags: params.tags || [],
    });

    const item: SavedVideo = {
      id,
      spaceId: params.spaceId,
      name: params.name,
      durationSec: params.durationSec,
      width: params.width,
      height: params.height,
      mimeType,
      blobKey: storagePath,
      thumbnailBlobKey,
      tags: params.tags || [],
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      createdAt: Date.now(),
    };

    await this.videoRepo.save(item);
    return item;
  }

  async getVideoBlobUrl(savedVideo: SavedVideo): Promise<string> {
    const fileStorage = this.getFileStorage();
    return fileStorage.getObjectUrl(savedVideo.blobKey);
  }

  async queryVideos(params: AssetQueryParams): Promise<SavedVideo[]> {
    return this.videoRepo.query(params);
  }

  async getVideoById(id: string): Promise<SavedVideo | undefined> {
    return this.videoRepo.getById(id);
  }

  async deleteVideo(id: string): Promise<void> {
    const fileStorage = this.getFileStorage();
    const fileRepo = this.getFileRepo();
    const item = await this.videoRepo.getById(id);
    if (item) {
      await fileStorage.deleteBlob(item.blobKey);
      if (item.thumbnailBlobKey) {
        await fileStorage.deleteBlob(item.thumbnailBlobKey);
      }
      await fileRepo.delete(`file_${id}`);
      await this.videoRepo.delete(id);
    }
  }

  // ===== Prompt Assets =====

  async savePrompt(params: {
    spaceId: string;
    name: string;
    content: string;
    category: PromptCategory;
    tags?: string[];
    sourceType: SavedPromptSource;
  }): Promise<SavedPrompt> {
    const id = generateId();

    const item: SavedPrompt = {
      id,
      spaceId: params.spaceId,
      name: params.name,
      content: params.content,
      category: params.category,
      tags: params.tags || [],
      sourceType: params.sourceType,
      createdAt: Date.now(),
    };

    await this.promptRepo.save(item);
    return item;
  }

  async queryPrompts(params: AssetQueryParams): Promise<SavedPrompt[]> {
    return this.promptRepo.query(params);
  }

  async deletePrompt(id: string): Promise<void> {
    await this.promptRepo.delete(id);
  }

  // ===== 文件存储管理 =====

  /** 获取文件存储统计信息 */
  async getStorageStats() {
    return this.getFileStorage().getStats();
  }

  /** 清空文件存储 */
  async clearFileStorage(): Promise<void> {
    await this.getFileStorage().clearAll();
  }

  /** 获取底层存储类型 */
  getStorageType(): 'opfs' | 'indexeddb' | 'local' {
    return this.getFileStorage().getStorageType();
  }

  // ===== Private helpers =====

  private async registerFile(fileRepo: IGeneratedFileRepository, params: {
    id: string;
    spaceId: string;
    fileType: GeneratedFileType;
    mimeType: string;
    fileName: string;
    fileSize: number;
    storagePath: string;
    originalUrl?: string;
    sourceEntityType?: string;
    sourceEntityId?: string;
    tags: string[];
  }): Promise<void> {
    const file: GeneratedFile = {
      id: params.id,
      spaceId: params.spaceId,
      fileType: params.fileType,
      mimeType: params.mimeType,
      fileName: params.fileName,
      fileSize: params.fileSize,
      storagePath: params.storagePath,
      originalUrl: params.originalUrl,
      sourceEntityType: params.sourceEntityType,
      sourceEntityId: params.sourceEntityId,
      tags: params.tags,
      lastAccessedAt: Date.now(),
      createdAt: Date.now(),
    };
    await fileRepo.save(file);
  }
}
