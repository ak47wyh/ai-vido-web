import { v4 as uuidv4 } from 'uuid';
import type { StorySpace, Character, Background } from '../entities/models';
import type { IStorySpaceRepository, ICharacterRepository, IBackgroundRepository, IStoryRepository, IVideoTaskRepository, IStorySegmentRepository } from '../ports/OutboundPorts';

export class StorySpaceService {
  spaceRepo: IStorySpaceRepository;
  characterRepo: ICharacterRepository;
  backgroundRepo: IBackgroundRepository;
  storyRepo: IStoryRepository;
  segmentRepo: IStorySegmentRepository;
  videoTaskRepo: IVideoTaskRepository;

  constructor(
    spaceRepo: IStorySpaceRepository,
    characterRepo: ICharacterRepository,
    backgroundRepo: IBackgroundRepository,
    storyRepo: IStoryRepository,
    segmentRepo: IStorySegmentRepository,
    videoTaskRepo: IVideoTaskRepository
  ) {
    this.spaceRepo = spaceRepo;
    this.characterRepo = characterRepo;
    this.backgroundRepo = backgroundRepo;
    this.storyRepo = storyRepo;
    this.segmentRepo = segmentRepo;
    this.videoTaskRepo = videoTaskRepo;
  }

  async createSpace(name: string, description: string): Promise<StorySpace> {
    const space: StorySpace = {
      id: uuidv4(),
      name,
      description,
      createdAt: Date.now()
    };
    await this.spaceRepo.save(space);
    return space;
  }

  async updateSpace(space: StorySpace): Promise<void> {
    await this.spaceRepo.save(space);
  }

  async deleteSpace(spaceId: string): Promise<void> {
    // Delete all stories and their segments/video tasks in this space
    const stories = await this.storyRepo.findBySpaceId(spaceId);
    for (const story of stories) {
      const segments = await this.segmentRepo.findByStoryId(story.id);
      const segmentIds = segments.map(s => s.id);
      await this.videoTaskRepo.deleteBySegmentIds(segmentIds);
      await this.segmentRepo.deleteByStoryId(story.id);
    }
    // Delete all characters and backgrounds in this space
    // (no need to clean segment references since all stories in this space are being deleted)
    const characters = await this.characterRepo.findBySpaceId(spaceId);
    for (const c of characters) await this.characterRepo.delete(c.id);
    const backgrounds = await this.backgroundRepo.findBySpaceId(spaceId);
    for (const b of backgrounds) await this.backgroundRepo.delete(b.id);
    for (const s of stories) await this.storyRepo.delete(s.id);

    await this.spaceRepo.delete(spaceId);
  }

  async copyCharacterToSpace(characterId: string, targetSpaceId: string): Promise<Character> {
    const source = await this.characterRepo.findById(characterId);
    if (!source) throw new Error('Character not found');
    const copied: Character = {
      ...source,
      id: uuidv4(),
      spaceId: targetSpaceId,
      createdAt: Date.now()
    };
    await this.characterRepo.save(copied);
    return copied;
  }

  async copyBackgroundToSpace(backgroundId: string, targetSpaceId: string): Promise<Background> {
    const source = await this.backgroundRepo.findById(backgroundId);
    if (!source) throw new Error('Background not found');
    const copied: Background = {
      ...source,
      id: uuidv4(),
      spaceId: targetSpaceId,
      createdAt: Date.now()
    };
    await this.backgroundRepo.save(copied);
    return copied;
  }

  async copyAllToSpace(sourceSpaceId: string, targetSpaceId: string): Promise<{ characters: number; backgrounds: number; stories: number }> {
    const characters = await this.characterRepo.findBySpaceId(sourceSpaceId);
    for (const c of characters) {
      await this.characterRepo.save({ ...c, id: uuidv4(), spaceId: targetSpaceId, createdAt: Date.now() });
    }
    const backgrounds = await this.backgroundRepo.findBySpaceId(sourceSpaceId);
    for (const b of backgrounds) {
      await this.backgroundRepo.save({ ...b, id: uuidv4(), spaceId: targetSpaceId, createdAt: Date.now() });
    }
    // Copy stories (without segments/video tasks — those are story-specific)
    const stories = await this.storyRepo.findBySpaceId(sourceSpaceId);
    for (const s of stories) {
      await this.storyRepo.save({ ...s, id: uuidv4(), spaceId: targetSpaceId, status: 'DRAFT' as const, createdAt: Date.now() });
    }
    return { characters: characters.length, backgrounds: backgrounds.length, stories: stories.length };
  }

  async getAllSpaces(): Promise<StorySpace[]> {
    return this.spaceRepo.findAll();
  }

  async getSpaceById(id: string): Promise<StorySpace | null> {
    return this.spaceRepo.findById(id);
  }
}
