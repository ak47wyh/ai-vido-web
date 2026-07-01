import type { IFileStoragePort, FileStorageStats } from '../../../domain/ports/FileStoragePorts';
import type { GeneratedFileType } from '../../../domain/entities/models';
import { createTrackedObjectUrl, revokeObjectUrl as revokeTrackedObjectUrl } from '../../../utils/objectUrlRegistry';

/**
 * OPFS 文件存储适配器 — 使用 Origin Private File System API。
 *
 * 目录结构：
 *   <OPFS root>/
 *     ├── images/    (.png, .jpg, .webp)
 *     ├── audio/     (.mp3, .wav, .ogg)
 *     ├── video/     (.mp4, .webm)
 *     └── other/     (.glb 等)
 *
 * 路径约定：所有 path 参数为 "<dir>/<filename>" 形式（如 "images/abc123"）。
 * OPFS API 的 getFileHandle / getDirectoryHandle 都不接受斜杠分隔的路径，
 * 必须逐级 getDirectoryHandle 行走，最后再 getFileHandle。
 *
 * 浏览器兼容性：Chrome 86+, Edge 86+, Safari 15.2+, Firefox 111+
 */
export class OPFSFileStorageAdapter implements IFileStoragePort {
  private rootDir: FileSystemDirectoryHandle | null = null;
  private activeObjectUrls = new Set<string>();

  /** OPFS 子目录名称 */
  private static readonly DIRECTORIES: string[] = ['images', 'audio', 'video', 'other'];

  /** 默认存储配额 500MB */
  private static readonly DEFAULT_MAX_CAPACITY = 500 * 1024 * 1024;

  async initialize(): Promise<void> {
    if (this.rootDir) return;

    this.rootDir = await navigator.storage.getDirectory();

    // 创建分类子目录
    for (const dir of OPFSFileStorageAdapter.DIRECTORIES) {
      await this.rootDir.getDirectoryHandle(dir, { create: true });
    }
  }

  async storeBlob(path: string, blob: Blob): Promise<void> {
    this.ensureInitialized();
    try {
      const fileHandle = await this.resolveFileHandle(path, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch (e) {
      // 包装 OPFS 原始错误为更可读的提示，便于 UI 层展示给用户
      const reason = e instanceof Error ? e.message : String(e);
      throw new Error(
        `[OPFSFileStorage] 写入 "${path}" 失败：${reason}。` +
        `提示：OPFS 仅在 https / localhost 环境可用，且浏览器必须支持 File System Access API。`,
        { cause: e }
      );
    }
  }

  async getBlob(path: string): Promise<Blob | null> {
    this.ensureInitialized();
    try {
      const fileHandle = await this.resolveFileHandle(path, { create: false });
      return await fileHandle.getFile();
    } catch {
      return null;
    }
  }

  async deleteBlob(path: string): Promise<void> {
    this.ensureInitialized();
    const { dirHandle, fileName } = await this.resolveDirectory(path, { create: false });
    if (!dirHandle) return; // 路径无效，安静失败
    try {
      await dirHandle.removeEntry(fileName);
    } catch {
      // 文件不存在时忽略
    }
  }

  async blobExists(path: string): Promise<boolean> {
    this.ensureInitialized();
    try {
      await this.resolveFileHandle(path, { create: false });
      return true;
    } catch {
      return false;
    }
  }

  async getObjectUrl(path: string): Promise<string> {
    const blob = await this.getBlob(path);
    if (!blob) throw new Error(`[OPFSFileStorage] File not found: ${path}`);
    // 注册到全局 objectUrlRegistry（跨层追踪 + beforeunload 兜底释放）
    const url = createTrackedObjectUrl(blob);
    this.activeObjectUrls.add(url);
    return url;
  }

  revokeObjectUrl(url: string): void {
    if (this.activeObjectUrls.has(url)) {
      revokeTrackedObjectUrl(url);
      this.activeObjectUrls.delete(url);
    }
  }

  async getStats(): Promise<FileStorageStats> {
    this.ensureInitialized();
    const stats: FileStorageStats = {
      totalSize: 0,
      totalFiles: 0,
      byType: {
        image: { count: 0, size: 0 },
        audio: { count: 0, size: 0 },
        video: { count: 0, size: 0 },
        other: { count: 0, size: 0 },
      },
      maxCapacity: OPFSFileStorageAdapter.DEFAULT_MAX_CAPACITY,
    };

    for (const dirName of OPFSFileStorageAdapter.DIRECTORIES) {
      const fileType = this.dirToFileType(dirName);
      try {
        const dirHandle = await this.rootDir!.getDirectoryHandle(dirName);
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file') {
            const file = await (entry as FileSystemFileHandle).getFile();
            stats.byType[fileType].count++;
            stats.byType[fileType].size += file.size;
            stats.totalSize += file.size;
            stats.totalFiles++;
          }
        }
      } catch {
        // 目录不存在时跳过
      }
    }

    return stats;
  }

