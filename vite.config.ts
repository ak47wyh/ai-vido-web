import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/ai-vido-web/',
  plugins: [react()],
  server: {
    proxy: {
      // 现有：代理 Anthropic 兼容端点，解决 CORS 问题
      '/anthropic': {
        target: 'https://api.minimaxi.com',
        changeOrigin: true,
        secure: true,
      },

      // 新增：火山方舟（Ark）代理，解决 CORS 问题
      '/volcengine-ark': {
        target: 'https://ark.cn-beijing.volces.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/volcengine-ark/, '/api/v3'),
        secure: true,
      },

      // 新增：Coze 代理，解决 CORS 问题
      '/coze': {
        target: 'https://api.coze.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/coze/, ''),
        secure: true,
      },
    },
  },
})