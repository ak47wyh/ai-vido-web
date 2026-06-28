import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { filesStoragePlugin } from './vite/filesStoragePlugin'

/**
 * OSS 代理插件 —— 解决海螺/MiniMax 等厂商 OSS 签名 URL 的 CORS + 502 问题
 * 前端通过 /__oss-proxy?url=<encoded> 请求，Node 端无 CORS 限制地下载并透传
 * 内置重试机制（最多 3 次），应对 OSS 瞬时 502 故障
 *
 * 采用全局中间件 + next 模式（与 filesStoragePlugin 一致），确保路由匹配可靠
 */
function ossProxyPlugin(): Plugin {
  const MAX_RETRIES = 3;
  const PROXY_PATH = '/__oss-proxy';

  async function fetchWithRetry(target: string, retries: number): Promise<Response> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const resp = await fetch(target, {
          signal: AbortSignal.timeout(15000),
        });
        if ([502, 503, 504].includes(resp.status) && attempt < retries) {
          console.warn(`[oss-proxy] OSS ${resp.status}, retry ${attempt + 1}/${retries}: ${target.substring(0, 80)}...`);
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        return resp;
      } catch (e) {
        lastError = e as Error;
        if (attempt < retries) {
          console.warn(`[oss-proxy] Fetch error, retry ${attempt + 1}/${retries}: ${(e as Error).message}`);
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
      }
    }
    throw lastError ?? new Error('fetch failed');
  }

  return {
    name: 'oss-proxy',
    configureServer(server) {
      // 全局中间件，内部做路径匹配，不匹配时 next() 放行
      server.middlewares.use(async (req, res, next) => {
        try {
          // 解析完整 URL（含 query string）
          const fullUrl = req.url || '';
          if (!fullUrl.startsWith(PROXY_PATH)) {
            return next();
          }
          const parsed = new URL(fullUrl, 'http://localhost');
          const target = parsed.searchParams.get('url');
          if (!target) {
            res.statusCode = 400;
            res.end('Missing url param');
            return;
          }
          const resp = await fetchWithRetry(target, MAX_RETRIES);
          if (!resp.ok) {
            res.statusCode = resp.status;
            res.end(`OSS responded ${resp.status}`);
            return;
          }
          const buf = Buffer.from(await resp.arrayBuffer());
          res.setHeader('Content-Type', resp.headers.get('content-type') || 'image/jpeg');
          res.setHeader('Cache-Control', 'no-store');
          res.end(buf);
        } catch (e) {
          res.statusCode = 502;
          res.end(`OSS proxy error: ${(e as Error).message}`);
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: '/ai-vido-web/',
  plugins: [
    react(),
    // 本地文件存储插件 —— 为前端提供 POST /__files/upload 等路由，
    // 让图片/视频/音频 Blob 可以直接落到磁盘，无需 fetch 外部 URL
    filesStoragePlugin(),
    ossProxyPlugin(),
  ],
  server: {
    hmr: {
      // base 为 /ai-vido-web/ 时，HMR WebSocket 需显式指定路径，
      // 否则客户端连 /ai-vido-web/ 而服务端监听 /，导致连接失败
      path: '/ai-vido-web/',
    },
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
  build: {
    // Phase 3 性能优化 —— 手动 vendor 拆分，避免单 chunk 过大阻塞首屏
    // 拆分原则：
    //  - react / react-dom 单独 chunk，所有页面共用
    //  - 大型重量级库（dexie、ffmpeg、lucide-react、react-i18next、react-router-dom）独立
    //  - 业务代码保留在动态 import 的 page chunks 内（App.tsx 已用 lazy() 拆分）
    rollupOptions: {
      output: {
        manualChunks(id: string): string | undefined {
          // vendor-react
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')) {
            return 'vendor-react';
          }
          // vendor-router
          if (id.includes('node_modules/react-router/') || id.includes('node_modules/react-router-dom/') ||
              id.includes('node_modules/@remix-run/router')) {
            return 'vendor-router';
          }
          // vendor-i18n
          if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) {
            return 'vendor-i18n';
          }
          // vendor-icons
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          // vendor-db
          if (id.includes('node_modules/dexie') || id.includes('node_modules/dexie-react-hooks')) {
            return 'vendor-db';
          }
          // vendor-http
          if (id.includes('node_modules/axios')) {
            return 'vendor-http';
          }
          // vendor-ffmpeg —— 仅 @ffmpeg/util 静态引用会出现在这里
          // @ffmpeg/ffmpeg 已改为动态 import（首次 load() 时按需加载），
          // Rollup 会自动为它生成独立 chunk 并优先于 manualChunks 命中，
          // 因此此规则只匹配 util，不影响 @ffmpeg/ffmpeg 的按需加载语义
          if (id.includes('node_modules/@ffmpeg/util')) {
            return 'vendor-ffmpeg';
          }
          return undefined;
        },
      },
      // 提升单个 chunk 体积告警阈值，避免误报（FFmpeg + lucide 等大库合并后超 500KB 是预期行为）
      onwarn(warning, defaultHandler) {
        if (warning.code === 'CHUNK_SIZE_WARNING') return;
        defaultHandler(warning);
      },
    },
    // 单 chunk 体积目标：1MB（FFmpeg wasm 占空间但属于一次性加载）
    chunkSizeWarningLimit: 1024,
  },
})