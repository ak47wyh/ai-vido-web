import Dexie, { type Table } from 'dexie';
import type { Character, Background, Story, StorySegment, VideoTask } from '../../../domain/entities/models';

export class AiVideoDatabase extends Dexie {
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
  }
}

export const db = new AiVideoDatabase();
