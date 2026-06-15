/**
 * useVideoTaskPolling — 视频任务轮询 Hook
 *
 * 自动轮询 videoTasks，按 taskId 索引返回实时状态。
 * 替代散落各处的 setInterval + useEffect 模式。
 */

import { useEffect, useRef, useState } from 'react';
import type { VideoTask } from '../../domain/entities/models';
import { videoGenerationService } from '../../dependencies';

export interface VideoTaskPollingState {
  /** taskId -> 实时状态 */
  statuses: Record<string, VideoTaskStatusInfo>;
  /** 是否所有任务都完成 */
  allDone: boolean;
  /** 总进度 0-100 */
  progress: number;
}

export interface VideoTaskStatusInfo {
  taskId: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  videoUrl?: string;
  error?: string;
}

export interface UseVideoTaskPollingOptions {
  intervalMs?: number;
  maxAttempts?: number;
  enabled?: boolean;
  onAllComplete?: (results: VideoTaskStatusInfo[]) => void;
}

/**
 * 轮询一组 video tasks
 */
export function useVideoTaskPolling(
  tasks: VideoTask[],
  options: UseVideoTaskPollingOptions = {}
): VideoTaskPollingState {
  const { intervalMs = 5000, maxAttempts = 120, enabled = true, onAllComplete } = options;

  const [statuses, setStatuses] = useState<Record<string, VideoTaskStatusInfo>>({});
  const attemptsRef = useRef(0);
  const allDoneRef = useRef(false);
  const onAllCompleteRef = useRef(onAllComplete);

  useEffect(() => {
    onAllCompleteRef.current = onAllComplete;
  }, [onAllComplete]);

  // 重置时清空
  useEffect(() => {
    if (tasks.length === 0) {
      setStatuses({});
      attemptsRef.current = 0;
      allDoneRef.current = false;
      return;
    }
    // 初始化已知状态
    setStatuses(prev => {
      const next = { ...prev };
      for (const t of tasks) {
        if (!next[t.id]) {
          next[t.id] = {
            taskId: t.id,
            status: t.status,
            videoUrl: t.videoUrl,
            error: t.errorMessage,
          };
        }
      }
      return next;
    });
  }, [tasks]);

  useEffect(() => {
    if (!enabled || tasks.length === 0) return;

    let cancelled = false;
    const pendingTasks = tasks.filter(t => t.status === 'PENDING' || t.status === 'PROCESSING');
    if (pendingTasks.length === 0) {
      allDoneRef.current = true;
      return;
    }

    const interval = setInterval(async () => {
      if (cancelled) return;
      attemptsRef.current++;
      const updated: Record<string, VideoTaskStatusInfo> = {};
      let pending = 0;
      for (const t of pendingTasks) {
        if (!t.externalTaskId) continue;
        try {
          const result = await videoGenerationService.videoGeneratorPort.queryTaskStatus(t.externalTaskId);
          if (cancelled) return;
          updated[t.id] = {
            taskId: t.id,
            status: result.status,
            videoUrl: result.videoUrl,
            error: result.errorMessage,
          };
          if (result.status === 'PENDING' || result.status === 'PROCESSING') pending++;
        } catch (e) {
          if (cancelled) return;
          updated[t.id] = {
            taskId: t.id,
            status: 'FAILED',
            error: String(e),
          };
        }
      }
      setStatuses(prev => ({ ...prev, ...updated }));
      if (pending === 0 || attemptsRef.current >= maxAttempts) {
        clearInterval(interval);
        allDoneRef.current = true;
        const finalResults = Object.values({ ...statuses, ...updated });
        onAllCompleteRef.current?.(finalResults);
      }
    }, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, maxAttempts, tasks.map(t => t.id).join(',')]);

  const totalTasks = tasks.length;
  const completedTasks = Object.values(statuses).filter(s => s.status === 'SUCCESS' || s.status === 'FAILED').length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    statuses,
    allDone: totalTasks > 0 && completedTasks === totalTasks,
    progress,
  };
}

/**
 * 单个视频任务轮询（适用于 StoryWorkbench 段卡片）
 */
export function useSingleVideoTaskPolling(
  task: VideoTask | null,
  options: { intervalMs?: number; enabled?: boolean } = {}
): VideoTaskStatusInfo | null {
  const { intervalMs = 5000, enabled = true } = options;
  const [status, setStatus] = useState<VideoTaskStatusInfo | null>(
    task ? { taskId: task.id, status: task.status, videoUrl: task.videoUrl, error: task.errorMessage } : null
  );

  useEffect(() => {
    if (!enabled || !task || !task.externalTaskId) return;
    if (task.status === 'SUCCESS' || task.status === 'FAILED') {
      setStatus({ taskId: task.id, status: task.status, videoUrl: task.videoUrl, error: task.errorMessage });
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const result = await videoGenerationService.videoGeneratorPort.queryTaskStatus(task.externalTaskId!);
        if (cancelled) return;
        setStatus({
          taskId: task.id,
          status: result.status,
          videoUrl: result.videoUrl,
          error: result.errorMessage,
        });
      } catch (e) {
        if (cancelled) return;
        setStatus({ taskId: task.id, status: 'FAILED', error: String(e) });
      }
    };
    tick();
    const interval = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [task?.id, task?.externalTaskId, task?.status, intervalMs, enabled]);

  return status;
}
