/**
 * useSpaceScopedQuery — 替代页面层直调 db 的统一 Hook
 *
 * 之前页面层直接 useLiveQuery(() => db.characters.where('spaceId').equals(...))
 * 违反六边形架构。
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../../adapters/outbound/repositories/DexieDatabase';
import { useSpace } from '../contexts/SpaceContext';
import type { Character, Background, Story, StorySegment, VideoTask, FinalCut } from '../../domain/entities/models';

/** 当前空间下的所有角色 */
export function useSpaceScopedCharacters(): Character[] {
  const { currentSpaceId } = useSpace();
  const list = useLiveQuery<Character[]>(
    () => currentSpaceId
      ? db.characters.where('spaceId').equals(currentSpaceId).toArray() as Promise<Character[]>
      : Promise.resolve([]),
    [currentSpaceId]
  );
  return useMemo(() => list ?? [], [list]);
}

/** 当前空间下的所有背景 */
export function useSpaceScopedBackgrounds(): Background[] {
  const { currentSpaceId } = useSpace();
  const list = useLiveQuery<Background[]>(
    () => currentSpaceId
      ? db.backgrounds.where('spaceId').equals(currentSpaceId).toArray() as Promise<Background[]>
      : Promise.resolve([]),
    [currentSpaceId]
  );
  return useMemo(() => list ?? [], [list]);
}

/** 当前空间下的所有故事 */
export function useSpaceScopedStories(): Story[] {
  const { currentSpaceId } = useSpace();
  const list = useLiveQuery<Story[]>(
    () => currentSpaceId
      ? db.stories.where('spaceId').equals(currentSpaceId).toArray() as Promise<Story[]>
      : Promise.resolve([]),
    [currentSpaceId]
  );
  return useMemo(() => list ?? [], [list]);
}

/** 故事下的所有段落（按 sequenceOrder 排序） */
export function useStoryScopedSegments(storyId: string | null): StorySegment[] {
  const list = useLiveQuery<StorySegment[]>(
    () => storyId
      ? db.segments.where('storyId').equals(storyId).toArray() as Promise<StorySegment[]>
      : Promise.resolve([]),
    [storyId]
  );
  return useMemo(() => {
    const arr = list ?? [];
    return [...arr].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  }, [list]);
}

/** 多个段落 ID 下的所有视频任务 */
export function useSegmentScopedVideoTasks(segmentIds: string[]): VideoTask[] {
  const key = segmentIds.join(',');
  const list = useLiveQuery<VideoTask[]>(
    () => segmentIds.length > 0
      ? db.videoTasks.where('segmentId').anyOf(segmentIds).toArray() as Promise<VideoTask[]>
      : Promise.resolve([]),
    [key]
  );
  return useMemo(() => list ?? [], [list]);
}

/** 当前空间下的所有 Pipeline 任务（按时间倒序） */
export function useSpaceScopedPipelineTasks() {
  return useLiveQuery(() => db.pipelineTasks.orderBy('createdAt').reverse().toArray(), []);
}

/** 当前空间下的所有成片 */
export function useSpaceScopedFinalCuts(): FinalCut[] {
  const { currentSpaceId } = useSpace();
  const stories = useSpaceScopedStories();
  const storyIds = useMemo(() => new Set(stories.map(s => s.id)), [stories]);
  const list = useLiveQuery<FinalCut[]>(
    () => currentSpaceId
      ? db.finalCuts.filter(cut => storyIds.has(cut.storyId)).toArray() as Promise<FinalCut[]>
      : Promise.resolve([]),
    [currentSpaceId, storyIds]
  );
  return useMemo(() => list ?? [], [list]);
}

/** 当前空间下的视频任务统计 */
export interface VideoTaskStats {
  success: number;
  failed: number;
  processing: number;
  total: number;
}

export function useSpaceVideoTaskStats(): VideoTaskStats {
  const { currentSpaceId } = useSpace();
  const stats = useLiveQuery<VideoTaskStats>(async () => {
    if (!currentSpaceId) return { success: 0, failed: 0, processing: 0, total: 0 };
    const spaceStories = await db.stories.where('spaceId').equals(currentSpaceId).toArray();
    const storyIds = new Set(spaceStories.map(s => s.id));
    const allSegments = await db.segments.toArray();
    const spaceSegmentIds = new Set(allSegments.filter(seg => storyIds.has(seg.storyId)).map(seg => seg.id));
    const allTasks = await db.videoTasks.toArray();
    const spaceTasks = allTasks.filter(t => spaceSegmentIds.has(t.segmentId));
    return {
      success: spaceTasks.filter(t => t.status === 'SUCCESS').length,
      failed: spaceTasks.filter(t => t.status === 'FAILED').length,
      processing: spaceTasks.filter(t => t.status === 'PROCESSING' || t.status === 'PENDING').length,
      total: spaceTasks.length
    };
  }, [currentSpaceId]);
  return stats ?? { success: 0, failed: 0, processing: 0, total: 0 };
}

/** 当前空间下最近的故事（最多 N 条） */
export function useRecentStories(limit = 3): Story[] {
  const { currentSpaceId } = useSpace();
  const list = useLiveQuery<Story[]>(
    () => currentSpaceId
      ? db.stories.where('spaceId').equals(currentSpaceId).reverse().sortBy('createdAt').then(arr => arr.slice(0, limit)) as Promise<Story[]>
      : Promise.resolve([]),
    [currentSpaceId, limit]
  );
  return useMemo(() => list ?? [], [list]);
}

/** 所有空间（用于跨空间复制） */
export function useAllSpaces() {
  return useLiveQuery(() => db.storySpaces.toArray(), []);
}

/** 复合 Hook：获取当前空间的"上下文"（角色/背景/故事） */
export interface SpaceContextData {
  characters: Character[];
  backgrounds: Background[];
  stories: Story[];
  loading: boolean;
}

export function useSpaceContextData(): SpaceContextData {
  const characters = useSpaceScopedCharacters();
  const backgrounds = useSpaceScopedBackgrounds();
  const stories = useSpaceScopedStories();
  return {
    characters,
    backgrounds,
    stories,
    loading: false,
  };
}
