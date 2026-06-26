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

      // ===== 新增 5 个视频大模型平台代理 =====

      // 可灵 Kling（快手）
      '/kling': {
        target: 'https://api.klingai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/kling/, ''),
        secure: true,
      },

      // 通义万相 Wan（阿里 DashScope）
      '/wan': {
        target: 'https://dashscope.aliyuncs.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wan/, '/api/v1'),
        secure: true,
      },

      // 腾讯混元 Hunyuan
      '/hunyuan': {
        target: 'https://hunyuan.tencentcloudapi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hunyuan/, ''),
        secure: true,
      },

      // 智谱 Zhipu（bigmodel.cn）
      '/zhipu': {
        target: 'https://open.bigmodel.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/zhipu/, '/api/paas/v4'),
        secure: true,
      },

      // Vidu（生数科技）
      '/vidu': {
        target: 'https://api.vidu.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/vidu/, ''),
        secure: true,
      },
    },
  },
})