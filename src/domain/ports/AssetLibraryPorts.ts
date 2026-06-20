import type { SavedImage, SavedVoice, SavedPrompt } from '../entities/models';

// --- Query Params ---

export interface AssetQueryParams {
  spaceId: string;
  keyword?: string;
  tags?: string[];
  sourceType?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

// --- Repository Interfaces ---

export interface ISavedImageRepository {
  save(item: SavedImage): Promise<void>;
  getById(id: string): Promise<SavedImage | undefined>;
  query(params: AssetQueryParams): Promise<SavedImage[]>;
  delete(id: string): Promise<void>;
  count(spaceId: string): Promise<number>;
}

export interface ISavedVoiceRepository {
  save(item: SavedVoice): Promise<void>;
  getById(id: string): Promise<SavedVoice | undefined>;
  query(params: AssetQueryParams): Promise<SavedVoice[]>;
  delete(id: string): Promise<void>;
  count(spaceId: string): Promise<number>;
}

export interface ISavedPromptRepository {
  save(item: SavedPrompt): Promise<void>;
  getById(id: string): Promise<SavedPrompt | undefined>;
  query(params: AssetQueryParams): Promise<SavedPrompt[]>;
  delete(id: string): Promise<void>;
  count(spaceId: string): Promise<number>;
}
