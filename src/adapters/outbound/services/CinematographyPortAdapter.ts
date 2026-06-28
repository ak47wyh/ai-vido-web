/**
 * CinematographyPortAdapter —— ICinematographyPort 的 Service 包装实现
 *
 * CinematographyService 的方法签名与 Port 完全一致，
 * 此适配器仅做依赖反转的"转接头"。
 */

import type { ICinematographyPort, ShotSuggestion, ShotType, CameraMovement } from '../../../domain/ports/DomainServicePorts';
import type { StorySegment } from '../../../domain/entities/models';
import { CinematographyService } from '../../../domain/services/CinematographyService';

export class CinematographyPortAdapter implements ICinematographyPort {
  constructor(private inner: CinematographyService) {}

  suggestShots(segment: StorySegment, characterNames: string[]): Promise<ShotSuggestion[]> {
    return this.inner.suggestShots(segment, characterNames);
  }

  planStoryboard(segments: StorySegment[], characterNames: string[]): Promise<ShotSuggestion[][]> {
    return this.inner.planStoryboard(segments, characterNames);
  }

  enhancePromptWithShot(basePrompt: string, shot: ShotSuggestion): Promise<string> {
    return this.inner.enhancePromptWithShot(basePrompt, shot);
  }

  getShotDescription(shot: ShotType, language: 'cn' | 'en'): string {
    return this.inner.getShotDescription(shot, language);
  }

  getAllShotTypes(): ShotType[] {
    return this.inner.getAllShotTypes();
  }

  getAllMovements(): CameraMovement[] {
    return this.inner.getAllMovements();
  }
}
