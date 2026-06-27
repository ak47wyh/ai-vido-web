/**
 * 单元测试全局 setup
 *
 * 关键作用：
 * 1. 注入 fake-indexeddb，让 IndexedDB 在 Node 环境中可用
 * 2. 模拟 window/localStorage（在 jsdom 中默认存在，但需要 polyfill fetch）
 */

import 'fake-indexeddb/auto';

// 全局 fetch stub（防止依赖真实 HTTP）
if (!globalThis.fetch) {
  globalThis.fetch = async () => {
    throw new Error('fetch is not stubbed in tests; use vi.fn() to mock');
  };
}