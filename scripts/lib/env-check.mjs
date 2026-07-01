#!/usr/bin/env node
/**
 * 环境检测模块 —— 跨平台共用
 *
 * 检测项：
 *   1. Node.js 版本
 *   2. npm 版本
 *   3. 项目结构完整性（package.json / package-lock.json / src/）
 *   4. node_modules 是否存在且与 package-lock 同步
 *   5. 端口 5173 是否空闲
 *   6. 磁盘剩余空间
 *   7. 网络连接（用于 npm install）
 *
 * 所有检测项的出入参都通过日志打印出来（遵循用户规则）
 */

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';

const NODE_MIN = '20.0.0';
const NPM_MIN = '9.0.0';
const DEV_PORT = 5173;

/**
 * 执行全部环境检测
 * @param {string} projectRoot 项目根目录绝对路径
 * @returns {Promise<object>} 检测报告
 */
export async function checkAll(projectRoot) {
  console.log('[env-check] 开始环境检测，projectRoot=' + projectRoot);
  const report = {
    node: await checkNode(),
    npm: await checkNpm(),
    project: await checkProjectStructure(projectRoot),
    deps: await checkDependencies(projectRoot),
    port: await checkPort(DEV_PORT),
    disk: checkDiskSpace(),
    network: await checkNetwork(),
  };
  report.ready = report.node.ok && report.npm.ok && report.project.ok;
  report.needInstall = !report.deps.ok;
  report.portConflict = !report.port.ok;
  console.log('[env-check] 检测完成，ready=' + report.ready + ' needInstall=' + report.needInstall);
  return report;
}

/** 检测 Node.js 版本 */
async function checkNode() {
  const current = process.versions.node;
  const ok = compareVersion(current, NODE_MIN) >= 0;
  const result = {
    ok,
    current,
    required: NODE_MIN,
    missing: false,
    message: ok
      ? `Node.js ${current} ✓`
      : `Node.js ${current} 过低，需要 >= ${NODE_MIN}`,
  };
  console.log('[env-check] node: ' + result.message);
  return result;
}

