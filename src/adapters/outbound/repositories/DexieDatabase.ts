import Dexie, { type Table } from 'dexie';
import type { Character, Background, Story, StorySegment, StorySpace, VideoTask } from '../../../domain/entities/models';

export class AiVideoDatabase extends Dexie {
  storySpaces!: Table<StorySpace, string>;
  characters!: Table<Character, string>;
  backgrounds!: Table<Background, string>;
  stories!: Table<Story, string>;
  segments!: Table<StorySegment, string>;
  videoTasks!: Table<VideoTask, string>;

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
  }
}

export const db = new AiVideoDatabase();
