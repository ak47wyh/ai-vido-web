/**
 * TimelineRepositoryAdapter —— 时间线仓储的 Dexie 实现
 *
 * 数据模型：Timeline（在 PostProcessPorts.ts 中定义）。
 * 索引：id, storyId, createdAt, updatedAt。
 */

import { db } from './DexieDatabase';
import type { ITimelineRepository, Timeline } from '../../../domain/ports/PersistencePorts';

export class TimelineRepositoryAdapter implements ITimelineRepository {
  async save(timeline: Timeline): Promise<void> {
    const updated: Timeline = { ...timeline, updatedAt: Date.now() };
    await db.timelines.put(updated);
  }

  async findById(id: string): Promise<Timeline | null> {
    return (await db.timelines.get(id)) ?? null;
  }

  async findByStoryId(storyId: string): Promise<Timeline[]> {
    const all = await db.timelines.where('storyId').equals(storyId).toArray();
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async delete(id: string): Promise<void> {
    await db.timelines.delete(id);
  }
}
