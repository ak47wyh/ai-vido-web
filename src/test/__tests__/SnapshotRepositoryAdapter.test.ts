/**
 * SnapshotRepositoryAdapter 单元测试
 *
 * TDD 流程：
 * 1. 先写测试（已存在实现，应通过）
 * 2. 验证：实现正确保存、查询、删除、迁移
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../adapters/outbound/repositories/DexieDatabase';
import { SnapshotRepositoryAdapter } from '../../adapters/outbound/repositories/SnapshotRepositoryAdapter';
import type { SpaceSnapshot } from '../../domain/ports/PersistencePorts';

describe('SnapshotRepositoryAdapter', () => {
  let repo: SnapshotRepositoryAdapter;

  beforeEach(async () => {
    await db.snapshots.clear();
    await db.delete();
    await db.open();
    // 清空 localStorage 测试污染
    localStorage.clear();
    repo = new SnapshotRepositoryAdapter();
  });

  it('saves and retrieves a snapshot by id', async () => {
    const snapshot: SpaceSnapshot = {
      id: 'snap-1',
      spaceId: 'space-1',
      name: 'Test Snapshot',
      createdAt: Date.now(),
    };
    await repo.save(snapshot);

    const found = await repo.findById('space-1', 'snap-1');
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Test Snapshot');
  });

  it('returns null when snapshot not found', async () => {
    const found = await repo.findById('space-1', 'nonexistent');
    expect(found).toBeNull();
  });

  it('lists all snapshots for a space, sorted by createdAt desc', async () => {
    await repo.save({ id: 's1', spaceId: 'space-1', name: 'Old', createdAt: 1000 });
    await repo.save({ id: 's2', spaceId: 'space-1', name: 'New', createdAt: 3000 });
    await repo.save({ id: 's3', spaceId: 'space-1', name: 'Mid', createdAt: 2000 });
    await repo.save({ id: 's4', spaceId: 'space-2', name: 'Other space', createdAt: 5000 });

    const list = await repo.findBySpaceId('space-1');
    expect(list).toHaveLength(3);
    expect(list[0].id).toBe('s2');
    expect(list[2].id).toBe('s1');
  });

  it('does not return snapshots from other spaces', async () => {
    await repo.save({ id: 's1', spaceId: 'space-1', name: 'A', createdAt: 1000 });
    await repo.save({ id: 's2', spaceId: 'space-2', name: 'B', createdAt: 2000 });
    const list = await repo.findBySpaceId('space-1');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('s1');
  });

  it('deletes a snapshot', async () => {
    await repo.save({ id: 's1', spaceId: 'space-1', name: 'A', createdAt: 1000 });
    await repo.delete('space-1', 's1');
    const found = await repo.findById('space-1', 's1');
    expect(found).toBeNull();
  });

  it('does not delete snapshots from other spaces', async () => {
    await repo.save({ id: 's1', spaceId: 'space-1', name: 'A', createdAt: 1000 });
    // 调用 delete 用错误的 spaceId，应不删除
    await repo.delete('space-2', 's1');
    const found = await repo.findById('space-1', 's1');
    expect(found).not.toBeNull();
  });

  it('renames a snapshot', async () => {
    await repo.save({ id: 's1', spaceId: 'space-1', name: 'Old Name', createdAt: 1000 });
    await repo.rename('space-1', 's1', 'New Name');
    const found = await repo.findById('space-1', 's1');
    expect(found?.name).toBe('New Name');
  });

  it('trims old snapshots beyond limit', async () => {
    for (let i = 0; i < 5; i++) {
      await repo.save({ id: `s${i}`, spaceId: 'space-1', name: `S${i}`, createdAt: 1000 + i });
    }
    const deleted = await repo.trim('space-1', 3);
    expect(deleted).toBe(2);
    const remaining = await repo.findBySpaceId('space-1');
    expect(remaining).toHaveLength(3);
    // 保留最新的 3 个
    expect(remaining.map(r => r.id).sort()).toEqual(['s2', 's3', 's4']);
  });

  it('migrates legacy localStorage data on first access', async () => {
    const legacyData: SpaceSnapshot[] = [
      { id: 'legacy-1', spaceId: 'space-1', name: 'Legacy', createdAt: 500 },
      { id: 'legacy-2', spaceId: 'space-1', name: 'Legacy 2', createdAt: 600 },
    ];
    localStorage.setItem('minimax_space_snapshots_space-1', JSON.stringify(legacyData));

    const list = await repo.findBySpaceId('space-1');
    expect(list).toHaveLength(2);
    // 迁移后 localStorage 中的旧数据应被清除
    expect(localStorage.getItem('minimax_space_snapshots_space-1')).toBeNull();
    expect(localStorage.getItem('minimax_snapshots_migrated_space-1')).toBe('1');
  });

  it('does not re-migrate after flag is set', async () => {
    localStorage.setItem('minimax_snapshots_migrated_space-1', '1');
    localStorage.setItem('minimax_space_snapshots_space-1', JSON.stringify([
      { id: 'legacy', spaceId: 'space-1', name: 'L', createdAt: 100 },
    ]));
    const list = await repo.findBySpaceId('space-1');
    // 应为空，因为已标记迁移完成，旧数据不再读取
    expect(list).toHaveLength(0);
  });
});