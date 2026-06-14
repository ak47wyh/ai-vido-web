import { v4 as uuidv4 } from 'uuid';
import type { Story, StorySegment, Character, Background } from '../entities/models';
import type {
  IStoryRepository,
  IStorySegmentRepository,
  ITextSplitterPort,
  ICharacterRepository,
  IVideoTaskRepository,
  IBackgroundRepository,
  IStoryBreakdownPort,
  StoryBreakdownResult
} from '../ports/OutboundPorts';

export class StoryService {
  storyRepo: IStoryRepository;
  segmentRepo: IStorySegmentRepository;
  characterRepo: ICharacterRepository;
  backgroundRepo: IBackgroundRepository;
  textSplitterPort: ITextSplitterPort;
  storyBreakdownPort: IStoryBreakdownPort;
  videoTaskRepo: IVideoTaskRepository;

  constructor(
    storyRepo: IStoryRepository,
    segmentRepo: IStorySegmentRepository,
    characterRepo: ICharacterRepository,
    backgroundRepo: IBackgroundRepository,
    textSplitterPort: ITextSplitterPort,
    storyBreakdownPort: IStoryBreakdownPort,
    videoTaskRepo: IVideoTaskRepository
  ) {
    this.storyRepo = storyRepo;
    this.segmentRepo = segmentRepo;
    this.characterRepo = characterRepo;
    this.backgroundRepo = backgroundRepo;
    this.textSplitterPort = textSplitterPort;
    this.storyBreakdownPort = storyBreakdownPort;
    this.videoTaskRepo = videoTaskRepo;
  }

  async createStory(title: string, originalText: string, spaceId: string): Promise<Story> {
    const story: Story = {
      id: uuidv4(),
      spaceId,
      title,
      originalText,
      status: 'DRAFT',
      createdAt: Date.now()
    };
    await this.storyRepo.save(story);
    return story;
  }

  async updateStory(storyId: string, title: string, originalText: string): Promise<void> {
    const story = await this.storyRepo.findById(storyId);
    if (!story) throw new Error('Story not found');
    story.title = title;
    story.originalText = originalText;
    // Reset to DRAFT if content changed and story was already split
    if (story.status === 'SPLIT') {
      story.status = 'DRAFT';
    }
    await this.storyRepo.save(story);
  }

  async splitStory(storyId: string): Promise<StorySegment[]> {
    const story = await this.storyRepo.findById(storyId);
    if (!story) throw new Error('Story not found');

    const characters = await this.characterRepo.findBySpaceId(story.spaceId);
    const characterNames = characters.map(c => c.name);

    const drafts = await this.textSplitterPort.splitStoryToSegments(story.originalText, characterNames);

    const segments: StorySegment[] = drafts.map((draft, index) => {
      const mentionedCharacterIds = draft.mentionedCharacters
        .map(name => characters.find(c => c.name === name)?.id)
        .filter((id): id is string => !!id);

      return {
        id: uuidv4(),
        storyId: story.id,
        sequenceOrder: index,
        content: draft.content,
        mentionedCharacters: mentionedCharacterIds
      };
    });

    const existingSegments = await this.segmentRepo.findByStoryId(story.id);
    if (existingSegments.length > 0) {
      const existingSegmentIds = existingSegments.map(s => s.id);
      await this.videoTaskRepo.deleteBySegmentIds(existingSegmentIds);
      await this.segmentRepo.deleteByStoryId(story.id);
    }

    for (const segment of segments) {
      await this.segmentRepo.save(segment);
    }

    story.status = 'SPLIT';
    await this.storyRepo.save(story);

    return segments;
  }

