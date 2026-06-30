/**
 * useObjectUrl Hook 单元测试
 *
 * 验证：
 * - blob 变化时 revoke 旧 URL 并创建新 URL
 * - 入参 null 时返回 null 且 revoke 旧 URL
 * - 组件卸载时自动 revoke
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useObjectUrl } from '../../ui/hooks/useObjectUrl';

describe('useObjectUrl', () => {
  let createdUrls: string[] = [];
  let revokedUrls: string[] = [];
  let originalCreate: typeof URL.createObjectURL | undefined;
  let originalRevoke: typeof URL.revokeObjectURL | undefined;

  beforeEach(() => {
    createdUrls = [];
    revokedUrls = [];
    originalCreate = URL.createObjectURL;
    originalRevoke = URL.revokeObjectURL;
    // jsdom 不提供 URL.createObjectURL，直接覆盖
    const urlMock = URL as unknown as {
      createObjectURL: (blob: Blob) => string;
      revokeObjectURL: (url: string) => void;
    };
    urlMock.createObjectURL = (blob: Blob) => {
      const id = `blob:test/${createdUrls.length}-${blob.size}`;
      createdUrls.push(id);
      return id;
    };
    urlMock.revokeObjectURL = (url: string) => {
      revokedUrls.push(url);
    };
  });

  afterEach(() => {
    const urlMock = URL as unknown as {
      createObjectURL: typeof URL.createObjectURL;
      revokeObjectURL: typeof URL.revokeObjectURL;
    };
    if (originalCreate) urlMock.createObjectURL = originalCreate;
    if (originalRevoke) urlMock.revokeObjectURL = originalRevoke;
    vi.restoreAllMocks();
  });

  it('returns null when blob is null', () => {
    const { result } = renderHook(() => useObjectUrl(null));
    expect(result.current).toBeNull();
    expect(createdUrls).toHaveLength(0);
  });

  it('creates URL when blob is provided', () => {
    const blob = new Blob(['x'], { type: 'text/plain' });
    const { result } = renderHook(() => useObjectUrl(blob));
    expect(result.current).not.toBeNull();
    expect(createdUrls).toHaveLength(1);
  });

  it('revokes old URL when blob changes', () => {
    const blob1 = new Blob(['a'], { type: 'text/plain' });
    const blob2 = new Blob(['bb'], { type: 'text/plain' });
    const { result, rerender } = renderHook(
      ({ blob }) => useObjectUrl(blob),
      { initialProps: { blob: blob1 } }
    );
    const firstUrl = result.current;
    expect(firstUrl).not.toBeNull();

    rerender({ blob: blob2 });
    expect(result.current).not.toBe(firstUrl);
    expect(revokedUrls).toContain(firstUrl);
  });

  it('revokes URL on unmount', () => {
    const blob = new Blob(['x'], { type: 'text/plain' });
    const { result, unmount } = renderHook(() => useObjectUrl(blob));
    const url = result.current!;
    expect(url).not.toBeNull();

    unmount();
    expect(revokedUrls).toContain(url);
  });

  it('returns null when blob becomes null after non-null', () => {
    const blob = new Blob(['x'], { type: 'text/plain' });
    const { result, rerender } = renderHook(
      ({ blob }: { blob: Blob | null }) => useObjectUrl(blob),
      { initialProps: { blob: blob as Blob | null } }
    );
    expect(result.current).not.toBeNull();

    rerender({ blob: null });
    expect(result.current).toBeNull();
  });

  it('does not create new URL if blob reference is stable', () => {
    const blob = new Blob(['x'], { type: 'text/plain' });
    const { rerender } = renderHook(() => useObjectUrl(blob));
    rerender();
    expect(createdUrls).toHaveLength(1);
  });
});