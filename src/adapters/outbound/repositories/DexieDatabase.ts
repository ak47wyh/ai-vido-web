import Dexie, { type Table } from 'dexie';
import type { Character, Background, Story, StorySegment, StorySpace, VideoTask, PipelineTask, FinalCut, SavedImage, SavedVoice, SavedPrompt } from '../../../domain/entities/models';
import type { SpaceSnapshot, Timeline } from '../../../domain/ports/PersistencePorts';

export class AiVideoDatabase extends Dexie {
  storySpaces!: Table<StorySpace, string>;
  characters!: Table<Character, string>;
  backgrounds!: Table<Background, string>;
  stories!: Table<Story, string>;
  segments!: Table<StorySegment, string>;
  videoTasks!: Table<VideoTask, string>;
  pipelineTasks!: Table<PipelineTask, string>;
  finalCuts!: Table<FinalCut, string>;
  savedImages!: Table<SavedImage, string>;
  savedVoices!: Table<SavedVoice, string>;
  savedPrompts!: Table<SavedPrompt, string>;
  snapshots!: Table<SpaceSnapshot, string>;
  timelines!: Table<Timeline, string>;

  constructor() {
    super('AiVideoDatabase');
    this.version(1).stores({
      characters: 'id, name, createdAt',
      backgrounds: 'id, name, createdAt',
      stories: 'id, status, createdAt',
      segments: 'id, storyId, sequenceOrder',
      videoTasks: 'id, segmentId, status, createdAt'
    });
    this.version(2).stores({
      characters: 'id, name, createdAt',
      backgrounds: 'id, name, createdAt',
      stories: 'id, status, createdAt',
      segments: 'id, storyId, sequenceOrder',
      videoTasks: 'id, segmentId, status, createdAt'
    }).upgrade(async tx => {
      await tx.table<Character, string>('characters').toCollection().modify(character => {
        if (character.characterBackground === undefined) {
          character.characterBackground = '';
        }
      });
    });
    // Version 3: Add StorySpace and spaceId to all entities
    this.version(3).stores({
      storySpaces: 'id, name, createdAt',
      characters: 'id, spaceId, name, createdAt',
      backgrounds: 'id, spaceId, name, createdAt',
      stories: 'id, spaceId, status, createdAt',
      segments: 'id, storyId, sequenceOrder',
      videoTasks: 'id, segmentId, status, createdAt'
    }).upgrade(async tx => {
      // Create a default space and assign all existing entities to it
      const defaultSpaceId = '__default__';
      await tx.table('storySpaces').put({
        id: defaultSpaceId,
        name: 'Default Space',
        description: 'Default workspace',
        createdAt: Date.now()
      });
      // Assign all existing entities to the default space
      await tx.table('characters').toCollection().modify(c => { c.spaceId = defaultSpaceId; });
      await tx.table('backgrounds').toCollection().modify(b => { b.spaceId = defaultSpaceId; });
      await tx.table('stories').toCollection().modify(s => { s.spaceId = defaultSpaceId; });
    });
    // Version 4: Add voiceId to characters (non-indexed, no migration needed)
    this.version(4).stores({
      storySpaces: 'id, name, createdAt',
      characters: 'id, spaceId, name, createdAt',
      backgrounds: 'id, spaceId, name, createdAt',
      stories: 'id, spaceId, status, createdAt',
      segments: 'id, storyId, sequenceOrder',
      videoTasks: 'id, segmentId, status, createdAt'
    });
    // Version 5: Add BGM fields to segments (non-indexed, no migration needed)
    this.version(5).stores({
      storySpaces: 'id, name, createdAt',
      characters: 'id, spaceId, name, createdAt',
      backgrounds: 'id, spaceId, name, createdAt',
      stories: 'id, spaceId, status, createdAt',
      segments: 'id, storyId, sequenceOrder',
      videoTasks: 'id, segmentId, status, createdAt'
    });
    // Version 6: Add video generation mode/model/resolution/duration fields to videoTasks (non-indexed)
    this.version(6).stores({
      storySpaces: 'id, name, createdAt',
      characters: 'id, spaceId, name, createdAt',
      backgrounds: 'id, spaceId, name, createdAt',
      stories: 'id, spaceId, status, createdAt',
      segments: 'id, storyId, sequenceOrder',
      videoTasks: 'id, segmentId, status, createdAt'
    });
    // Version 7: Add Pipeline + FinalCut tables (no migration needed, new tables)
    this.version(7).stores({
      storySpaces: 'id, name, createdAt',
      characters: 'id, spaceId, name, createdAt',
      backgrounds: 'id, spaceId, name, createdAt',
      stories: 'id, spaceId, status, createdAt',
      segments: 'id, storyId, sequenceOrder',
      videoTasks: 'id, segmentId, status, createdAt',
      pipelineTasks: 'id, storyId, status, createdAt',
      finalCuts: 'id, storyId, pipelineTaskId, createdAt'
    });
    // Version 8: Add Asset Library tables (savedImages, savedVoices, savedPrompts)
    this.version(8).stores({
      storySpaces: 'id, name, createdAt',
      characters: 'id, spaceId, name, createdAt',
      backgrounds: 'id, spaceId, name, createdAt',
      stories: 'id, spaceId, status, createdAt',
      segments: 'id, storyId, sequenceOrder',
      videoTasks: 'id, segmentId, status, createdAt',
      pipelineTasks: 'id, storyId, status, createdAt',
      finalCuts: 'id, storyId, pipelineTaskId, createdAt',
      savedImages: 'id, spaceId, name, sourceType, createdAt',
      savedVoices: 'id, spaceId, name, sourceType, createdAt',
      savedPrompts: 'id, spaceId, name, category, createdAt'
    });
    // Version 9: Add Snapshot + Timeline tables (六边形架构：持久化 Port 落地)
    //   - snapshots: 支持按 spaceId 查询
    //   - timelines: 支持按 storyId 查询
    this.version(9).stores({
      storySpaces: 'id, name, createdAt',
      characters: 'id, spaceId, name, createdAt',
      backgrounds: 'id, spaceId, name, createdAt',
      stories: 'id, spaceId, status, createdAt',
      segments: 'id, storyId, sequenceOrder',
      videoTasks: 'id, segmentId, status, createdAt',
      pipelineTasks: 'id, storyId, status, createdAt',
      finalCuts: 'id, storyId, pipelineTaskId, createdAt',
      savedImages: 'id, spaceId, name, sourceType, createdAt',
      savedVoices: 'id, spaceId, name, sourceType, createdAt',
      savedPrompts: 'id, spaceId, name, category, createdAt',
      snapshots: 'id, spaceId, createdAt',
      timelines: 'id, storyId, createdAt, updatedAt'
    });
  }
}

export const db = new AiVideoDatabase();
