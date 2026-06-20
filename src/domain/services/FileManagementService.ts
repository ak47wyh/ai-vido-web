import type { IFileManagementPort, FileListResult } from '../ports/OutboundPorts';

export class FileManagementService {
  private filePort: IFileManagementPort;

  constructor(filePort: IFileManagementPort) {
    this.filePort = filePort;
  }

  /**
   * List all uploaded files.
   */
  async listFiles(purpose?: string, limit?: number): Promise<FileListResult> {
    return this.filePort.listFiles(purpose, limit);
  }

  /**
   * Delete a file by ID.
   */
  async deleteFile(fileId: string): Promise<void> {
    return this.filePort.deleteFile(fileId);
  }
}
