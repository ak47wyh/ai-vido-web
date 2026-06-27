import type { ISavedImageRepository, ISavedVoiceRepository, ISavedPromptRepository, AssetQueryParams } from '../ports/AssetLibraryPorts';
import type { IFileStoragePort, IGeneratedFileRepository } from '../ports/FileStoragePorts';
import type { SavedImage, SavedVoice, SavedPrompt, SavedImageSource, SavedVoiceSource, PromptCategory, SavedPromptSource, GeneratedFile } from '../entities/models';

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
  private getFileStorage: () => IFileStoragePort;
  private getFileRepo: () => IGeneratedFileRepository;

  constructor(
    imageRepo: ISavedImageRepository,
    voiceRepo: ISavedVoiceRepository,
    promptRepo: ISavedPromptRepository,
    fileStorage: IFileStoragePort | (() => IFileStoragePort),
    fileRepo: IGeneratedFileRepository | (() => IGeneratedFileRepository),
  ) {
    this.imageRepo = imageRepo;
    this.voiceRepo = voiceRepo;
    this.promptRepo = promptRepo;
    // 支持直接传入实例或延迟获取函数
    this.getFileStorage = typeof fileStorage === 'function' ? fileStorage : () => fileStorage;
    this.getFileRepo = typeof fileRepo === 'function' ? fileRepo : () => fileRepo;
  }

  // ===== Image Assets =====

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
    const fileStorage = this.getFileStorage();
    const fileRepo = this.getFileRepo();
    const id = generateId();
    const storagePath = `images/${id}`;

    // Fetch URL → Blob
    const response = await fetch(params.imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    const blob = await response.blob();

    // 写入 OPFS
    await fileStorage.storeBlob(storagePath, blob);

    // 注册文件元数据
    await this.registerFile(fileRepo, {
      id: `file_${id}`,
      spaceId: params.spaceId,
      fileType: 'image',
      mimeType: blob.type || 'image/png',
      fileName: `${params.name || id}.png`,
      fileSize: blob.size,
      storagePath,
      originalUrl: params.imageUrl,
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
    const fileStorage = this.getFileStorage();
    const fileRepo = this.getFileRepo();
    const id = generateId();
    const storagePath = `images/${id}`;

    // 写入 OPFS
    await fileStorage.storeBlob(storagePath, params.blob);

    // 注册文件元数据
    await this.registerFile(fileRepo, {
      id: `file_${id}`,
      spaceId: params.spaceId,
      fileType: 'image',
      mimeType: params.blob.type || 'image/png',
      fileName: `${params.name || id}.png`,
      fileSize: params.blob.size,
      storagePath,
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
  getStorageType(): 'opfs' | 'indexeddb' {
    return this.getFileStorage().getStorageType();
  }

  // ===== Private helpers =====

  private async registerFile(fileRepo: IGeneratedFileRepository, params: {
    id: string;
    spaceId: string;
    fileType: 'image' | 'audio';
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
