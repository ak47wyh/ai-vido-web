import { v4 as uuidv4 } from 'uuid';
import type { PipelineTask, PipelineStatus, PipelineStep } from '../entities/models';
import type { IVideoTaskRepository } from '../ports/OutboundPorts';

export type { PipelineTask, PipelineStatus, PipelineStep };

export class PipelineService {
  private tasks: Map<string, PipelineTask> = new Map();
  private subscribers: Map<string, Set<(task: PipelineTask) => void>> = new Map();

  constructor(private videoTaskRepo: IVideoTaskRepository) {}

  subscribe(taskId: string, callback: (task: PipelineTask) => void): () => void {
    if (!this.subscribers.has(taskId)) this.subscribers.set(taskId, new Set());
    this.subscribers.get(taskId)!.add(callback);
    return () => {
      this.subscribers.get(taskId)?.delete(callback);
    };
  }

  getTask(taskId: string): PipelineTask | null {
    return this.tasks.get(taskId) ?? null;
  }

  listTasks(): PipelineTask[] {
    return Array.from(this.tasks.values());
  }

  private notify(task: PipelineTask): void {
    this.tasks.set(task.id, { ...task });
    this.subscribers.get(task.id)?.forEach(cb => cb(task));
  }

  private setStage(task: PipelineTask, stage: PipelineStatus, currentStep: string): void {
    task.status = stage;
    task.currentStep = currentStep;
    const step = task.steps.find(s => s.name === stage);
    if (step) {
      step.status = 'running';
      step.startedAt = Date.now();
    }
    this.notify(task);
  }

  private completeStage(task: PipelineTask, stage: PipelineStatus, error?: string): void {
    const step = task.steps.find(s => s.name === stage);
    if (step) {
      step.status = error ? 'failed' : 'done';
      step.completedAt = Date.now();
      if (error) step.error = error;
    }
    this.notify(task);
  }

  private initTask(storyId: string): PipelineTask {
    const stages: PipelineStatus[] = [
      'splitting',
      'generating_images',
      'generating_audio',
      'generating_bgm',
      'generating_videos',
      'post_processing',
      'generating_srt',
      'burning_subtitles',
      'complete'
    ];
    return {
      id: uuidv4(),
      storyId,
      status: 'idle',
      progress: 0,
      currentStep: 'Initializing',
      steps: stages.map(name => ({ name, status: 'pending' as const })),
      createdAt: Date.now()
    };
  }

  /**
   * 标记 Pipeline 任务为完成
   */
  markComplete(taskId: string, finalVideoUrl: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    this.completeStage(task, 'post_processing');
    this.completeStage(task, 'generating_srt');
    this.completeStage(task, 'burning_subtitles');
    this.completeStage(task, 'complete');
    task.status = 'complete';
    task.progress = 100;
    task.currentStep = 'Complete';
    task.finalVideoUrl = finalVideoUrl;
    task.completedAt = Date.now();
    this.notify(task);
  }

  /**
   * 标记 Pipeline 任务失败
   */
  markFailed(taskId: string, error: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = 'failed';
    task.error = error;
    task.currentStep = `Failed: ${error}`;
    task.completedAt = Date.now();
    const runningStep = task.steps.find(s => s.status === 'running');
    if (runningStep) {
      runningStep.status = 'failed';
      runningStep.error = error;
      runningStep.completedAt = Date.now();
    }
    this.notify(task);
  }

  /**
   * 更新进度
   */
  updateProgress(taskId: string, progress: number, currentStep?: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.progress = Math.max(0, Math.min(100, progress));
    if (currentStep) task.currentStep = currentStep;
    this.notify(task);
  }

  /**
   * 创建新任务（外部调用以启动 Pipeline）
   */
  createTask(storyId: string): PipelineTask {
    const task = this.initTask(storyId);
    this.tasks.set(task.id, task);
    this.notify(task);
    return task;
  }

  /**
   * 启动某个阶段
   */
  startStage(taskId: string, stage: PipelineStatus, currentStep: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    this.setStage(task, stage, currentStep);
    return true;
  }
}
