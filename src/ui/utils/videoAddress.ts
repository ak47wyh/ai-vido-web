/**
 * 视频地址类型识别工具
 *
 * 三种地址类型：
 * - direct: 直链视频文件（如 https://example.com/video.mp4）
 * - share: 平台分享链接（如抖音/B站分享链接，需后端解析）
 * - local: 本地文件路径（如 D:/video.mp4，浏览器无法直接读取）
 */

import type { VideoAddressType } from '../../domain/ports/WatermarkRemovalPorts';

/** 直链视频文件扩展名 */
const DIRECT_VIDEO_EXTS = ['mp4', 'webm', 'mov', 'm4v', 'ogv'];

/** 直链 URL 正则 */
const DIRECT_URL_REGEX = new RegExp(
  '^https?://[^\\s]+\\.(?:' + DIRECT_VIDEO_EXTS.join('|') + ')(?:\\?.*)?$',
  'i',
);

/** URL 协议正则 */
const URL_PROTOCOL_REGEX = /^https?:\/\//i;

/** 本地路径正则（Windows 盘符 / Unix 路径 / file 协议） */
const LOCAL_PATH_REGEX = /^([a-zA-Z]:[\\/]|\/|file:\/\/)/;

/**
 * 识别视频地址类型
 * @param input 用户输入的地址
 * @returns 地址类型
 */
export function detectVideoAddressType(input: string): VideoAddressType {
  const trimmed = input.trim();
  if (!trimmed) return 'share';

  // 直链视频文件
  if (DIRECT_URL_REGEX.test(trimmed)) {
    return 'direct';
  }

  // 本地文件路径（Windows 盘符 / Unix 绝对路径 / file 协议）
  if (LOCAL_PATH_REGEX.test(trimmed) && !URL_PROTOCOL_REGEX.test(trimmed)) {
    return 'local';
  }
  if (trimmed.startsWith('file://')) {
    return 'local';
  }

  // 以 http(s):// 开头但非直链，视为平台分享链接
  if (URL_PROTOCOL_REGEX.test(trimmed)) {
    return 'share';
  }

  // 既非 URL 也非本地路径（如纯文件名），视为本地路径
  return 'local';
}

/**
 * 从 URL 中提取文件名
 */
export function extractFileNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname;
    const name = path.split('/').pop() || 'video';
    return decodeURIComponent(name);
  } catch {
    return 'video.mp4';
  }
}

/**
 * 通过 fetch 下载直链视频为 File 对象
 * @throws 当跨域或网络错误时抛出
 */
export async function fetchVideoAsFile(url: string): Promise<File> {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) {
    throw new Error('下载失败：HTTP ' + response.status);
  }
  const blob = await response.blob();
  const name = extractFileNameFromUrl(url);
  const mime = blob.type || 'video/mp4';
  return new File([blob], name, { type: mime });
}
