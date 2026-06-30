import type { Table } from 'dexie';
import { db } from './DexieDatabase';
import type { GeneratedFile } from '../../../domain/entities/models';
import type { FileStorageQuery, IGeneratedFileRepository } from '../../../domain/ports/FileStoragePorts';

export class GeneratedFileRepository implements IGeneratedFileRepository {
  private get table(): Table<GeneratedFile, string> {
    return db.generatedFiles;
  }

  async save(file: GeneratedFile): Promise<void> {
    await this.table.put(file);
  }

  async getById(id: string): Promise<GeneratedFile | undefined> {
    return this.table.get(id);
  }

  async query(params: FileStorageQuery): Promise<GeneratedFile[]> {
    const collection = this.table.toCollection();

    // 按条件过滤（Dexie 复合查询使用 filter）
    const results = await collection.filter(file => {
      if (params.spaceId && file.spaceId !== params.spaceId) return false;
      if (params.fileType && file.fileType !== params.fileType) return false;
      if (params.sourceEntityType && file.sourceEntityType !== params.sourceEntityType) return false;
      if (params.sourceEntityId && file.sourceEntityId !== params.sourceEntityId) return false;
      if (params.tags && params.tags.length > 0 && !params.tags.some(t => file.tags.includes(t))) return false;
      return true;
    }).toArray();

    // 按创建时间降序
    results.sort((a, b) => b.createdAt - a.createdAt);

    if (params.offset) {
      const sliced = results.slice(params.offset);
      return params.limit ? sliced.slice(0, params.limit) : sliced;
    }
    return params.limit ? results.slice(0, params.limit) : results;
  }

  async delete(id: string): Promise<void> {
    await this.table.delete(id);
  }

  async findByPath(storagePath: string): Promise<GeneratedFile | undefined> {
    return this.table.where('storagePath').equals(storagePath).first();
  }

  async count(spaceId: string): Promise<number> {
    return this.table.where('spaceId').equals(spaceId).count();
  }

  async getTotalSize(spaceId?: string): Promise<number> {
    const files = spaceId
      ? await this.table.where('spaceId').equals(spaceId).toArray()
      : await this.table.toArray();
    return files.reduce((sum, f) => sum + f.fileSize, 0);
  }

  async findLeastRecentlyUsed(limit: number): Promise<GeneratedFile[]> {
    const all = await this.table.toArray();
    all.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
    return all.slice(0, limit);
  }

  async touchAccessTime(id: string): Promise<void> {
    await this.table.update(id, { lastAccessedAt: Date.now() });
  }
}
