import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/ai-vido-web/',
  plugins: [react()],
  server: {
    proxy: {
      // 代理 Anthropic 兼容端点，解决 CORS 问题
      // 浏览器请求 /anthropic/v1/messages → 代理到 https://api.minimaxi.com/anthropic/v1/messages
      '/anthropic': {
        target: 'https://api.minimaxi.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
