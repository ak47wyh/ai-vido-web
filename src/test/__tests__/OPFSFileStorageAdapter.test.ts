/**
 * OPFSFileStorageAdapter 路径解析单元测试
 *
 * 背景：
 *   此前 OPFSFileStorageAdapter 的 storeBlob / getBlob / deleteBlob 直接把
 *   "images/abc123" 这种带斜杠的路径传给 rootDir.getFileHandle，
 *   OPFS 拒绝（FileSystemDirectoryHandle 不支持斜杠分隔的路径），
 *   导致图片保存必定抛 "TypeError: 文件名非法" 之类的错误。
 *
 *   修复后使用 resolveFileHandle + resolveDirectory 逐级 getDirectoryHandle 行走。
 *   本测试不依赖真实 OPFS（jsdom 没有），通过 mock FileSystemDirectoryHandle
 *   验证路径解析逻辑的正确性。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OPFSFileStorageAdapter } from '../../adapters/outbound/storage/OPFSFileStorageAdapter';

// ===== Mock FileSystemDirectoryHandle =====

interface MockFileHandle {
  kind: 'file';
  name: string;
  getFile: () => Promise<{ name: string; size: number; type: string }>;
  createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
  _contents?: Blob;
}

interface MockDirectoryHandle {
  kind: 'directory';
  name: string;
  children: Map<string, MockDirectoryHandle | MockFileHandle>;
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<MockDirectoryHandle>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<MockFileHandle>;
  removeEntry: (name: string) => Promise<void>;
  values: () => AsyncIterableIterator<MockDirectoryHandle | MockFileHandle>;
}

function createMockDir(name: string): MockDirectoryHandle {
  const dir: MockDirectoryHandle = {
    kind: 'directory',
    name,
    children: new Map(),
    async getDirectoryHandle(n, options) {
      const existing = dir.children.get(n);
      if (existing && existing.kind === 'directory') return existing;
      if (existing && existing.kind === 'file') throw new Error(`TypeMismatchError: ${n} is a file`);
      if (!options?.create) throw new Error(`NotFoundError: directory ${n} not found`);
      const sub = createMockDir(n);
      dir.children.set(n, sub);
      return sub;
    },
    async getFileHandle(n, options) {
      const existing = dir.children.get(n);
      if (existing && existing.kind === 'file') return existing;
      if (existing && existing.kind === 'directory') throw new Error(`TypeMismatchError: ${n} is a directory`);
      if (!options?.create) throw new Error(`NotFoundError: file ${n} not found`);
      const file: MockFileHandle = {
        kind: 'file',
        name: n,
        async getFile() {
          return { name: file.name, size: file._contents?.size ?? 0, type: file._contents?.type ?? 'application/octet-stream' };
        },
        async createWritable() {
          const chunks: BlobPart[] = [];
          return {
            async write(data: BlobPart) { chunks.push(data); file._contents = new Blob(chunks); },
            async close() { /* noop */ },
          };
        },
      };
      dir.children.set(n, file);
      return file;
    },
    async removeEntry(n) {
      if (!dir.children.has(n)) throw new Error(`NotFoundError: ${n}`);
      dir.children.delete(n);
    },
    async *values() {
      for (const c of dir.children.values()) yield c;
    },
  };
  return dir;
}

let mockRoot: MockDirectoryHandle;

beforeEach(() => {
  mockRoot = createMockDir('');
  vi.stubGlobal('navigator', {
    storage: {
      async getDirectory() { return mockRoot; },
    },
  });
  // jsdom 不提供 URL.createObjectURL / revokeObjectURL，手动 stub
  const activeUrls = new Map<string, Blob>();
  let counter = 0;
  vi.stubGlobal('URL', {
    createObjectURL: (blob: Blob) => {
      const url = `blob:mock-${++counter}`;
      activeUrls.set(url, blob);
      return url;
    },
    revokeObjectURL: (url: string) => {
      activeUrls.delete(url);
    },
  });
});

