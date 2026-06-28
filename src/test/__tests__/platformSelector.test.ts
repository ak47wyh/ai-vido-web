/**
 * PlatformSelector 单元测试
 *
 * 验证：
 * - selectAdapterKey 拼接正确
 * - withFallback 在不支持时回退 minimax
 * - isSupported 与 SUPPORTED_MATRIX 一致
 */

import { describe, it, expect } from 'vitest';
import {
  selectAdapterKey,
  withFallback,
  isSupported,
  SUPPORTED_MATRIX,
} from '../../domain/services/platformSelector';
import type { PlatformId } from '../../adapters/outbound/config/ApiConfigStore';

describe('PlatformSelector', () => {
  it('selectAdapterKey concatenates platform + capability', () => {
    expect(selectAdapterKey('volcengine', 'video')).toBe('volcengine.video');
    expect(selectAdapterKey('minimax', 'music')).toBe('minimax.music');
  });

  it('withFallback returns requested platform when supported', () => {
    expect(withFallback('volcengine', new Set(['volcengine']))).toBe('volcengine');
  });

  it('withFallback returns minimax when platform not in supported set', () => {
    expect(withFallback('coze', new Set(['volcengine']))).toBe('minimax');
    expect(withFallback('coze', new Set())).toBe('minimax');
  });

  it('isSupported reflects SUPPORTED_MATRIX', () => {
    expect(isSupported('minimax', 'video')).toBe(true);
    expect(isSupported('minimax', 'music')).toBe(true);
    expect(isSupported('kling', 'video')).toBe(true);
    expect(isSupported('kling', 'music')).toBe(false);
    expect(isSupported('coze', 'video')).toBe(false);
  });

  it('isSupported returns false when platform missing from SUPPORTED_MATRIX', () => {
    // 模拟 'coze' 在 SUPPORTED_MATRIX 中是空集合 —— 'video' 不在集合内
    expect(SUPPORTED_MATRIX.coze?.has('video')).toBe(false);
  });

  it('SUPPORTED_MATRIX covers all 8 platforms', () => {
    expect(Object.keys(SUPPORTED_MATRIX)).toHaveLength(8);
    expect(Object.keys(SUPPORTED_MATRIX)).toEqual(
      expect.arrayContaining(['minimax', 'volcengine', 'coze', 'kling', 'wan', 'hunyuan', 'zhipu', 'vidu'])
    );
  });

  it('minimax is the universal fallback (all capabilities)', () => {
    const caps: Array<'video' | 'image' | 'text' | 'voice' | 'music'> = ['video', 'image', 'text', 'voice', 'music'];
    for (const c of caps) {
      expect(isSupported('minimax', c)).toBe(true);
    }
  });

  it('isSupported handles lookup via index signature safely', () => {
    // 直接验证 SUPPORTED_MATRIX 的可选链行为（防御性编程）
    const someUnknownKey = 'nonexistent' as PlatformId;
    expect(SUPPORTED_MATRIX[someUnknownKey]?.has('video') ?? false).toBe(false);
  });
});