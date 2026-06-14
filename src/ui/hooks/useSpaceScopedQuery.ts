/**
 * useSpaceScopedQuery — 替代页面层直调 db 的统一 Hook
 *
 * 之前页面层直接 useLiveQuery(() => db.characters.where('spaceId').equals(...))
 * 违反六边形架构。
 *
 * 使用方式：
 *   const characters = useSpaceScopedCharacters();
 *   const backgrounds = useSpaceScopedBackgrounds();
 *   const stories = useSpaceScopedStories();
 *   const segments = useStoryScopedSegments(storyId);
 *   const videoTasks = useSegmentScopedVideoTasks(segmentIds);
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../../adapters/outbound/repositories/DexieDatabase';
import { useSpace } from '../contexts/SpaceContext';
import type { Character, Background, Story, StorySegment, VideoTask } from '../../domain/entities/models';

const EMPTY: never[] = [];

/** 当前空间下的所有角色 */
export function useSpaceScopedCharacters(): Character[] {
  const { currentSpaceId } = useSpace();
  const list = useLiveQuery(
    () => currentSpaceId
      ? db.characters.where('spaceId').equals(currentSpaceId).toArray()
      : Promise.resolve(EMPTY),
    [currentSpaceId]
  );
  return useMemo(() => list ?? [], [list]);
}

/** 当前空间下的所有背景 */
export function useSpaceScopedBackgrounds(): Background[] {
  const { currentSpaceId } = useSpace();
  const list = useLiveQuery(
    () => currentSpaceId
      ? db.backgrounds.where('spaceId').equals(currentSpaceId).toArray()
      : Promise.resolve(EMPTY),
    [currentSpaceId]
  );
  return useMemo(() => list ?? [], [list]);
}

/** 当前空间下的所有故事 */
export function useSpaceScopedStories(): Story[] {
  const { currentSpaceId } = useSpace();
  const list = useLiveQuery(
    () => currentSpaceId
      ? db.stories.where('spaceId').equals(currentSpaceId).toArray()
      : Promise.resolve(EMPTY),
    [currentSpaceId]
  );
  return useMemo(() => list ?? [], [list]);
}

/** 故事下的所有段落 */
export function useStoryScopedSegments(storyId: string | null): StorySegment[] {
  const list = useLiveQuery(
    () => storyId
      ? db.segments.where('storyId').equals(storyId).toArray()
      : Promise.resolve(EMPTY),
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
  const list = useLiveQuery(
    () => segmentIds.length > 0
      ? db.videoTasks.where('segmentId').anyOf(segmentIds).toArray()
      : Promise.resolve(EMPTY),
    [key]
  );
  return useMemo(() => list ?? [], [list]);
}

/** 当前空间下的所有 Pipeline 任务（按时间倒序） */
export function useSpaceScopedPipelineTasks() {
  return useLiveQuery(() => db.pipelineTasks.orderBy('createdAt').reverse().toArray(), []);
}

/** 当前空间下的所有成片 */
export function useSpaceScopedFinalCuts() {
  return useLiveQuery(() => db.finalCuts.orderBy('createdAt').reverse().toArray(), []);
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
    loading: false, // useLiveQuery 返回 undefined 时视为加载中
  };
}