describe('OPFSFileStorageAdapter 路径解析', () => {
  let adapter: OPFSFileStorageAdapter;

  beforeEach(async () => {
    adapter = new OPFSFileStorageAdapter();
    await adapter.initialize();
  });

  it('initialize 后会自动创建 4 个分类子目录', async () => {
    expect(mockRoot.children.has('images')).toBe(true);
    expect(mockRoot.children.has('audio')).toBe(true);
    expect(mockRoot.children.has('video')).toBe(true);
    expect(mockRoot.children.has('other')).toBe(true);
  });

  it('storeBlob 可以写入 "images/abc123" 并在 images 子目录下创建文件', async () => {
    const blob = new Blob(['hello image'], { type: 'image/png' });
    await adapter.storeBlob('images/abc123', blob);

    const imagesDir = mockRoot.children.get('images') as MockDirectoryHandle;
    expect(imagesDir).toBeDefined();
    expect(imagesDir.children.has('abc123')).toBe(true);

    const file = imagesDir.children.get('abc123') as MockFileHandle;
    expect(file._contents?.size).toBe('hello image'.length);
  });

  it('storeBlob 支持多层路径 "images/sub/foo.png"', async () => {
    const blob = new Blob(['nested'], { type: 'image/png' });
    await adapter.storeBlob('images/sub/foo.png', blob);

    const imagesDir = mockRoot.children.get('images') as MockDirectoryHandle;
    const subDir = imagesDir.children.get('sub') as MockDirectoryHandle;
    expect(subDir).toBeDefined();
    expect(subDir.kind).toBe('directory');
    expect(subDir.children.has('foo.png')).toBe(true);
  });

  it('getBlob 能读取已写入的文件', async () => {
    const blob = new Blob(['hello world'], { type: 'image/png' });
    await adapter.storeBlob('images/test-id', blob);

    const read = await adapter.getBlob('images/test-id');
    expect(read).not.toBeNull();
    expect(read?.size).toBe('hello world'.length);
  });

  it('getBlob 在文件不存在时返回 null（不抛错）', async () => {
    const read = await adapter.getBlob('images/nonexistent');
    expect(read).toBeNull();
  });

  it('getBlob 在路径不含目录时返回 null', async () => {
    const read = await adapter.getBlob('no-slash-here');
    expect(read).toBeNull();
  });

  it('blobExists 正确反映文件存在性', async () => {
    await adapter.storeBlob('images/present', new Blob(['x']));
    expect(await adapter.blobExists('images/present')).toBe(true);
    expect(await adapter.blobExists('images/missing')).toBe(false);
  });

  it('deleteBlob 能删除已写入的文件', async () => {
    await adapter.storeBlob('images/to-delete', new Blob(['x']));
    expect(await adapter.blobExists('images/to-delete')).toBe(true);

    await adapter.deleteBlob('images/to-delete');
    expect(await adapter.blobExists('images/to-delete')).toBe(false);
  });

  it('deleteBlob 在文件不存在时安静失败', async () => {
    await expect(adapter.deleteBlob('images/missing')).resolves.toBeUndefined();
  });

  it('deleteBlob 在路径不含目录时安静失败', async () => {
    await expect(adapter.deleteBlob('no-slash')).resolves.toBeUndefined();
  });

  it('isAvailable 返回 true（mock 下 navigator.storage 存在）', () => {
    expect(adapter.isAvailable()).toBe(true);
  });

  it('getStorageType 返回 "opfs"', () => {
    expect(adapter.getStorageType()).toBe('opfs');
  });

  it('getObjectUrl 在文件存在时返回 object URL', async () => {
    await adapter.storeBlob('images/with-url', new Blob(['x'], { type: 'image/png' }));
    const url = await adapter.getObjectUrl('images/with-url');
    expect(url).toMatch(/^blob:/);
    adapter.revokeObjectUrl(url);
  });

  it('getObjectUrl 在文件不存在时抛错（带路径信息）', async () => {
    await expect(adapter.getObjectUrl('images/missing')).rejects.toThrow(/images\/missing/);
  });

  it('clearAll 删除所有子目录下的文件', async () => {
    await adapter.storeBlob('images/a', new Blob(['x']));
    await adapter.storeBlob('audio/b', new Blob(['y']));
    await adapter.storeBlob('video/c.mp4', new Blob(['z'], { type: 'video/mp4' }));

    await adapter.clearAll();

    expect(await adapter.blobExists('images/a')).toBe(false);
    expect(await adapter.blobExists('audio/b')).toBe(false);
    expect(await adapter.blobExists('video/c.mp4')).toBe(false);
  });
});

describe('OPFSFileStorageAdapter 未初始化时的行为', () => {
  it('ensureInitialized 在未 initialize 时抛错', async () => {
    const adapter = new OPFSFileStorageAdapter();
    await expect(adapter.storeBlob('images/x', new Blob())).rejects.toThrow(/initialize/);
    await expect(adapter.getBlob('images/x')).rejects.toThrow(/initialize/);
    await expect(adapter.blobExists('images/x')).rejects.toThrow(/initialize/);
    await expect(adapter.deleteBlob('images/x')).rejects.toThrow(/initialize/);
  });
});