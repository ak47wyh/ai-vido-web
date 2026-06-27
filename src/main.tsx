import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'
import { initializeFileStorage } from './dependencies'

/**
 * 应用启动序列：
 * 1. 异步初始化文件存储（OPFS 优先，降级 IndexedDB）
 * 2. 渲染 React UI（不阻塞首屏）
 *
 * 初始化失败不会阻塞渲染，但会在用户首次使用依赖 fileStorage 的功能时报错。
 * 同时会把错误写入 logger，可在应用内日志面板（Ctrl+`）查看。
 */
initializeFileStorage().catch(err => {
  console.error('[FileStorage] initialization failed:', err)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)