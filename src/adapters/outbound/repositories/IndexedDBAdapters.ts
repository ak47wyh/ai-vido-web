import { db } from './DexieDatabase';
import type { Character, Background, Story, StorySegment, VideoTask, VideoTaskStatus } from '../../../domain/entities/models';
import type { 
  ICharacterRepository, 
  IBackgroundRepository, 
  IStoryRepository, 
  IStorySegmentRepository, 
  IVideoTaskRepository 
} from '../../../domain/ports/OutboundPorts';

export class CharacterRepositoryAdapter implements ICharacterRepository {
  async save(character: Character): Promise<void> {
    await db.characters.put(character);
  }
  async findById(id: string): Promise<Character | null> {
    return (await db.characters.get(id)) || null;
  }
  async findAll(): Promise<Character[]> {
    return db.characters.toArray();
  }
  async delete(id: string): Promise<void> {
    await db.characters.delete(id);
  }
}

export class BackgroundRepositoryAdapter implements IBackgroundRepository {
  async save(background: Background): Promise<void> {
    await db.backgrounds.put(background);
  }
  async findById(id: string): Promise<Background | null> {
    return (await db.backgrounds.get(id)) || null;
  }
  async findAll(): Promise<Background[]> {
    return db.backgrounds.toArray();
  }
  async delete(id: string): Promise<void> {
    await db.backgrounds.delete(id);
  }
}

export class StoryRepositoryAdapter implements IStoryRepository {
  async save(story: Story): Promise<void> {
    await db.stories.put(story);
  }
  async findById(id: string): Promise<Story | null> {
    return (await db.stories.get(id)) || null;
  }
  async findAll(): Promise<Story[]> {
    return db.stories.toArray();
  }
  async delete(id: string): Promise<void> {
    await db.stories.delete(id);
  }
}

export class StorySegmentRepositoryAdapter implements IStorySegmentRepository {
  async save(segment: StorySegment): Promise<void> {
    await db.segments.put(segment);
  }
  async findByStoryId(storyId: string): Promise<StorySegment[]> {
    return db.segments.where('storyId').equals(storyId).toArray();
  }
  async deleteByStoryId(storyId: string): Promise<void> {
    const segments = await this.findByStoryId(storyId);
    const ids = segments.map(s => s.id);
    await db.segments.bulkDelete(ids);
  }
}

export class VideoTaskRepositoryAdapter implements IVideoTaskRepository {
  async save(task: VideoTask): Promise<void> {
    await db.videoTasks.put(task);
  }
  async findBySegmentId(segmentId: string): Promise<VideoTask[]> {
    return db.videoTasks.where('segmentId').equals(segmentId).toArray();
  }
  async updateStatus(taskId: string, status: VideoTaskStatus, videoUrl?: string, errorMessage?: string): Promise<void> {
    const task = await db.videoTasks.get(taskId);
    if (task) {
      task.status = status;
      if (videoUrl !== undefined) task.videoUrl = videoUrl;
      if (errorMessage !== undefined) task.errorMessage = errorMessage;
      await db.videoTasks.put(task);
    }
  }
}
