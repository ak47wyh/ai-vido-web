import type { IFileStoragePort, FileStorageStats } from '../../../domain/ports/FileStoragePorts';
import type { GeneratedFileType } from '../../../domain/entities/models';

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
    const fileHandle = await this.rootDir!.getFileHandle(path, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  }

  async getBlob(path: string): Promise<Blob | null> {
    this.ensureInitialized();
    try {
      const fileHandle = await this.rootDir!.getFileHandle(path);
      return await fileHandle.getFile();
    } catch {
      return null;
    }
  }

  async deleteBlob(path: string): Promise<void> {
    this.ensureInitialized();
    try {
      await this.rootDir!.removeEntry(path);
    } catch {
      // 文件不存在时忽略
    }
  }

  async blobExists(path: string): Promise<boolean> {
    this.ensureInitialized();
    try {
      await this.rootDir!.getFileHandle(path);
      return true;
    } catch {
      return false;
    }
  }

  async getObjectUrl(path: string): Promise<string> {
    const blob = await this.getBlob(path);
    if (!blob) throw new Error(`[OPFSFileStorage] File not found: ${path}`);
    const url = URL.createObjectURL(blob);
    this.activeObjectUrls.add(url);
    return url;
  }

  revokeObjectUrl(url: string): void {
    if (this.activeObjectUrls.has(url)) {
      URL.revokeObjectURL(url);
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
        for await (const entry of (dirHandle as any).values()) {
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
        for await (const entry of (dirHandle as any).values()) {
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

    // 释放所有活跃 Object URL
    for (const url of this.activeObjectUrls) {
      URL.revokeObjectURL(url);
    }
    this.activeObjectUrls.clear();

    // 删除所有子目录中的文件
    for (const dirName of OPFSFileStorageAdapter.DIRECTORIES) {
      try {
        const dirHandle = await this.rootDir!.getDirectoryHandle(dirName);
        const entriesToDelete: string[] = [];
        for await (const entry of (dirHandle as any).values()) {
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

  private dirToFileType(dirName: string): GeneratedFileType {
    switch (dirName) {
      case 'images': return 'image';
      case 'audio': return 'audio';
      case 'video': return 'video';
      default: return 'other';
    }
  }
}
