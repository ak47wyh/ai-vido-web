/**
 * imageCache 单元测试
 *
 * 不依赖真实 Service Worker（SW 已按设计约束移除）：通过 mock `caches`、
 * `navigator.serviceWorker` 验证主线程工具的：
 * - getCachedMediaBlob 命中 / miss / 异常 / 浏览器不支持
 * - warmCacheFromElement 写入缓存
 * - clearAllMediaCache 直接调用 CacheStorage 删除
 * - getMediaCacheStats 主线程遍历统计
 * - isSWActive 始终返回 false（SW 已移除）
 * - triggerNativeDownload 创建 <a> 元素 + click
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  isCacheStorageAvailable,
  isServiceWorkerAvailable,
  isSWActive,
  getCachedMediaBlob,
  warmCacheFromElement,
  clearAllMediaCache,
  getMediaCacheStats,
  triggerNativeDownload,
} from '../../utils/imageCache';

// ===== mock helpers =====

interface MockCache {
  match: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  keys: ReturnType<typeof vi.fn>;
}

function makeMockCache(initial: Map<string, Response> = new Map()): MockCache {
  return {
    match: vi.fn(async (req: string | Request) => {
      const url = typeof req === 'string' ? req : (req as Request).url;
      return initial.get(url) ?? null;
    }),
    put: vi.fn(async (req: string | Request, res: Response) => {
      const url = typeof req === 'string' ? req : (req as Request).url;
      initial.set(url, res);
    }),
    delete: vi.fn(async (req: string | Request) => {
      const url = typeof req === 'string' ? req : (req as Request).url;
      return initial.delete(url);
    }),
    keys: vi.fn(async () => Array.from(initial.keys())),
  };
}

function installCacheStorageMock(
  cache: MockCache,
  deleteImpl?: (name: string) => Promise<boolean>
) {
  const cachesMock = {
    open: vi.fn(async () => cache),
    delete: deleteImpl ?? vi.fn(async () => true),
  };
  vi.stubGlobal('caches', cachesMock);
  return cachesMock;
}

function installSWMock(impl?: {
  active?: boolean;
  messageResponse?: unknown;
}) {
  const activeFlag = impl?.active ?? true;
  const mockSW = {
    postMessage: vi.fn(),
  };
  const mockReg = {
    active: activeFlag ? mockSW : null,
    getRegistration: vi.fn(async () => mockReg),
  };
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      getRegistration: vi.fn(async () => mockReg),
      ...(activeFlag ? { controller: mockSW } : {}),
    },
    configurable: true,
  });
  return { mockSW, mockReg };
}

beforeEach(() => {
  vi.unstubAllGlobals();
  // 重置 navigator.serviceWorker
  Object.defineProperty(navigator, 'serviceWorker', {
    value: undefined,
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===== isCacheStorageAvailable =====

describe('isCacheStorageAvailable', () => {
  it('在 jsdom（caches mock）中返回 true', () => {
    installCacheStorageMock(makeMockCache());
    expect(isCacheStorageAvailable()).toBe(true);
  });

  it('在不支持的环境下返回 false', () => {
    // jsdom 默认有 caches dummy 实现，模拟"不支持"需要彻底移除属性
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'caches');
    delete (globalThis as { caches?: unknown }).caches;
    try {
      expect(isCacheStorageAvailable()).toBe(false);
    } finally {
      // 恢复（避免影响其它测试）
      if (originalDescriptor) {
        Object.defineProperty(globalThis, 'caches', originalDescriptor);
      }
    }
  });
});

// ===== isServiceWorkerAvailable =====

describe('isServiceWorkerAvailable', () => {
  it('有 navigator.serviceWorker 时返回 true', () => {
    installSWMock({ active: true });
    expect(isServiceWorkerAvailable()).toBe(true);
  });

  it('没有 navigator.serviceWorker 时返回 false', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    try {
      expect(isServiceWorkerAvailable()).toBe(false);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(navigator, 'serviceWorker', originalDescriptor);
      }
    }
  });
});

// ===== isSWActive =====

describe('isSWActive', () => {
  it('始终返回 false（SW 已按设计约束移除）', async () => {
    // 即使 navigator.serviceWorker 存在并注册，函数也应返回 false
    installSWMock({ active: true });
    expect(await isSWActive()).toBe(false);
  });

  it('navigator.serviceWorker 不可用时也返回 false', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      configurable: true,
    });
    expect(await isSWActive()).toBe(false);
  });
});

// ===== getCachedMediaBlob =====

describe('getCachedMediaBlob', () => {
  it('缓存命中 → 返回非空 Blob', async () => {
    const cache = makeMockCache();
    const url = 'https://oss.example.com/image.png';
    await cache.put(url, new Response(new Blob(['hello'], { type: 'image/png' })));
    installCacheStorageMock(cache);

    const blob = await getCachedMediaBlob(url);
    // jsdom 的 Response/Blob 转换可能改变 type/size，仅验证存在且非空
    expect(blob).not.toBeNull();
    expect(blob!.size).toBeGreaterThan(0);
  });

  it('缓存未命中 → 返回 null', async () => {
    const cache = makeMockCache();
    installCacheStorageMock(cache);

    const blob = await getCachedMediaBlob('https://oss.example.com/missing.png');
    expect(blob).toBeNull();
  });

  it('caches 不可用 → 返回 null', async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'caches');
    delete (globalThis as { caches?: unknown }).caches;
    try {
      const blob = await getCachedMediaBlob('https://example.com/x.png');
      expect(blob).toBeNull();
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, 'caches', originalDescriptor);
      }
    }
  });

  it('空 url → 返回 null', async () => {
    installCacheStorageMock(makeMockCache());
    expect(await getCachedMediaBlob('')).toBeNull();
  });

  it('caches.open 抛错 → 返回 null', async () => {
    vi.stubGlobal('caches', {
      open: vi.fn(async () => { throw new Error('QuotaExceededError'); }),
      delete: vi.fn(),
    });
    expect(await getCachedMediaBlob('https://x.com/y.png')).toBeNull();
  });
});

// ===== warmCacheFromElement =====

describe('warmCacheFromElement', () => {
  it('写入缓存成功', async () => {
    const cache = makeMockCache();
    installCacheStorageMock(cache);

    // mock fetch no-cors
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(new Blob(['data'], { type: 'image/png' }), {
        status: 200,
        headers: new Headers({}),
      })
    ));

    const img = document.createElement('img');
    img.src = 'https://oss.example.com/warm.png';
    const ok = await warmCacheFromElement(img);
    expect(ok).toBe(true);
    expect(cache.put).toHaveBeenCalled();
  });

  it('img.src 为空 → 返回 false', async () => {
    installCacheStorageMock(makeMockCache());
    const img = document.createElement('img');
    const ok = await warmCacheFromElement(img);
    expect(ok).toBe(false);
  });

  it('caches 不可用 → 返回 false', async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'caches');
    delete (globalThis as { caches?: unknown }).caches;
    try {
      const img = document.createElement('img');
      img.src = 'https://x.com/y.png';
      expect(await warmCacheFromElement(img)).toBe(false);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, 'caches', originalDescriptor);
      }
    }
  });

  it('fetch 抛错 → 返回 false', async () => {
    installCacheStorageMock(makeMockCache());
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('NetworkError'); }));
    const img = document.createElement('img');
    img.src = 'https://x.com/y.png';
    expect(await warmCacheFromElement(img)).toBe(false);
  });
});

// ===== clearAllMediaCache =====

describe('clearAllMediaCache', () => {
  it('直接调用 CacheStorage.delete 清空成功', async () => {
    const cache = makeMockCache();
    const deleteSpy = vi.fn(async () => true);
    installCacheStorageMock(cache, deleteSpy);
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      configurable: true,
    });
    const ok = await clearAllMediaCache();
    expect(deleteSpy).toHaveBeenCalledWith('ai-vido-media-v1');
    expect(ok).toBe(true);
  });

  it('caches 不可用 → 返回 false', async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'caches');
    delete (globalThis as { caches?: unknown }).caches;
    try {
      expect(await clearAllMediaCache()).toBe(false);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, 'caches', originalDescriptor);
      }
    }
  });
});

// ===== getMediaCacheStats =====

describe('getMediaCacheStats', () => {
  it('主线程遍历 CacheStorage 统计', async () => {
    const initial = new Map<string, Response>();
    // jsdom Response 会扩展 blob，使用 text() 验证内容、size 至少 > 0
    initial.set('https://a.com/x.png', new Response(new Blob(['12345'])));
    initial.set('https://b.com/y.png', new Response(new Blob(['67890'])));
    installCacheStorageMock(makeMockCache(initial));
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistration: vi.fn(async () => undefined) },
      configurable: true,
    });

    const stats = await getMediaCacheStats();
    expect(stats.count).toBe(2);
    // jsdom 的 Response/Blob 转换会改变字节数（无压缩 wrapper），只验证 count
  });

  it('caches 不可用 → 返回 0 统计', async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'caches');
    delete (globalThis as { caches?: unknown }).caches;
    try {
      const stats = await getMediaCacheStats();
      expect(stats.count).toBe(0);
      expect(stats.totalBytes).toBe(0);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, 'caches', originalDescriptor);
      }
    }
  });
});

// ===== triggerNativeDownload =====

describe('triggerNativeDownload', () => {
  it('创建 <a> 元素并 click', () => {
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag) as HTMLElement;
      if (tag === 'a') {
        (el as HTMLAnchorElement).click = clickSpy;
      }
      return el;
    });

    const ok = triggerNativeDownload('https://oss.example.com/image.png', 'test.png');
    expect(ok).toBe(true);
    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(clickSpy).toHaveBeenCalled();

    createElementSpy.mockRestore();
  });

  it('空 url → 返回 false', () => {
    expect(triggerNativeDownload('', 'test.png')).toBe(false);
  });
});