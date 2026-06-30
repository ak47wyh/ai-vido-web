#!/usr/bin/env node
/**
 * 启动主流程 —— 跨平台共用
 *
 * 流程：
 *   1. 环境检测（env-check.mjs）
 *   2. 依赖安装（install-deps.mjs）
 *   3. 端口冲突处理（自动找空闲端口）
 *   4. 启动 Vite dev server
 *   5. 等待端口就绪
 *   6. 自动打开浏览器
 *
 * 失败时给出明确诊断信息，不静默退出。
 * 所有出入参都通过日志打印出来（遵循用户规则）
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkAll, findFreePort, isPortFree } from './env-check.mjs';
import { installIfNeeded } from './install-deps.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const DEFAULT_PORT = 5173;
const BASE_PATH = '/ai-vido-web/';
const PORT_WAIT_TIMEOUT_MS = 30000;

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  AI Video Studio — 一键启动');
  console.log('═══════════════════════════════════════════');
  console.log('  项目路径：' + projectRoot);
  console.log('');

  // 步骤 1：环境检测
  console.log('[1/4] 环境检测...');
  const report = await checkAll(projectRoot);
  printReport(report);

  if (!report.node.ok) {
    console.error('\n[FATAL] Node.js 不满足要求，请重新运行引导脚本安装 Node.js');
    process.exit(1);
  }
  if (!report.npm.ok) {
    console.error('\n[FATAL] npm 不满足要求，请重新运行引导脚本安装 Node.js');
    process.exit(1);
  }
  if (!report.project.ok) {
    console.error('\n[FATAL] 项目结构异常，缺失：' + report.project.missing.join(', '));
    process.exit(1);
  }

  // 步骤 2：依赖安装
  console.log('\n[2/4] 依赖安装...');
  const installed = await installIfNeeded(projectRoot, report);
  if (!installed) {
    console.error('\n[FATAL] 依赖安装失败，请手动执行 npm install 排查');
    process.exit(1);
  }

  // 步骤 3：端口冲突处理（仅作为首选端口提示，Vite 会自己处理实际冲突）
  console.log('\n[3/4] 端口检测...');
  const preferredPort = report.portConflict
    ? await findFreePort(DEFAULT_PORT + 1)
    : DEFAULT_PORT;
  if (report.portConflict) {
    console.log('[run-dev] 端口 ' + DEFAULT_PORT + ' 被占用，首选端口改用 ' + preferredPort);
  }

  // 步骤 4：启动 dev server
  // 注意：不传 --strictPort，让 Vite 在端口被占时自动找下一个可用端口。
  // 通过解析 Vite 输出获取实际监听端口，确保打开浏览器时用正确的 URL。
  console.log('\n[4/4] 启动开发服务器...');
  console.log('[run-dev] 执行命令: npx vite --port ' + preferredPort + ' --open=false');
  console.log('');

  const args = ['vite', '--port', String(preferredPort), '--open=false'];
  const proc = spawn('npx', args, {
    cwd: projectRoot,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  // 转发 stdout / stderr 到当前进程，同时解析实际端口
  let browserOpened = false;
  let stdoutBuf = '';
  const openBrowserOnce = (port) => {
    if (browserOpened) return;
    browserOpened = true;
    const url = 'http://localhost:' + port + BASE_PATH;
    console.log('\n[READY] 服务已就绪：' + url);
    openBrowser(url);
  };

  proc.stdout.on('data', chunk => {
    const text = chunk.toString();
    process.stdout.write(text);
    // 累积到缓冲区，处理分块到达 + ANSI 颜色码
    if (!browserOpened) {
      stdoutBuf += text;
      // 剥离所有 ANSI 转义码（颜色、光标移动、清屏等）
      const stripped = stdoutBuf.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '');
      // 宽松匹配：只要输出里出现 http(s)://host:port 就提取端口
      // 兼容 Vite 的 "  ➜  Local:   http://localhost:5173/..." 格式
      const m = stripped.match(/https?:\/\/[^:/]+:(\d+)/);
      if (m) {
        console.log('[run-dev] 解析到实际端口：' + m[1]);
        openBrowserOnce(parseInt(m[1], 10));
      }
      // 防止缓冲区无限增长
      if (stdoutBuf.length > 8192) stdoutBuf = stdoutBuf.slice(-4096);
    }
  });

  proc.stderr.on('data', chunk => {
    process.stderr.write(chunk);
  });

  // 兜底：如果 15 秒内未从输出解析到端口，用 waitForPortBusy 探测首选端口
  setTimeout(() => {
    if (!browserOpened) {
      console.warn('[WARN] 未从 Vite 输出解析到端口，尝试探测首选端口 ' + preferredPort);
      waitForPortBusy(preferredPort, PORT_WAIT_TIMEOUT_MS).then(() => {
        openBrowserOnce(preferredPort);
      }).catch(() => {
        console.warn('[WARN] 等待端口超时，请手动查看上方控制台输出获取实际 URL');
      });
    }
  }, 15000);

  proc.on('close', code => {
    console.log('\n[EXIT] 开发服务器退出，code=' + code);
    process.exit(code ?? 0);
  });

  proc.on('error', err => {
    console.error('[FATAL] 启动失败：' + err.message);
    process.exit(1);
  });
}

/** 打印环境检测报告 */
function printReport(r) {
  console.log('  - ' + r.node.message);
  console.log('  - ' + r.npm.message);
  console.log('  - ' + r.project.message);
  console.log('  - ' + r.deps.message);
  console.log('  - ' + r.port.message);
  console.log('  - ' + r.disk.message);
  console.log('  - ' + r.network.message);
}

/**
 * 等待指定端口被占用（即服务已启动并监听）
 * @param {number} port 端口号
 * @param {number} timeoutMs 超时毫秒
 * @returns {Promise<void>}
 */
function waitForPortBusy(port, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error('timeout'));
      }
      isPortFree(port).then(free => {
        // 端口被占用 = 服务已启动
        if (!free) {
          console.log('[run-dev] 端口 ' + port + ' 已就绪');
          return resolve();
        }
        setTimeout(tick, 500);
      });
    };
    tick();
  });
}

/**
 * 跨平台打开浏览器
 * @param {string} url 要打开的 URL
 */
function openBrowser(url) {
  let cmd;
  let args;
  switch (process.platform) {
    case 'darwin':
      cmd = 'open';
      args = [url];
      break;
    case 'win32':
      cmd = 'cmd';
      args = ['/c', 'start', '', url];
      break;
    default:
      // Linux 及其他类 Unix
      cmd = 'xdg-open';
      args = [url];
      break;
  }
  console.log('[run-dev] 打开浏览器：' + cmd + ' ' + args.join(' ') + ' -> ' + url);
  try {
    const child = spawn(cmd, args, {
      detached: true,
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
    child.on('error', () => {
      console.warn('[WARN] 无法自动打开浏览器，请手动访问：' + url);
    });
    child.unref();
  } catch {
    console.warn('[WARN] 无法自动打开浏览器，请手动访问：' + url);
  }
}

main().catch(err => {
  console.error('[FATAL] ' + (err.stack || err.message || err));
  process.exit(1);
});
