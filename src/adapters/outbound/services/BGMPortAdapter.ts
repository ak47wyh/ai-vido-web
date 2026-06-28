/**
 * BGMPortAdapter —— IBGMRecommendationPort 的 Service 包装实现
 *
 * BGMRecommendationService 现有方法签名与 Port 完全一致，
 * 直接添加 implements 即可（保留原类，此处不创建包装类）。
 *
 * 但为了在 DI 容器中保持"接口 → 实现"模式，
 * 仍然提供 BGMPortAdapter 供测试和 mock 替换。
 */

import type { IBGMRecommendationPort, BGMRecommendation, BGMCategory } from '../../../domain/ports/DomainServicePorts';
import { BGMRecommendationService } from '../../../domain/services/BGMRecommendationService';

export class BGMPortAdapter implements IBGMRecommendationPort {
  constructor(private inner: BGMRecommendationService) {}

  recommend(segmentContent: string, characterNames: string[] = []): Promise<BGMRecommendation> {
    return this.inner.recommend(segmentContent, characterNames);
  }

  recommendSequence(segments: string[]): Promise<BGMRecommendation[]> {
    return this.inner.recommendSequence(segments);
  }

  buildPrompt(category: BGMCategory, customEmotion?: string): string {
    return this.inner.buildPrompt(category, customEmotion);
  }

  getAllCategories(): BGMCategory[] {
    return this.inner.getAllCategories();
  }
}