  async evictLRU(maxSizeBytes: number): Promise<number> {
    // OPFS 本身没有 LRU 元数据，LRU 淘汰由 IGeneratedFileRepository 驱动。
    // 此方法仅按文件修改时间做简单淘汰。
    this.ensureInitialized();
    const allFiles: { path: string; size: number; lastModified: number }[] = [];

    for (const dirName of OPFSFileStorageAdapter.DIRECTORIES) {
      try {
        const dirHandle = await this.rootDir!.getDirectoryHandle(dirName);
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file') {
            const file = await (entry as FileSystemFileHandle).getFile();
            allFiles.push({
              path: `${dirName}/${entry.name}`,
              size: file.size,
              lastModified: file.lastModified,
            });
          }
        }
      } catch {
        // 目录不存在时跳过
      }
    }

    // 按修改时间升序（最旧的先淘汰）
    allFiles.sort((a, b) => a.lastModified - b.lastModified);

    let totalSize = allFiles.reduce((sum, f) => sum + f.size, 0);
    let evictedBytes = 0;
    let i = 0;

    while (totalSize > maxSizeBytes && i < allFiles.length) {
      await this.deleteBlob(allFiles[i].path);
      totalSize -= allFiles[i].size;
      evictedBytes += allFiles[i].size;
      i++;
    }

    return evictedBytes;
  }

  async clearAll(): Promise<void> {
    this.ensureInitialized();

    // 释放所有活跃 Object URL（通过全局 registry 释放）
    for (const url of this.activeObjectUrls) {
      revokeTrackedObjectUrl(url);
    }
    this.activeObjectUrls.clear();

    // 删除所有子目录中的文件
    for (const dirName of OPFSFileStorageAdapter.DIRECTORIES) {
      try {
        const dirHandle = await this.rootDir!.getDirectoryHandle(dirName);
        const entriesToDelete: string[] = [];
        for await (const entry of dirHandle.values()) {
          entriesToDelete.push(entry.name);
        }
        for (const name of entriesToDelete) {
          await dirHandle.removeEntry(name);
        }
      } catch {
        // 目录不存在时跳过
      }
    }
  }

  isAvailable(): boolean {
    return !!(typeof navigator !== 'undefined' && navigator.storage?.getDirectory);
  }

  getStorageType(): 'opfs' {
    return 'opfs';
  }

  // ===== Private helpers =====

  private ensureInitialized(): void {
    if (!this.rootDir) {
      throw new Error('[OPFSFileStorage] Not initialized. Call initialize() first.');
    }
  }

  /**
   * 解析 "<dir>/<dir>/.../<filename>" 形式的逻辑路径，逐级 getDirectoryHandle 行走，
   * 最后返回文件句柄。
   *
   * 关键：OPFS 的 FileSystemDirectoryHandle.getFileHandle 不接受斜杠分隔的路径，
   *       必须一级一级地向下走。任何错误都会被上层调用方捕获（getBlob / blobExists
   *       会转换为 null/false，storeBlob 会向上抛错让 toast 显示）。
   *
   * @param path 逻辑路径，例如 "images/abc123" 或 "images/sub/foo.png"
   * @param options.create 是否在中间目录或文件不存在时创建
   */
  private async resolveFileHandle(
    path: string,
    options: { create: boolean }
  ): Promise<FileSystemFileHandle> {
    const { dirHandle, fileName } = await this.resolveDirectory(path, options);
    if (!dirHandle) {
      throw new Error(`[OPFSFileStorage] Invalid storage path: "${path}" (expected "<dir>/<filename>")`);
    }
    return await dirHandle.getFileHandle(fileName, { create: options.create });
  }

  /**
   * 解析路径并返回父目录句柄与文件名。
   * 路径非法（无斜杠）时返回 { dirHandle: null }，由 deleteBlob 等方法安静忽略。
   *
   * @param options.create 写入场景（storeBlob）传 true 自动创建中间目录；
   *                       读取/删除场景（getBlob / blobExists / deleteBlob）传 false，
   *                       目录不存在时返回 null 或抛错，避免意外重建空目录。
   */
  private async resolveDirectory(
    path: string,
    options: { create: boolean }
  ): Promise<{ dirHandle: FileSystemDirectoryHandle | null; fileName: string }> {
    const segments = path.split('/').filter(s => s.length > 0);
    if (segments.length < 2) {
      return { dirHandle: null, fileName: '' };
    }
    const fileName = segments.pop()!;
    let dir: FileSystemDirectoryHandle = this.rootDir!;
    for (const seg of segments) {
      // 写入路径允许创建中间目录；读取/删除路径在目录不存在时应抛错被上层 catch
      dir = await dir.getDirectoryHandle(seg, { create: options.create });
    }
    return { dirHandle: dir, fileName };
  }

  private dirToFileType(dirName: string): GeneratedFileType {
    switch (dirName) {
      case 'images': return 'image';
      case 'audio': return 'audio';
      case 'video': return 'video';
      default: return 'other';
    }
  }
}
