import { db } from './DexieDatabase';
import type { Character, Background, Story, StorySegment, StorySpace, VideoTask, VideoTaskStatus, FinalCut } from '../../../domain/entities/models';
import type {
  ICharacterRepository,
  IBackgroundRepository,
  IStoryRepository,
  IStorySegmentRepository,
  IVideoTaskRepository,
  IStorySpaceRepository,
  IFinalCutRepository
} from '../../../domain/ports/OutboundPorts';

export class StorySpaceRepositoryAdapter implements IStorySpaceRepository {
  async save(space: StorySpace): Promise<void> {
    await db.storySpaces.put(space);
  }
  async findById(id: string): Promise<StorySpace | null> {
    return (await db.storySpaces.get(id)) || null;
  }
  async findAll(): Promise<StorySpace[]> {
    return db.storySpaces.toArray();
  }
  async delete(id: string): Promise<void> {
    await db.storySpaces.delete(id);
  }
}

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
  async findBySpaceId(spaceId: string): Promise<Character[]> {
    return db.characters.where('spaceId').equals(spaceId).toArray();
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
  async findBySpaceId(spaceId: string): Promise<Background[]> {
    return db.backgrounds.where('spaceId').equals(spaceId).toArray();
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
  async findBySpaceId(spaceId: string): Promise<Story[]> {
    return db.stories.where('spaceId').equals(spaceId).toArray();
  }
  async delete(id: string): Promise<void> {
    await db.stories.delete(id);
  }
}

export class StorySegmentRepositoryAdapter implements IStorySegmentRepository {
  async save(segment: StorySegment): Promise<void> {
    await db.segments.put(segment);
  }
  async findById(id: string): Promise<StorySegment | null> {
    return (await db.segments.get(id)) || null;
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
  async findById(taskId: string): Promise<VideoTask | null> {
    return (await db.videoTasks.get(taskId)) ?? null;
  }
  async findBySegmentId(segmentId: string): Promise<VideoTask[]> {
    return db.videoTasks.where('segmentId').equals(segmentId).toArray();
  }
  async findLatestBySegmentId(segmentId: string): Promise<VideoTask | null> {
    const tasks = await db.videoTasks
      .where('segmentId').equals(segmentId)
      .reverse().sortBy('createdAt');
    return tasks[0] || null;
  }
  async findByStatuses(statuses: VideoTaskStatus[]): Promise<VideoTask[]> {
    return db.videoTasks.where('status').anyOf(statuses).toArray();
  }
  async deleteBySegmentIds(segmentIds: string[]): Promise<void> {
    if (segmentIds.length === 0) return;
    const tasksToDelete = await db.videoTasks
      .where('segmentId').anyOf(segmentIds)
      .toArray();
    const taskIds = tasksToDelete.map(t => t.id);
    await db.videoTasks.bulkDelete(taskIds);
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

export class FinalCutRepositoryAdapter implements IFinalCutRepository {
  async save(cut: FinalCut): Promise<void> {
    await db.finalCuts.put(cut);
  }
  async findById(id: string): Promise<FinalCut | undefined> {
    return db.finalCuts.get(id);
  }
  async findByStoryIds(storyIds: string[]): Promise<FinalCut[]> {
    if (storyIds.length === 0) return [];
    const all = await db.finalCuts.toArray();
    const idSet = new Set(storyIds);
    return all.filter(c => idSet.has(c.storyId)).sort((a, b) => b.createdAt - a.createdAt);
  }
  async delete(id: string): Promise<void> {
    await db.finalCuts.delete(id);
  }
}
