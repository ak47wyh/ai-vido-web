import type { IModelManagementPort, ModelInfo } from '../ports/OutboundPorts';

const CACHE_KEY = 'minimax_cached_models';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CachedModels {
  models: ModelInfo[];
  cachedAt: number;
}

export class ModelManagementService {
  private modelPort: IModelManagementPort;

  constructor(modelPort: IModelManagementPort) {
    this.modelPort = modelPort;
  }

  /**
   * Fetch all models from API (handles pagination).
   */
  async fetchModels(): Promise<ModelInfo[]> {
    const allModels: ModelInfo[] = [];
    let afterId: string | undefined;

    do {
      const result = await this.modelPort.listModels(100, afterId);
      allModels.push(...result.models);
      afterId = result.hasMore ? result.lastId : undefined;
    } while (afterId);

    // Cache the result
    const cached: CachedModels = { models: allModels, cachedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));

    return allModels;
  }

  /**
   * Get models from cache if valid, otherwise fetch from API.
   */
  async getModels(): Promise<ModelInfo[]> {
    const cached = this.getCachedModelsInternal();
    if (cached) return cached.models;
    return this.fetchModels();
  }

  /**
   * Force refresh models from API.
   */
  async refreshModels(): Promise<ModelInfo[]> {
    return this.fetchModels();
  }

  /**
   * Get cached models info (models + cachedAt timestamp).
   */
  getCachedModels(): CachedModels | null {
    return this.getCachedModelsInternal();
  }

  /**
   * Check if a specific model is available.
   */
  async isModelAvailable(modelId: string): Promise<boolean> {
    const models = await this.getModels();
    return models.some(m => m.id === modelId);
  }

  /**
   * Get text generation models (from API).
   */
  async getTextModels(): Promise<ModelInfo[]> {
    const models = await this.getModels();
    return models.filter(m => m.type === 'text' || m.id.startsWith('MiniMax-'));
  }

  /**
   * Static video models (API does not provide these).
   */
  getStaticVideoModels(): ModelInfo[] {
    return [
      { id: 'MiniMax-Hailuo-2.3', createdAt: '', displayName: 'Hailuo 2.3', type: 'video' },
      { id: 'MiniMax-Hailuo-02', createdAt: '', displayName: 'Hailuo 02', type: 'video' },
      { id: 'T2V-01-Director', createdAt: '', displayName: 'T2V-01 Director', type: 'video' },
      { id: 'T2V-01', createdAt: '', displayName: 'T2V-01', type: 'video' },
      { id: 'S2V-01', createdAt: '', displayName: 'S2V-01', type: 'video' },
    ];
  }

  /**
   * Static image models (API does not provide these).
   */
  getStaticImageModels(): ModelInfo[] {
    return [
      { id: 'image-01', createdAt: '', displayName: 'Image-01', type: 'image' },
      { id: 'image-01-live', createdAt: '', displayName: 'Image-01 Live', type: 'image' },
    ];
  }

  /**
   * Static music models (API does not provide these).
   */
  getStaticMusicModels(): ModelInfo[] {
    return [
      { id: 'music-2.6', createdAt: '', displayName: 'Music 2.6', type: 'music' },
      { id: 'music-2.6-free', createdAt: '', displayName: 'Music 2.6 Free', type: 'music' },
      { id: 'music-cover', createdAt: '', displayName: 'Music Cover', type: 'music' },
      { id: 'music-cover-free', createdAt: '', displayName: 'Music Cover Free', type: 'music' },
    ];
  }

  private getCachedModelsInternal(): CachedModels | null {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const cached: CachedModels = JSON.parse(raw);
      if (Date.now() - cached.cachedAt > CACHE_TTL_MS) return null;
      return cached;
    } catch {
      return null;
    }
  }
}
