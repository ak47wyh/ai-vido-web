/**
 * SnapshotRepositoryAdapter —— 空间快照仓储的 Dexie 实现
 *
 * 取代 SnapshotService 内部直接 localStorage 的反模式。
 * 数据迁移：旧版本 localStorage 命名空间 `minimax_space_snapshots_<spaceId>`
 *   会在首次调用 findBySpaceId 时一次性自动迁移到 IndexedDB。
 */

import { db } from './DexieDatabase';
import type { ISnapshotRepository, SpaceSnapshot } from '../../../domain/ports/PersistencePorts';

const LEGACY_KEY_PREFIX = 'minimax_space_snapshots_';
const MIGRATED_FLAG_PREFIX = 'minimax_snapshots_migrated_';

export class SnapshotRepositoryAdapter implements ISnapshotRepository {
  async save(snapshot: SpaceSnapshot): Promise<void> {
    await db.snapshots.put(snapshot);
  }

  async findById(spaceId: string, snapshotId: string): Promise<SpaceSnapshot | null> {
    await this.migrateLegacyIfNeeded(spaceId);
    const found = await db.snapshots.get(snapshotId);
    return found && found.spaceId === spaceId ? found : null;
  }

  async findBySpaceId(spaceId: string): Promise<SpaceSnapshot[]> {
    await this.migrateLegacyIfNeeded(spaceId);
    const all = await db.snapshots.where('spaceId').equals(spaceId).toArray();
    return all.sort((a, b) => b.createdAt - a.createdAt);
  }

  async delete(spaceId: string, snapshotId: string): Promise<void> {
    const found = await db.snapshots.get(snapshotId);
    if (found && found.spaceId === spaceId) {
      await db.snapshots.delete(snapshotId);
    }
  }

  async rename(spaceId: string, snapshotId: string, newName: string): Promise<void> {
    const found = await db.snapshots.get(snapshotId);
    if (!found || found.spaceId !== spaceId) return;
    await db.snapshots.put({ ...found, name: newName });
  }

  async trim(spaceId: string, limit: number): Promise<number> {
    const all = await this.findBySpaceId(spaceId);
    if (all.length <= limit) return 0;
    const toDelete = all.slice(limit);
    await db.snapshots.bulkDelete(toDelete.map(s => s.id));
    return toDelete.length;
  }

  /**
   * 一次性从 localStorage 平迁到 IndexedDB。
   * 每个 spaceId 仅执行一次（通过 MIGRATED_FLAG 标记）。
   */
  private async migrateLegacyIfNeeded(spaceId: string): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    const flagKey = `${MIGRATED_FLAG_PREFIX}${spaceId}`;
    if (localStorage.getItem(flagKey) === '1') return;

    const legacyKey = `${LEGACY_KEY_PREFIX}${spaceId}`;
    const raw = localStorage.getItem(legacyKey);
    if (raw) {
      try {
        const legacy = JSON.parse(raw) as SpaceSnapshot[];
        if (Array.isArray(legacy) && legacy.length > 0) {
          await db.snapshots.bulkPut(legacy);
        }
      } catch {
        // 旧数据损坏，忽略
      }
      localStorage.removeItem(legacyKey);
    }
    localStorage.setItem(flagKey, '1');
  }
}
