import { v4 as uuidv4 } from 'uuid';
import type { VideoTask } from '../entities/models';
import type { 
  IVideoTaskRepository, 
  IVideoGeneratorPort, 
  IStorySegmentRepository, 
  ICharacterRepository, 
  IBackgroundRepository,
  VideoPromptContext
} from '../ports/OutboundPorts';

export class VideoGenerationService {
  videoTaskRepo: IVideoTaskRepository;
  segmentRepo: IStorySegmentRepository;
  characterRepo: ICharacterRepository;
  backgroundRepo: IBackgroundRepository;
  videoGeneratorPort: IVideoGeneratorPort;

  constructor(
    videoTaskRepo: IVideoTaskRepository,
    segmentRepo: IStorySegmentRepository,
    characterRepo: ICharacterRepository,
    backgroundRepo: IBackgroundRepository,
    videoGeneratorPort: IVideoGeneratorPort
  ) {
    this.videoTaskRepo = videoTaskRepo;
    this.segmentRepo = segmentRepo;
    this.characterRepo = characterRepo;
    this.backgroundRepo = backgroundRepo;
    this.videoGeneratorPort = videoGeneratorPort;
  }


  async generateVideo(segmentId: string, storyId: string, targetPlatform: string = 'MINIMAX'): Promise<VideoTask> {
    const segments = await this.segmentRepo.findByStoryId(storyId);
    const segment = segments.find(s => s.id === segmentId);
    if (!segment) throw new Error('Segment not found');

    const task: VideoTask = {
      id: uuidv4(),
      segmentId,
      targetPlatform,
      status: 'PENDING',
      createdAt: Date.now()
    };
    await this.videoTaskRepo.save(task);

    // Build Context
    const characters = [];
    for (const charId of segment.mentionedCharacters) {
      const char = await this.characterRepo.findById(charId);
      if (char) characters.push(char);
    }

    let background = undefined;
    if (segment.selectedBackgroundId) {
      const bg = await this.backgroundRepo.findById(segment.selectedBackgroundId);
      if (bg) background = bg;
    }

    const context: VideoPromptContext = {
      actionContent: segment.content,
      characters,
      background,
      videoStyle: 'default' // could be dynamic
    };

    // Note: In a real system, you might dispatch an event to a queue or background worker.
    // Here in Local-First, we just trigger it asynchronously.
    this.processTask(task, context).catch(console.error);

    return task;
  }

  private async processTask(task: VideoTask, context: VideoPromptContext) {
    try {
      await this.videoTaskRepo.updateStatus(task.id, 'PROCESSING');
      const externalTaskId = await this.videoGeneratorPort.submitVideoTask(context);
      
      // Save external task ID
      task.externalTaskId = externalTaskId;
      await this.videoTaskRepo.save(task);

      // Start polling
      this.pollTaskStatus(task.id, externalTaskId);

    } catch (error: any) {
      await this.videoTaskRepo.updateStatus(task.id, 'FAILED', undefined, error.message || 'Submit failed');
    }
  }

  private async pollTaskStatus(taskId: string, externalTaskId: string) {
    const pollInterval = 3000;
    const maxRetries = 60; // 3 mins
    let retries = 0;

    const interval = setInterval(async () => {
      try {
        retries++;
        const result = await this.videoGeneratorPort.queryTaskStatus(externalTaskId);
        
        if (result.status === 'SUCCESS' || result.status === 'FAILED') {
          clearInterval(interval);
          await this.videoTaskRepo.updateStatus(taskId, result.status, result.videoUrl, result.errorMessage);
        } else if (retries >= maxRetries) {
          clearInterval(interval);
          await this.videoTaskRepo.updateStatus(taskId, 'FAILED', undefined, 'Polling timeout');
        }
      } catch (error: any) {
        clearInterval(interval);
        await this.videoTaskRepo.updateStatus(taskId, 'FAILED', undefined, error.message || 'Poll failed');
      }
    }, pollInterval);
  }
}
