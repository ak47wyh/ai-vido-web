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
import { getErrorMessage } from '../../ui/utils/errorUtils';

export class VideoGenerationService {
  videoTaskRepo: IVideoTaskRepository;
  segmentRepo: IStorySegmentRepository;
  characterRepo: ICharacterRepository;
  backgroundRepo: IBackgroundRepository;
  videoGeneratorPort: IVideoGeneratorPort;

  private activePollers = new Map<string, ReturnType<typeof setInterval>>();

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
    if (!segment.selectedBackgroundId) throw new Error('Please select a background for this segment before generating video');

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

    const characterVoiceIds: Record<string, string> = {};
    for (const char of characters) {
      if (char.voiceId) {
        characterVoiceIds[char.name] = char.voiceId;
      }
    }

    const context: VideoPromptContext = {
      actionContent: segment.content,
      characters,
      background,
      videoStyle: 'default',
      characterVoiceIds: Object.keys(characterVoiceIds).length > 0 ? characterVoiceIds : undefined,
      bgmAudioUrl: segment.bgmAudioUrl,
    };

    this.processTask(task, context).catch(console.error);

    return task;
  }

  async getLatestTaskForSegment(segmentId: string): Promise<VideoTask | null> {
    return this.videoTaskRepo.findLatestBySegmentId(segmentId);
  }

  /** Resume polling for all active (PENDING/PROCESSING) tasks after page reload */
  async resumeActivePolling(): Promise<void> {
    const allTasks = await this.videoTaskRepo.findByStatuses(['PENDING', 'PROCESSING']);
    for (const task of allTasks) {
      if (task.externalTaskId && !this.activePollers.has(task.id)) {
        this.pollTaskStatus(task.id, task.externalTaskId);
      }
    }
  }

  /** Cancel all active polling intervals (call on app teardown) */
  cancelAllPolling(): void {
    for (const [taskId, interval] of this.activePollers) {
      clearInterval(interval);
      this.activePollers.delete(taskId);
    }
  }

  private async processTask(task: VideoTask, context: VideoPromptContext) {
    try {
      await this.videoTaskRepo.updateStatus(task.id, 'PROCESSING');
      const externalTaskId = await this.videoGeneratorPort.submitVideoTask(context);

      task.externalTaskId = externalTaskId;
      await this.videoTaskRepo.save(task);

      this.pollTaskStatus(task.id, externalTaskId);
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Submit failed');
      await this.videoTaskRepo.updateStatus(task.id, 'FAILED', undefined, message);
    }
  }

  private pollTaskStatus(taskId: string, externalTaskId: string) {
    // Clear any existing poller for this task
    const existing = this.activePollers.get(taskId);
    if (existing) clearInterval(existing);

    const pollInterval = 3000;
    const maxRetries = 60;
    let retries = 0;

    const interval = setInterval(async () => {
      try {
        retries++;
        const result = await this.videoGeneratorPort.queryTaskStatus(externalTaskId);

        if (result.status === 'SUCCESS' || result.status === 'FAILED') {
          clearInterval(interval);
          this.activePollers.delete(taskId);
          await this.videoTaskRepo.updateStatus(taskId, result.status, result.videoUrl, result.errorMessage);
        } else if (retries >= maxRetries) {
          clearInterval(interval);
          this.activePollers.delete(taskId);
          await this.videoTaskRepo.updateStatus(taskId, 'FAILED', undefined, 'Polling timeout');
        }
      } catch (error: unknown) {
        const message = getErrorMessage(error, 'Poll failed');
        clearInterval(interval);
        this.activePollers.delete(taskId);
        await this.videoTaskRepo.updateStatus(taskId, 'FAILED', undefined, message);
      }
    }, pollInterval);

    this.activePollers.set(taskId, interval);
  }
}
