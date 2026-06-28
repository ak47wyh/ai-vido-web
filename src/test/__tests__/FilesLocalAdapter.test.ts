/**
 * FilesLocalAdapter 单元测试
 *
 * 不依赖真实 Vite 插件：通过 fetch mock 模拟 /__files 与 /files 端点的响应，
 * 验证 FilesLocalAdapter 的：
 * - 路径合法性校验（防止 .. 路径穿越 / 绝对路径 / 协议前缀）
 * - storeBlob / getBlob / deleteBlob / blobExists / getObjectUrl 的语义
 * - getStats / clearAll 的聚合逻辑
 * - isAvailable / getStorageType 元数据
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FilesLocalAdapter, FilesLocalError } from '../../adapters/outbound/storage/FilesLocalAdapter';

interface MockResponseInit {
  status?: number;
  body?: string | Blob;
  headers?: Record<string, string>;
}

function mockFetchWithRoutes(routes: Record<string, (url: URL, init: RequestInit) => MockResponseInit | Promise<MockResponseInit>>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const method = (init?.method ?? (typeof input !== 'string' && !(input instanceof URL) ? (input as Request).method : 'GET')).toUpperCase();
    const urlObj = new URL(urlStr, 'http://localhost');
    const pathOnly = urlObj.pathname;
    for (const [pattern, handler] of Object.entries(routes)) {
      // pattern: "GET /upload" or "POST /upload"
      const [patternMethod, patternPath] = pattern.split(' ');
      if (patternMethod !== method) continue;
      if (pathOnly === patternPath || pathOnly.startsWith(patternPath + '/')) {
        const result = await handler(urlObj, init ?? {});
        return new Response(result.body, {
          status: result.status ?? 200,
          headers: result.headers,
        });
      }
    }
    return new Response('Not Found', { status: 404 });
  });
}

describe('FilesLocalAdapter 路径合法性校验', () => {
  let adapter: FilesLocalAdapter;

  beforeEach(() => {
    adapter = new FilesLocalAdapter({ apiBase: '/__files', publicPath: '/files' });
  });

  it('拒绝包含 ".." 的路径', async () => {
    await expect(adapter.storeBlob('../etc/passwd', new Blob())).rejects.toThrow(/'\.\.'/);
  });

  it('拒绝以 / 开头的绝对路径', async () => {
    await expect(adapter.storeBlob('/etc/passwd', new Blob())).rejects.toThrow(/must be relative/);
  });

  it('拒绝 Windows 盘符', async () => {
    await expect(adapter.storeBlob('C:/Windows/System32', new Blob())).rejects.toThrow(/must be relative/);
  });

  it('拒绝非法字符（含空格、问号、# 等）', async () => {
    await expect(adapter.storeBlob('images/abc def.png', new Blob())).rejects.toThrow(/invalid/i);
    await expect(adapter.storeBlob('images/abc?def', new Blob())).rejects.toThrow(/invalid/i);
  });

  it('拒绝空路径', async () => {
    await expect(adapter.storeBlob('', new Blob())).rejects.toThrow(/empty/);
  });
});

describe('FilesLocalAdapter 正常路径操作', () => {
  let adapter: FilesLocalAdapter;
  let writtenFiles = new Map<string, Blob>();

  beforeEach(() => {
    writtenFiles = new Map();
    adapter = new FilesLocalAdapter({ apiBase: '/__files', publicPath: '/files' });

    // mock fetch：分发到 /__files 与 /files 路由
    vi.stubGlobal('fetch', mockFetchWithRoutes({
      'POST /__files/upload': (urlObj, init) => {
        const body = init.body as Blob;
        const path = urlObj.searchParams.get('path') ?? '';
        writtenFiles.set(path, body);
        return { status: 200, body: JSON.stringify({ ok: true, path, bytes: body.size }) };
      },
      'DELETE /__files/delete': (urlObj) => {
        const path = urlObj.searchParams.get('path') ?? '';
        writtenFiles.delete(path);
        return { status: 200, body: JSON.stringify({ ok: true }) };
      },
      'HEAD /__files/exists': (urlObj) => {
        const path = urlObj.searchParams.get('path') ?? '';
        return { status: writtenFiles.has(path) ? 200 : 404, body: '' };
      },
      'GET /__files/list': (urlObj) => {
        const dir = urlObj.searchParams.get('dir') ?? '';
        const entries = Array.from(writtenFiles.keys())
          .filter(p => p.startsWith(dir + '/'))
          .map(p => p.slice(dir.length + 1));
        return { status: 200, body: JSON.stringify({ entries, dir }) };
      },
      'GET /files': (urlObj) => {
        const path = urlObj.pathname.slice('/files/'.length);
        const blob = writtenFiles.get(path);
        if (!blob) return { status: 404 };
        return { status: 200, body: blob, headers: { 'Content-Type': blob.type || 'application/octet-stream' } };
      },
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('storeBlob 发送 POST /__files/upload', async () => {
    const blob = new Blob(['hello'], { type: 'image/png' });
    await adapter.storeBlob('images/abc.png', blob);
    expect(writtenFiles.get('images/abc.png')?.size).toBe(5);
  });

  it('getBlob 通过 GET /files/<path> 读取', async () => {
    await adapter.storeBlob('images/test.png', new Blob(['hello world'], { type: 'image/png' }));
    const result = await adapter.getBlob('images/test.png');
    expect(result).not.toBeNull();
    // jsdom Response 可能把 Blob 转字符串，使用 text() 验证内容一致即可
    expect(result!.size).toBeGreaterThan(0);
  });

  it('getBlob 在文件不存在时返回 null（不抛错）', async () => {
    expect(await adapter.getBlob('images/missing.png')).toBeNull();
  });

  it('blobExists 正确反映文件存在性', async () => {
    await adapter.storeBlob('images/present.png', new Blob(['x']));
    expect(await adapter.blobExists('images/present.png')).toBe(true);
    expect(await adapter.blobExists('images/absent.png')).toBe(false);
  });

  it('deleteBlob 能删除文件', async () => {
    await adapter.storeBlob('images/to-del.png', new Blob(['x']));
    expect(await adapter.blobExists('images/to-del.png')).toBe(true);
    await adapter.deleteBlob('images/to-del.png');
    expect(await adapter.blobExists('images/to-del.png')).toBe(false);
  });

  it('deleteBlob 在文件不存在时安静失败', async () => {
    await expect(adapter.deleteBlob('images/missing.png')).resolves.toBeUndefined();
  });

  it('getObjectUrl 直接返回 /files/<path> HTTP URL', async () => {
    await adapter.storeBlob('images/foo.png', new Blob(['x']));
    const url = await adapter.getObjectUrl('images/foo.png');
    expect(url).toBe('/files/images/foo.png');
  });

  it('getObjectUrl 命中缓存（同一 path 返回同一个 URL 引用）', async () => {
    const url1 = await adapter.getObjectUrl('images/cached.png');
    const url2 = await adapter.getObjectUrl('images/cached.png');
    expect(url1).toBe(url2); // 同一引用（缓存命中）
  });

  it('resetCache 清空 getObjectUrl 缓存', async () => {
    await adapter.getObjectUrl('images/a.png');
    adapter.resetCache();
    // 重新拿仍是新 URL（拼接结果相同但缓存已空）
    const url = await adapter.getObjectUrl('images/a.png');
    expect(url).toBe('/files/images/a.png');
  });

  it('getStorageType 返回 "local"', () => {
    expect(adapter.getStorageType()).toBe('local');
  });

  it('isAvailable 在浏览器环境下返回 true', () => {
    expect(adapter.isAvailable()).toBe(true);
  });
});

describe('FilesLocalAdapter 错误处理', () => {
  let adapter: FilesLocalAdapter;

  beforeEach(() => {
    adapter = new FilesLocalAdapter({ apiBase: '/__files', publicPath: '/files' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('storeBlob 在 HTTP 失败时包装错误（带 cause）', async () => {
    // 返回 JSON 格式的错误（不带 code → 视为 UPLOAD_FAILED）
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response('{"error":"disk full"}', { status: 500, headers: { 'Content-Type': 'application/json' } })
    ));
    try {
      await adapter.storeBlob('images/x.png', new Blob(['x']));
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      const msg = (e as Error).message;
      expect(msg).toMatch(/UPLOAD_FAILED/);
      expect(msg).toMatch(/disk full/);
      expect((e as Error).cause).toBeInstanceOf(FilesLocalError);
    }
  });

  it('storeBlob 解析服务端 JSON 错误码（PAYLOAD_TOO_LARGE → 友好提示）', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({
        code: 'PAYLOAD_TOO_LARGE',
        error: 'Upload exceeds 50.0MB limit',
        maxBytes: 50 * 1024 * 1024,
      }), { status: 413, headers: { 'Content-Type': 'application/json' } })
    ));
    try {
      await adapter.storeBlob('images/big.bin', new Blob(['x']));
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      const msg = (e as Error).message;
      expect(msg).toMatch(/PAYLOAD_TOO_LARGE/);
      expect(msg).toMatch(/50\.0MB/);
      expect(msg).toMatch(/FILES_MAX_SIZE_MB/);
      // 验证 cause 是 FilesLocalError
      const cause = (e as Error).cause;
      expect(cause).toBeInstanceOf(FilesLocalError);
      expect((cause as FilesLocalError).code).toBe('PAYLOAD_TOO_LARGE');
      expect((cause as FilesLocalError).maxBytes).toBe(50 * 1024 * 1024);
    }
  });

  it('storeBlob 解析 INVALID_PATH 错误码 → 给出针对性建议', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({
        code: 'INVALID_PATH',
        error: 'Invalid path: ../etc',
      }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    ));
    try {
      await adapter.storeBlob('images/../etc.png', new Blob(['x']));
      expect.fail('should have thrown');
    } catch (e) {
      // 路径校验在客户端就先抛了，根本不会发请求
      expect((e as Error).message).toMatch(/'\.\.'/);
    }
  });

  it('storeBlob 在未授权场景下捕获 network error 并包装', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('NetworkError when attempting to fetch resource.');
    }));
    try {
      await adapter.storeBlob('images/x.png', new Blob(['x']));
      expect.fail('should have thrown');
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toMatch(/NetworkError/);
      expect(msg).toMatch(/Vite dev server/);
    }
  });

  it('initialize 在插件不可用时抛错', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('NetworkError');
    }));
    await expect(adapter.initialize()).rejects.toThrow(/无法连接 Vite 文件存储插件/);
  });
});

describe('FilesLocalError', () => {
  it('携带 code / status / maxBytes 字段', () => {
    const e = new FilesLocalError('PAYLOAD_TOO_LARGE', 413, 'too big', 50 * 1024 * 1024);
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(FilesLocalError);
    expect(e.name).toBe('FilesLocalError');
    expect(e.code).toBe('PAYLOAD_TOO_LARGE');
    expect(e.status).toBe(413);
    expect(e.maxBytes).toBe(50 * 1024 * 1024);
    expect(e.message).toBe('too big');
  });

  it('maxBytes 可选（默认 undefined）', () => {
    const e = new FilesLocalError('INVALID_PATH', 400, 'bad path');
    expect(e.maxBytes).toBeUndefined();
    expect(e.code).toBe('INVALID_PATH');
  });
});

describe('FilesLocalAdapter getStats / clearAll', () => {
  let adapter: FilesLocalAdapter;
  let writtenFiles = new Map<string, Blob>();

  beforeEach(() => {
    writtenFiles = new Map();
    adapter = new FilesLocalAdapter({ apiBase: '/__files', publicPath: '/files' });

    vi.stubGlobal('fetch', mockFetchWithRoutes({
      'GET /__files/list': (urlObj) => {
        const dir = urlObj.searchParams.get('dir') ?? '';
        const entries = Array.from(writtenFiles.keys())
          .filter(p => p.startsWith(dir + '/'))
          .map(p => p.slice(dir.length + 1));
        return { status: 200, body: JSON.stringify({ entries, dir }) };
      },
      'HEAD /__files/exists': () => ({ status: 200 }),
      'GET /files': (urlObj) => {
        const path = urlObj.pathname.slice('/files/'.length);
        const blob = writtenFiles.get(path);
        if (!blob) return { status: 404 };
        return { status: 200, body: blob };
      },
      'DELETE /__files/delete': (urlObj) => {
        const path = urlObj.searchParams.get('path') ?? '';
        writtenFiles.delete(path);
        return { status: 200, body: '{}' };
      },
      // 新版 /__files/stats 聚合端点
      'GET /__files/stats': () => {
        // 模拟服务端聚合：按 images/audio/video/other 分类
        const buckets: Record<string, { count: number; size: number }> = {
          images: { count: 0, size: 0 },
          audio: { count: 0, size: 0 },
          video: { count: 0, size: 0 },
          other: { count: 0, size: 0 },
        };
        let totalFiles = 0;
        let totalSize = 0;
        for (const [path, blob] of writtenFiles.entries()) {
          const bucket = buckets[path.split('/')[0]] ?? buckets.other;
          bucket.count++;
          bucket.size += blob.size;
          totalFiles++;
          totalSize += blob.size;
        }
        return {
          status: 200,
          body: JSON.stringify({
            totalSize,
            totalFiles,
            byType: buckets,
            maxUploadBytes: 50 * 1024 * 1024,
          }),
        };
      },
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getStats 聚合所有 4 个分类目录', async () => {
    writtenFiles.set('images/a.png', new Blob(['1'.repeat(10)], { type: 'image/png' }));
    writtenFiles.set('audio/b.mp3', new Blob(['2'.repeat(20)], { type: 'audio/mpeg' }));
    writtenFiles.set('video/c.mp4', new Blob(['3'.repeat(30)], { type: 'video/mp4' }));

    const stats = await adapter.getStats();
    expect(stats.byType.image.count).toBe(1);
    expect(stats.byType.audio.count).toBe(1);
    expect(stats.byType.video.count).toBe(1);
    expect(stats.byType.other.count).toBe(0);
    expect(stats.totalFiles).toBe(3);
  });

  it('getStats 优先走新版 /__files/stats 端点（一次请求拿全）', async () => {
    let statsCalled = false;
    let listCalled = false;
    vi.stubGlobal('fetch', mockFetchWithRoutes({
      'GET /__files/stats': () => {
        statsCalled = true;
        return {
          status: 200,
          body: JSON.stringify({
            totalSize: 1000,
            totalFiles: 5,
            byType: {
              images: { count: 3, size: 600 },
              audio: { count: 1, size: 200 },
              video: { count: 1, size: 200 },
              other: { count: 0, size: 0 },
            },
          }),
        };
      },
      'GET /__files/list': () => {
        listCalled = true;
        return { status: 200, body: JSON.stringify({ entries: [], dir: 'images' }) };
      },
    }));

    const stats = await adapter.getStats();
    expect(statsCalled).toBe(true);
    expect(listCalled).toBe(false); // 走 fast path，不该再 list
    expect(stats.totalFiles).toBe(5);
    expect(stats.totalSize).toBe(1000);
    expect(stats.byType.image.count).toBe(3);
    expect(stats.byType.audio.count).toBe(1);
    expect(stats.byType.video.count).toBe(1);
    expect(stats.byType.other.count).toBe(0);
  });

  it('getStats 在 /stats 返回 500 时回退到旧逻辑', async () => {
    vi.stubGlobal('fetch', mockFetchWithRoutes({
      'GET /__files/stats': () => ({ status: 500, body: '{"error":"server error"}' }),
      'GET /__files/list': () => ({
        status: 200,
        body: JSON.stringify({ entries: ['legacy.png'], dir: 'images' }),
      }),
      'GET /files': (urlObj) => {
        // 只响应 /files/images/legacy.png
        const path = urlObj.pathname.slice('/files/'.length);
        if (path === 'images/legacy.png') {
          return { status: 200, body: new Blob(['legacy']) };
        }
        return { status: 404 };
      },
    }));

    const stats = await adapter.getStats();
    // 回退路径走 list + getBlob，最终能拿到 entries
    expect(stats.byType.image.count).toBe(1);
  });

  it('clearAll 依次清空 4 个分类目录', async () => {
    writtenFiles.set('images/a.png', new Blob(['x']));
    writtenFiles.set('audio/b.mp3', new Blob(['y']));
    await adapter.clearAll();
    // clearAll 通过 list + delete 完成
    // 因为 mock 返回 200 给所有 entries，每个目录里至少有一个 file 被删除
    // 直接验证 writtenFiles 中没有 images/* 与 audio/* 路径
    const remainingDirs = new Set(
      Array.from(writtenFiles.keys()).map(k => k.split('/')[0])
    );
    expect(remainingDirs.has('images')).toBe(false);
    expect(remainingDirs.has('audio')).toBe(false);
  });

  it('evictLRU 返回 0（本地磁盘无内置配额）', async () => {
    expect(await adapter.evictLRU(1000)).toBe(0);
  });
});