/** 检测 npm 版本 */
async function checkNpm() {
  let npmVer;
  try {
    npmVer = execSync('npm -v', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    const result = { ok: false, current: null, required: NPM_MIN, message: 'npm 未安装' };
    console.log('[env-check] npm: ' + result.message);
    return result;
  }
  const ok = compareVersion(npmVer, NPM_MIN) >= 0;
  const result = {
    ok,
    current: npmVer,
    required: NPM_MIN,
    message: ok ? `npm ${npmVer} ✓` : `npm ${npmVer} 过低，需要 >= ${NPM_MIN}`,
  };
  console.log('[env-check] npm: ' + result.message);
  return result;
}

/** 检测项目结构完整性 */
async function checkProjectStructure(root) {
  const required = ['package.json', 'package-lock.json', 'src', 'vite.config.ts'];
  const missing = required.filter(f => !existsSync(path.join(root, f)));
  const result = {
    ok: missing.length === 0,
    missing,
    message: missing.length === 0
      ? '项目结构完整 ✓'
      : `项目文件缺失：${missing.join(', ')}`,
  };
  console.log('[env-check] project: ' + result.message);
  return result;
}

/** 检测依赖安装状态 */
async function checkDependencies(root) {
  const nmPath = path.join(root, 'node_modules');
  if (!existsSync(nmPath)) {
    const result = { ok: false, reason: 'missing', message: 'node_modules 不存在' };
    console.log('[env-check] deps: ' + result.message);
    return result;
  }
  // 简易同步性检查：node_modules 下是否有 .package-lock.json
  const nmLockPath = path.join(nmPath, '.package-lock.json');
  if (!existsSync(nmLockPath)) {
    const result = { ok: false, reason: 'unsync', message: 'node_modules 与 package-lock 不同步' };
    console.log('[env-check] deps: ' + result.message);
    return result;
  }
  // 检查关键依赖是否存在（vite 必须存在）
  const vitePkg = path.join(nmPath, 'vite', 'package.json');
  if (!existsSync(vitePkg)) {
    const result = { ok: false, reason: 'incomplete', message: '关键依赖 vite 缺失' };
    console.log('[env-check] deps: ' + result.message);
    return result;
  }
  const result = { ok: true, reason: 'ok', message: '依赖已安装 ✓' };
  console.log('[env-check] deps: ' + result.message);
  return result;
}

/** 检测端口是否空闲 */
async function checkPort(port) {
  return new Promise(resolve => {
    const tester = net.createServer();
    tester.once('error', () => {
      const result = { ok: false, port, message: `端口 ${port} 被占用` };
      console.log('[env-check] port: ' + result.message);
      resolve(result);
    });
    tester.once('listening', () => {
      tester.once('close', () => {
        const result = { ok: true, port, message: `端口 ${port} 空闲 ✓` };
        console.log('[env-check] port: ' + result.message);
        resolve(result);
      });
      tester.close();
    });
    tester.listen(port);
  });
}

/** 检测磁盘剩余空间（跨平台） */
function checkDiskSpace() {
  const freeMB = getFreeDiskMB();
  const ok = freeMB === null || freeMB > 500;
  const result = {
    ok,
    freeMB,
    requiredMB: 500,
    message: freeMB === null
      ? '磁盘空间检测跳过（无法获取）'
      : ok
        ? `磁盘剩余 ${freeMB}MB ✓`
        : `磁盘空间不足，剩余 ${freeMB}MB（需 500MB+）`,
  };
  console.log('[env-check] disk: ' + result.message);
  return result;
}

/**
 * 获取当前分区剩余空间（MB）
 * @returns {number|null} 剩余 MB，无法获取时返回 null
 */
function getFreeDiskMB() {
  try {
    const platform = os.platform();
    if (platform === 'win32') {
      // Windows: 用 wmic 或 PowerShell 获取
      try {
        const output = execSync(
          'powershell -NoProfile -Command "(Get-PSDrive -Name C).Free / 1MB"',
          { encoding: 'utf-8', timeout: 5000 }
        ).trim();
        return Math.round(parseFloat(output));
      } catch {
        return null;
      }
    } else {
      // Linux/macOS: 用 df 获取当前目录所在分区
      try {
        const output = execSync('df -m .', { encoding: 'utf-8', timeout: 5000 });
        const lines = output.trim().split('\n');
        if (lines.length >= 2) {
          const parts = lines[1].split(/\s+/);
          // df -m 输出：Filesystem 1M-blocks Used Available Capacity Mounted-on
          const available = parseInt(parts[3], 10);
          if (!isNaN(available)) return available;
        }
      } catch {
        return null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** 检测网络连接（npm registry 可达性） */
async function checkNetwork() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    await fetch('https://registry.npmjs.org/', {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timer);
    const result = { ok: true, message: '网络连接正常 ✓' };
    console.log('[env-check] network: ' + result.message);
    return result;
  } catch {
    const result = {
      ok: false,
      message: '无法访问 npm registry（离线模式下仅可用已缓存依赖）',
    };
    console.log('[env-check] network: ' + result.message);
    return result;
  }
}

/**
 * 比较语义化版本号
 * @param {string} a 版本号，如 "20.14.1"
 * @param {string} b 版本号，如 "20.0.0"
 * @returns {number} 1=a>b, -1=a<b, 0=a=b
 */
function compareVersion(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

/** 检查指定端口是否空闲 */
export function isPortFree(port) {
  return new Promise(resolve => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => {
      tester.once('close', () => resolve(true));
      tester.close();
    });
    tester.listen(port);
  });
}

/**
 * 从指定端口开始查找下一个空闲端口
 * @param {number} start 起始端口
 * @param {number} maxAttempts 最大尝试次数
 * @returns {Promise<number>} 空闲端口号
 */
export async function findFreePort(start, maxAttempts = 100) {
  for (let p = start; p < start + maxAttempts; p++) {
    if (await isPortFree(p)) {
      console.log('[env-check] findFreePort: ' + p + ' 空闲');
      return p;
    }
  }
  console.warn('[env-check] findFreePort: 未找到空闲端口，返回 ' + (start + maxAttempts));
  return start + maxAttempts;
}
