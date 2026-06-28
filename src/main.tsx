import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'
import { initializeFileStorage } from './dependencies'
import { registerServiceWorker } from './utils/offlineCache'

/**
 * 应用启动序列：
 * 1. 异步初始化文件存储（OPFS 优先，降级 IndexedDB）
 * 2. 注册 Service Worker（缓存跨域媒体 URL，避开 CORS）
 * 3. 渲染 React UI（不阻塞首屏）
 *
 * 初始化失败不会阻塞渲染，但会在用户首次使用依赖 fileStorage 的功能时报错。
 * 同时会把错误写入 logger，可在应用内日志面板（Ctrl+`）查看。
 */
initializeFileStorage().catch(err => {
  console.error('[FileStorage] initialization failed:', err)
})

// 注册 Service Worker：拦截跨域媒体 URL，存入 CacheStorage，
// 主线程读缓存时**0 网络请求**。SW 路径用 import.meta.env.BASE_URL
// 适配 Vite 的 base 配置（dev: '/', prod: '/ai-vido-web/'）。
// dev 与 prod 都启用 SW，方便开发期验证缓存效果。
const swPath = `${import.meta.env.BASE_URL}sw.js`.replace(/\/+/g, '/')
registerServiceWorker(swPath).then(reg => {
  if (reg) {
    console.info('[App] Service Worker registered:', swPath)
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)