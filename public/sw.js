// Service Worker — 自毁版本
//
// 历史背景：
//   之前版本实装了激进的 cache-first + 跨域媒体拦截策略，
//   导致图片/音频/视频预览全部异常（详见设计方案）。
//   方案 A 决定完全移除 SW，回到 26 号无 SW 的稳定基线。
//
// 本文件职责（一次性清理）：
//   1. 安装时立即 skipWaiting，尽快接管
//   2. 激活时清空所有历史缓存桶（STATIC_CACHE_NAME / MEDIA_CACHE_NAME 等）
//   3. 通过 clients.claim() 接管所有页面
//   4. 主动 unregister 自身，让浏览器彻底不再有 SW
//   5. 通知所有客户端刷新页面，加载无 SW 状态
//
// 部署后老用户刷新一次即可完成清理；之后浏览器不再有 SW。

self.addEventListener('install', (event) => {
  // 立即跳过等待，尽快激活
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 1. 清空所有历史缓存桶（兼容历史版本号）
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));

    // 2. 接管所有未受控页面
    await self.clients.claim();

    // 3. 主动注销自身，让浏览器彻底不再注册 SW
    const registrations = await self.registration.unregister();
    console.log('[SW] Self unregistered:', registrations);

    // 4. 通知所有客户端刷新页面，加载无 SW 状态
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => {
      client.postMessage({ type: 'SW_SELF_DESTROYED' });
    });
  })());
});

// 不监听 fetch —— 让所有请求走浏览器默认行为
// （包括跨域媒体，由 <img>/<audio>/<video> 原生渲染）

// 主线程消息接口：兼容历史消息类型，统一回复已销毁
self.addEventListener('message', (event) => {
  const source = event.source;
  if (source && source.postMessage) {
    source.postMessage({ type: 'SW_DESTROYED' });
  }
});
