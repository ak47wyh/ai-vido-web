import { v4 as uuidv4 } from 'uuid';
import type { Story, StorySegment } from '../entities/models';
import type { IStoryRepository, IStorySegmentRepository, ITextSplitterPort, ICharacterRepository } from '../ports/OutboundPorts';

export class StoryService {
  storyRepo: IStoryRepository;
  segmentRepo: IStorySegmentRepository;
  characterRepo: ICharacterRepository;
  textSplitterPort: ITextSplitterPort;

  constructor(
    storyRepo: IStoryRepository,
    segmentRepo: IStorySegmentRepository,
    characterRepo: ICharacterRepository,
    textSplitterPort: ITextSplitterPort
  ) {
    this.storyRepo = storyRepo;
    this.segmentRepo = segmentRepo;
    this.characterRepo = characterRepo;
    this.textSplitterPort = textSplitterPort;
  }


  async createStory(title: string, originalText: string): Promise<Story> {
    const story: Story = {
      id: uuidv4(),
      title,
      originalText,
      status: 'DRAFT',
      createdAt: Date.now()
    };
    await this.storyRepo.save(story);
    return story;
  }

  async splitStory(storyId: string): Promise<StorySegment[]> {
    const story = await this.storyRepo.findById(storyId);
    if (!story) throw new Error('Story not found');

    const characters = await this.characterRepo.findAll();
    const characterNames = characters.map(c => c.name);

    // Call LLM to split
    const drafts = await this.textSplitterPort.splitStoryToSegments(story.originalText, characterNames);

    const segments: StorySegment[] = drafts.map((draft, index) => {
      // Map character names back to IDs
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

    // Save segments
    await this.segmentRepo.deleteByStoryId(story.id);
    for (const segment of segments) {
      await this.segmentRepo.save(segment);
    }

    story.status = 'SPLIT';
    await this.storyRepo.save(story);

    return segments;
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
}
