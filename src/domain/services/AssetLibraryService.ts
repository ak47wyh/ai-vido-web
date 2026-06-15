import type { ISavedImageRepository, ISavedVoiceRepository, ISavedPromptRepository, AssetQueryParams } from '../ports/AssetLibraryPorts';
import type { SavedImage, SavedVoice, SavedPrompt, SavedImageSource, SavedVoiceSource, PromptCategory, SavedPromptSource } from '../entities/models';
import { offlineCache } from '../../utils/offlineCache';

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export class AssetLibraryService {
  constructor(
    private imageRepo: ISavedImageRepository,
    private voiceRepo: ISavedVoiceRepository,
    private promptRepo: ISavedPromptRepository,
  ) {}

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
    const id = generateId();
    const blobKey = `asset:image:${id}`;

    // Fetch URL → Blob
    const response = await fetch(params.imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    const blob = await response.blob();

    await offlineCache.setCachedBlob(blobKey, blob);

    const item: SavedImage = {
      id,
      spaceId: params.spaceId,
      name: params.name,
      prompt: params.prompt,
      model: params.model,
      aspectRatio: params.aspectRatio,
      blobKey,
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
    const id = generateId();
    const blobKey = `asset:image:${id}`;

    await offlineCache.setCachedBlob(blobKey, params.blob);

    const item: SavedImage = {
      id,
      spaceId: params.spaceId,
      name: params.name,
      prompt: params.prompt,
      model: params.model,
      aspectRatio: params.aspectRatio,
      blobKey,
      tags: params.tags || [],
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      createdAt: Date.now(),
    };

    await this.imageRepo.save(item);
    return item;
  }

  async getImageBlobUrl(savedImage: SavedImage): Promise<string> {
    const blob = await offlineCache.getCachedBlob(savedImage.blobKey);
    if (!blob) throw new Error(`Image blob not found for key: ${savedImage.blobKey}`);
    return URL.createObjectURL(blob);
  }

  async queryImages(params: AssetQueryParams): Promise<SavedImage[]> {
    return this.imageRepo.query(params);
  }

  async deleteImage(id: string): Promise<void> {
    const item = await this.imageRepo.getById(id);
    if (item) {
      await offlineCache.removeCached(item.blobKey);
      if (item.thumbnailBlobKey) {
        await offlineCache.removeCached(item.thumbnailBlobKey);
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
    const id = generateId();
    const audioBlobKey = `asset:voice:${id}`;

    const response = await fetch(params.audioUrl);
    if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`);
    const blob = await response.blob();

    await offlineCache.setCachedBlob(audioBlobKey, blob);

    const item: SavedVoice = {
      id,
      spaceId: params.spaceId,
      name: params.name,
      voiceId: params.voiceId,
      model: params.model,
      speed: params.speed,
      sampleText: params.sampleText,
      audioBlobKey,
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
    const id = generateId();
    const audioBlobKey = `asset:voice:${id}`;

    await offlineCache.setCachedBlob(audioBlobKey, params.blob);

    const item: SavedVoice = {
      id,
      spaceId: params.spaceId,
      name: params.name,
      voiceId: params.voiceId,
      model: params.model,
      speed: params.speed,
      sampleText: params.sampleText,
      audioBlobKey,
      tags: params.tags || [],
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      createdAt: Date.now(),
    };

    await this.voiceRepo.save(item);
    return item;
  }

  async getVoiceBlobUrl(savedVoice: SavedVoice): Promise<string> {
    const blob = await offlineCache.getCachedBlob(savedVoice.audioBlobKey);
    if (!blob) throw new Error(`Voice blob not found for key: ${savedVoice.audioBlobKey}`);
    return URL.createObjectURL(blob);
  }

  async queryVoices(params: AssetQueryParams): Promise<SavedVoice[]> {
    return this.voiceRepo.query(params);
  }

  async deleteVoice(id: string): Promise<void> {
    const item = await this.voiceRepo.getById(id);
    if (item) {
      await offlineCache.removeCached(item.audioBlobKey);
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
}