  async breakdownStory(storyId: string): Promise<StoryBreakdownResult & { savedCharacterIds: string[]; savedBackgroundIds: string[] }> {
    const story = await this.storyRepo.findById(storyId);
    if (!story) throw new Error('Story not found');

    const result = await this.storyBreakdownPort.breakdownStory(story.originalText);

    // Load existing characters/backgrounds in this space for dedup
    const existingCharacters = await this.characterRepo.findBySpaceId(story.spaceId);
    const existingCharByName = new Map(existingCharacters.map(c => [c.name, c]));
    const existingBackgrounds = await this.backgroundRepo.findBySpaceId(story.spaceId);
    const existingBgByName = new Map(existingBackgrounds.map(b => [b.name, b]));

    const savedCharacterIds: string[] = [];
    const characterNameToId = new Map<string, string>();
    for (const draft of result.characters) {
      // Reuse existing character with same name, or create new
      const existing = existingCharByName.get(draft.name);
      if (existing) {
        savedCharacterIds.push(existing.id);
        characterNameToId.set(draft.name, existing.id);
      } else {
        const character: Character = {
          id: uuidv4(),
          spaceId: story.spaceId,
          name: draft.name,
          appearancePrompt: draft.appearancePrompt,
          personalityPrompt: draft.personalityPrompt,
          characterBackground: draft.characterBackground,
          createdAt: Date.now()
        };
        await this.characterRepo.save(character);
        savedCharacterIds.push(character.id);
        characterNameToId.set(draft.name, character.id);
      }
    }

    const savedBackgroundIds: string[] = [];
    const backgroundNameToId = new Map<string, string>();
    for (const draft of result.backgrounds) {
      const existing = existingBgByName.get(draft.name);
      if (existing) {
        savedBackgroundIds.push(existing.id);
        backgroundNameToId.set(draft.name, existing.id);
      } else {
        const background: Background = {
          id: uuidv4(),
          spaceId: story.spaceId,
          name: draft.name,
          environmentPrompt: draft.environmentPrompt,
          createdAt: Date.now()
        };
        await this.backgroundRepo.save(background);
        savedBackgroundIds.push(background.id);
        backgroundNameToId.set(draft.name, background.id);
      }
    }

    const existingSegments = await this.segmentRepo.findByStoryId(story.id);
    if (existingSegments.length > 0) {
      const existingSegmentIds = existingSegments.map(s => s.id);
      await this.videoTaskRepo.deleteBySegmentIds(existingSegmentIds);
      await this.segmentRepo.deleteByStoryId(story.id);
    }

    for (let i = 0; i < result.segments.length; i++) {
      const draft = result.segments[i];
      const mentionedCharacterIds = draft.mentionedCharacterNames
        .map(name => characterNameToId.get(name))
        .filter((id): id is string => !!id);

      const selectedBackgroundId = backgroundNameToId.get(draft.suggestedBackgroundName);

      const segment: StorySegment = {
        id: uuidv4(),
        storyId: story.id,
        sequenceOrder: i,
        content: draft.content,
        mentionedCharacters: mentionedCharacterIds,
        selectedBackgroundId
      };
      await this.segmentRepo.save(segment);
    }

    story.status = 'SPLIT';
    await this.storyRepo.save(story);

    return { ...result, savedCharacterIds, savedBackgroundIds };
  }

  async getSegments(storyId: string): Promise<StorySegment[]> {
    const segments = await this.segmentRepo.findByStoryId(storyId);
    return segments.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  }

  async updateSegmentBackground(segmentId: string, backgroundId: string, storyId: string): Promise<void> {
    const segments = await this.segmentRepo.findByStoryId(storyId);
    const segment = segments.find(s => s.id === segmentId);
    if (segment) {
      segment.selectedBackgroundId = backgroundId;
      await this.segmentRepo.save(segment);
    }
  }

  async removeCharacterFromSegments(characterId: string): Promise<void> {
    const character = await this.characterRepo.findById(characterId);
    if (!character) return;
    // Only scan stories in the same space as the character
    const stories = await this.storyRepo.findBySpaceId(character.spaceId);
    for (const story of stories) {
      const segments = await this.segmentRepo.findByStoryId(story.id);
      for (const seg of segments) {
        if (seg.mentionedCharacters.includes(characterId)) {
          seg.mentionedCharacters = seg.mentionedCharacters.filter(id => id !== characterId);
          await this.segmentRepo.save(seg);
        }
      }
    }
  }

  async removeBackgroundFromSegments(backgroundId: string): Promise<void> {
    const background = await this.backgroundRepo.findById(backgroundId);
    if (!background) return;
    // Only scan stories in the same space as the background
    const stories = await this.storyRepo.findBySpaceId(background.spaceId);
    for (const story of stories) {
      const segments = await this.segmentRepo.findByStoryId(story.id);
      for (const seg of segments) {
        if (seg.selectedBackgroundId === backgroundId) {
          seg.selectedBackgroundId = undefined;
          await this.segmentRepo.save(seg);
        }
      }
    }
  }

  async deleteStory(storyId: string): Promise<void> {
    const segments = await this.segmentRepo.findByStoryId(storyId);
    const segmentIds = segments.map(s => s.id);
    await this.videoTaskRepo.deleteBySegmentIds(segmentIds);
    await this.segmentRepo.deleteByStoryId(storyId);
    await this.storyRepo.delete(storyId);
  }

  async getAllStories(): Promise<Story[]> {
    return this.storyRepo.findAll();
  }
}
