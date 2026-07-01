import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'
import { initializeFileStorage } from './dependencies'
import { ApiConfigStore } from './adapters/outbound/config/ApiConfigStore'

/**
 * 应用启动序列：
 * 1. 异步初始化 API 配置（解密 localStorage 密文到内存缓存）+ 文件存储（OPFS 优先，降级 IndexedDB）
 * 2. 渲染 React UI（不阻塞首屏）
 *
 * 初始化失败不会阻塞渲染，但会在用户首次使用依赖 fileStorage 的功能时报错。
 * 同时会把错误写入 logger，可在应用内日志面板（Ctrl+`）查看。
 *
 * 注意：本项目已按设计约束移除 Service Worker（不再注册、不再保留 sw.js）。
 * 老用户浏览器中残留的旧 SW 由 index.html 内联脚本一次性卸载清理。
 * 应用保持纯在线模式，所有资源走浏览器默认 HTTP 缓存。
 */
async function bootstrap(): Promise<void> {
  // 并行初始化：解密 API 配置 + 文件存储
  await Promise.all([
    ApiConfigStore.init(),
    initializeFileStorage(),
  ]).catch(err => {
    console.error('[Bootstrap] initialization failed:', err)
  })
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
