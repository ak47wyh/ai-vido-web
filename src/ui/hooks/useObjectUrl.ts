/**
 * useObjectUrl —— 自动管理 Blob → Object URL 生命周期的 React Hook
 *
 * 用法：
 * ```ts
 * const url = useObjectUrl(blob);
 * <img src={url ?? ''} />
 * ```
 *
 * 行为：
 * - 入参 blob 变化时自动 revoke 旧 URL 并创建新 URL
 * - 组件卸载时自动 revoke 当前 URL（避免泄漏）
 * - 入参 null 时返回 null（不创建 URL）
 *
 * 收益：
 * - 消除 MusicLab / VoiceLab / ExportCenter 等处手动管理 URL 的漏洞
 * - 长会话不再因 blob URL 累积导致内存膨胀
 *
 * 实现说明：
 * 使用 useMemo + useEffect cleanup 模式，避开 React 新版 ESLint 插件
 * 对"在 effect 中调用 setState"的级联渲染警告。
 */

import { useEffect, useMemo } from 'react';

export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return url;
}