import type { IFileManagementPort, FileListResult, FileItem } from '../../../domain/ports/OutboundPorts';
import { ApiConfigStore } from '../config/ApiConfigStore';
import { getMiniMaxErrorMessage } from './MiniMaxErrorUtils';
import axios from 'axios';

export class MiniMaxFileAdapter implements IFileManagementPort {

  /**
   * List Files — GET /v1/files/list
   */
  async listFiles(purpose?: string, limit?: number): Promise<FileListResult> {
    const config = ApiConfigStore.load();
    if (!config.minimaxApiKey) {
      throw new Error('API Key not configured — cannot list files');
    }

    const baseUrl = config.minimaxBaseUrl.replace(/\/+$/, '');

    const params: Record<string, unknown> = {};
    if (purpose) params.purpose = purpose;
    if (limit) params.limit = limit;

    const response = await axios.get(`${baseUrl}/files/list`, {
      params: {
        ...params,
        ...(config.minimaxGroupId ? { group_id: config.minimaxGroupId } : {}),
      },
      headers: {
        Authorization: `Bearer ${config.minimaxApiKey}`,
      },
    });

    const data = response.data;

    const statusCode = data?.base_resp?.status_code;
    const error = getMiniMaxErrorMessage(statusCode, data?.base_resp?.status_msg, 'MiniMax List Files error');
    if (error) throw new Error(error);

    const files: FileItem[] = (data?.data?.files || data?.files || []).map((f: Record<string, unknown>) => ({
      fileId: f.file_id as string,
      filename: (f.filename || f.file_name || '') as string,
      bytes: (f.bytes || 0) as number,
      purpose: (f.purpose || '') as string,
      createdAt: (f.created_at || 0) as number,
    }));

    return {
      files,
      hasMore: data?.data?.has_more || data?.has_more || false,
    };
  }

  /**
   * Delete File — POST /v1/files/delete
   */
  async deleteFile(fileId: string): Promise<void> {
    const config = ApiConfigStore.load();
    if (!config.minimaxApiKey) {
      throw new Error('API Key not configured — cannot delete file');
    }

    const baseUrl = config.minimaxBaseUrl.replace(/\/+$/, '');

    const payload = {
      file_id: fileId,
    };

    const response = await axios.post(`${baseUrl}/files/delete`, payload, {
      headers: {
        Authorization: `Bearer ${config.minimaxApiKey}`,
        'Content-Type': 'application/json',
      },
      params: config.minimaxGroupId ? { group_id: config.minimaxGroupId } : undefined,
    });

    const data = response.data;

    const statusCode = data?.base_resp?.status_code;
    const error = getMiniMaxErrorMessage(statusCode, data?.base_resp?.status_msg, 'MiniMax Delete File error');
    if (error) throw new Error(error);
  }
}
