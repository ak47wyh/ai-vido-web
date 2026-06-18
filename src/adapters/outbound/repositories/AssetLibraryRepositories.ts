import { db } from './DexieDatabase';
import type { SavedImage, SavedVoice, SavedPrompt } from '../../../domain/entities/models';
import type { ISavedImageRepository, ISavedVoiceRepository, ISavedPromptRepository, AssetQueryParams } from '../../../domain/ports/AssetLibraryPorts';

function applyQuery<T extends { spaceId: string; name: string; tags: string[]; sourceType: string; createdAt: number }>(
  collection: Dexie.Table<T, string>,
  params: AssetQueryParams
): Dexie.Collection<T, string> {
  const query = collection.where('spaceId').equals(params.spaceId);
  // Dexie filter for additional criteria
  return query.filter(item => {
    if (params.keyword && !item.name.toLowerCase().includes(params.keyword.toLowerCase()) && !item.tags.some(t => t.toLowerCase().includes(params.keyword.toLowerCase()))) {
      return false;
    }
    if (params.tags && params.tags.length > 0 && !params.tags.some(t => item.tags.includes(t))) {
      return false;
    }
    if (params.sourceType && item.sourceType !== params.sourceType) {
      return false;
    }
    return true;
  });
}

function applyPromptQuery(
  collection: Dexie.Table<SavedPrompt, string>,
  params: AssetQueryParams
): Dexie.Collection<SavedPrompt, string> {
  const query = collection.where('spaceId').equals(params.spaceId);
  return query.filter(item => {
    if (params.keyword && !item.name.toLowerCase().includes(params.keyword.toLowerCase()) && !item.tags.some(t => t.toLowerCase().includes(params.keyword.toLowerCase()))) {
      return false;
    }
    if (params.tags && params.tags.length > 0 && !params.tags.some(t => item.tags.includes(t))) {
      return false;
    }
    if (params.sourceType && item.sourceType !== params.sourceType) {
      return false;
    }
    if (params.category && item.category !== params.category) {
      return false;
    }
    return true;
  });
}

export class SavedImageRepository implements ISavedImageRepository {
  async save(item: SavedImage): Promise<void> {
    await db.savedImages.put(item);
  }
  async getById(id: string): Promise<SavedImage | undefined> {
    return db.savedImages.get(id);
  }
  async query(params: AssetQueryParams): Promise<SavedImage[]> {
    let results = await applyQuery(db.savedImages, params).toArray();
    results.sort((a, b) => b.createdAt - a.createdAt);
    if (params.offset) results = results.slice(params.offset);
    if (params.limit) results = results.slice(0, params.limit);
    return results;
  }
  async delete(id: string): Promise<void> {
    await db.savedImages.delete(id);
  }
  async count(spaceId: string): Promise<number> {
    return db.savedImages.where('spaceId').equals(spaceId).count();
  }
}

export class SavedVoiceRepository implements ISavedVoiceRepository {
  async save(item: SavedVoice): Promise<void> {
    await db.savedVoices.put(item);
  }
  async getById(id: string): Promise<SavedVoice | undefined> {
    return db.savedVoices.get(id);
  }
  async query(params: AssetQueryParams): Promise<SavedVoice[]> {
    let results = await applyQuery(db.savedVoices, params).toArray();
    results.sort((a, b) => b.createdAt - a.createdAt);
    if (params.offset) results = results.slice(params.offset);
    if (params.limit) results = results.slice(0, params.limit);
    return results;
  }
  async delete(id: string): Promise<void> {
    await db.savedVoices.delete(id);
  }
  async count(spaceId: string): Promise<number> {
    return db.savedVoices.where('spaceId').equals(spaceId).count();
  }
}

export class SavedPromptRepository implements ISavedPromptRepository {
  async save(item: SavedPrompt): Promise<void> {
    await db.savedPrompts.put(item);
  }
  async getById(id: string): Promise<SavedPrompt | undefined> {
    return db.savedPrompts.get(id);
  }
  async query(params: AssetQueryParams): Promise<SavedPrompt[]> {
    let results = await applyPromptQuery(db.savedPrompts, params).toArray();
    results.sort((a, b) => b.createdAt - a.createdAt);
    if (params.offset) results = results.slice(params.offset);
    if (params.limit) results = results.slice(0, params.limit);
    return results;
  }
  async delete(id: string): Promise<void> {
    await db.savedPrompts.delete(id);
  }
  async count(spaceId: string): Promise<number> {
    return db.savedPrompts.where('spaceId').equals(spaceId).count();
  }
}
