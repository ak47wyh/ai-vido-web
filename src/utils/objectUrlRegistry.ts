/**
 * ObjectUrlRegistry —— 统一追踪 Service / Adapter 层创建的 Object URL
 *
 * 背景：
 * 适配器层（如 MiniMaxVoiceAdapter / VolcengineVoiceAdapter）创建的 Object URL 会
 * 返回给上层调用方，调用方使用完毕后往往不会显式 revokeObjectURL，导致长会话下
 * Blob URL 持续累积、内存增长。
 *
 * 方案：
 * 所有 Service / Adapter 层创建的 Object URL 统一通过 createTrackedObjectUrl 注册，
 * 由本注册表持有引用。上层在不再需要某个 URL 时调用 revokeObjectUrl 释放；
 * 也可在批量任务结束或页面卸载时调用 revokeAll 一次性清理。
 *
 * 说明：
 * - 本注册表仅用于"跨层传递、生命周期难以确定释放时机"的 URL
 * - 短生命周期、局部使用的 URL 仍应直接用 try/finally + revokeObjectURL
 * - React 组件内的 URL 仍应优先使用 useObjectUrl hook（自动随组件卸载释放）
 */

const activeUrls = new Set<string>();

/**
 * 创建并注册一个 Object URL，返回 url 字符串。
 * 调用方在使用完毕后应调用 revokeObjectUrl(url) 释放。
 */
export function createTrackedObjectUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  activeUrls.add(url);
  return url;
}

/**
 * 释放指定 Object URL（若已被注册）。
 * 释放后从注册表移除，重复释放安全（幂等）。
 */
export function revokeObjectUrl(url: string): void {
  if (activeUrls.has(url)) {
    URL.revokeObjectURL(url);
    activeUrls.delete(url);
  } else {
    // 未注册的 URL 也尝试释放（幂等，revokeObjectURL 对未知 URL 不会报错）
    URL.revokeObjectURL(url);
  }
}

/**
 * 释放所有被追踪的 Object URL。
 * 适用于批量任务结束、页面卸载等场景。
 */
export function revokeAllTrackedObjectUrls(): void {
  for (const url of activeUrls) {
    URL.revokeObjectURL(url);
  }
  activeUrls.clear();
}

/**
 * 当前被追踪的 Object URL 数量（仅供诊断 / 日志面板使用）。
 */
export function getActiveObjectUrlCount(): number {
  return activeUrls.size;
}

// 页面卸载时兜底释放，防止 Blob URL 在整个会话期间泄漏
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    revokeAllTrackedObjectUrls();
  });
}
