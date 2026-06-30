/**
 * TimelineService —— 时间线编排服务
 *
 * 职责：
 * - 加载/保存 Timeline（复用 ITimelineRepository，激活"已就位未通电"的仓储）
 * - 从故事的分镜 + VideoTask 自动铺轨（素材铺轨 F-03）
 * - 创建空时间线
 *
 * 不做渲染（由 TimelineRenderService 负责），不做底层 FFmpeg 操作。
 */

import { v4 as uuidv4 } from 'uuid';
import type { Timeline, TimelineTrack, TimelineClip } from '../ports/PostProcessPorts';
import type { ITimelineRepository } from '../ports/PersistencePorts';
import type { IStoryRepository, IStorySegmentRepository, IVideoTaskRepository } from '../ports/OutboundPorts';

export interface TimelineServiceDeps {
  timelineRepo: ITimelineRepository;
  storyRepo: IStoryRepository;
  segmentRepo: IStorySegmentRepository;
  videoTaskRepo: IVideoTaskRepository;
}

const VIDEO_TRACK_ID = 'track_video';
const NARRATION_TRACK_ID = 'track_narration';
const BGM_TRACK_ID = 'track_bgm';
const SUBTITLE_TRACK_ID = 'track_subtitle';

export class TimelineService {
  private deps: TimelineServiceDeps;

  constructor(deps: TimelineServiceDeps) {
    this.deps = deps;
  }

  /** 加载某故事的最新时间线，无则返回 null */
  async loadByStoryId(storyId: string): Promise<Timeline | null> {
    const list = await this.deps.timelineRepo.findByStoryId(storyId);
    return list[0] ?? null;
  }

  async save(timeline: Timeline): Promise<void> {
    await this.deps.timelineRepo.save({ ...timeline, updatedAt: Date.now() });
  }

  async delete(id: string): Promise<void> {
    await this.deps.timelineRepo.delete(id);
  }

  /** 创建空时间线（含默认 4 轨） */
  createEmpty(storyId: string): Timeline {
    const now = Date.now();
    return {
      id: uuidv4(),
      storyId,
      duration: 0,
      tracks: [
        { id: VIDEO_TRACK_ID, type: 'video', clips: [] },
        { id: NARRATION_TRACK_ID, type: 'audio', clips: [] },
        { id: BGM_TRACK_ID, type: 'audio', clips: [] },
        { id: SUBTITLE_TRACK_ID, type: 'subtitle', clips: [] },
      ],
      transitions: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * 从故事的分镜 + VideoTask 自动铺轨（F-03）。
   * 仅当时间线为空（无视频 clip）时执行铺轨，避免覆盖用户已有编辑。
   *
   * - 视频轨：按 segment.sequenceOrder，每个 SUCCESS 的 VideoTask 一个 clip
   * - 旁白轨：segment.narrationAudioStoragePath → clip
   * - BGM 轨：segment.bgmStoragePath / bgmAudioUrl → clip
   */
  async buildFromStory(storyId: string): Promise<Timeline> {
    const existing = await this.loadByStoryId(storyId);
    if (existing && existing.tracks.some(t => t.type === 'video' && t.clips.length > 0)) {
      return existing;
    }

    const story = await this.deps.storyRepo.findById(storyId);
    if (!story) throw new Error('Story not found');

    const segments = (await this.deps.segmentRepo.findByStoryId(storyId))
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder);

    const timeline = existing ?? this.createEmpty(storyId);
    const videoTrack = this.ensureTrack(timeline, VIDEO_TRACK_ID, 'video');
    const narrationTrack = this.ensureTrack(timeline, NARRATION_TRACK_ID, 'audio');
    const bgmTrack = this.ensureTrack(timeline, BGM_TRACK_ID, 'audio');

    let cursorMs = 0;
    const DEFAULT_CLIP_MS = 6000;

    for (const seg of segments) {
      const task = await this.deps.videoTaskRepo.findLatestBySegmentId(seg.id);
      if (task && task.status === 'SUCCESS') {
        const clipMs = (task.duration ?? 6) * 1000;
        videoTrack.clips.push(this.makeClip(videoTrack.id, 'video', cursorMs, clipMs, {
          source: `分镜 ${seg.sequenceOrder + 1}`,
          sourceRef: { kind: 'videoTask', refId: task.id, storagePath: task.videoStoragePath },
        }));
        cursorMs += clipMs;
      }

      if (seg.narrationAudioStoragePath) {
        narrationTrack.clips.push(this.makeClip(narrationTrack.id, 'audio', 0, DEFAULT_CLIP_MS, {
          source: `旁白 ${seg.sequenceOrder + 1}`,
          sourceRef: { kind: 'savedVoice', refId: '', storagePath: seg.narrationAudioStoragePath },
        }));
      }

      if (seg.bgmStoragePath) {
        bgmTrack.clips.push(this.makeClip(bgmTrack.id, 'audio', 0, cursorMs || DEFAULT_CLIP_MS, {
          source: `BGM ${seg.sequenceOrder + 1}`,
          sourceRef: { kind: 'savedVoice', refId: '', storagePath: seg.bgmStoragePath },
        }));
      }
    }

    timeline.duration = cursorMs;
    await this.save(timeline);
    return timeline;
  }

  /** 以单个 FinalCut 作为一段视频素材铺轨（场景 B：二次剪辑） */
  async buildFromFinalCut(storyId: string, finalCutId: string, durationSec: number): Promise<Timeline> {
    const timeline = this.createEmpty(storyId);
    const videoTrack = this.ensureTrack(timeline, VIDEO_TRACK_ID, 'video');
    const clipMs = Math.round(durationSec * 1000);
    videoTrack.clips.push(this.makeClip(videoTrack.id, 'video', 0, clipMs, {
      source: '成片',
      sourceRef: { kind: 'finalCut', refId: finalCutId },
    }));
    timeline.duration = clipMs;
    await this.save(timeline);
    return timeline;
  }

  private ensureTrack(timeline: Timeline, trackId: string, type: TimelineTrack['type']): TimelineTrack {
    let track = timeline.tracks.find(t => t.id === trackId);
    if (!track) {
      track = { id: trackId, type, clips: [] };
      timeline.tracks.push(track);
    }
    return track;
  }

  private makeClip(
    trackId: string,
    type: TimelineClip['type'],
    startTime: number,
    duration: number,
    extra: Partial<TimelineClip>,
  ): TimelineClip {
    return {
      id: uuidv4(),
      type,
      trackId,
      startTime,
      duration,
      ...extra,
    };
  }
}

export { VIDEO_TRACK_ID, NARRATION_TRACK_ID, BGM_TRACK_ID, SUBTITLE_TRACK_ID };
