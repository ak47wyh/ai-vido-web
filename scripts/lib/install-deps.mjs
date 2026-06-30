#!/usr/bin/env node
/**
 * 依赖安装模块 —— 跨平台共用
 *
 * 策略：
 *   1. node_modules 不存在 → npm ci（干净安装）
 *   2. node_modules 与 lock 不同步 / 关键依赖缺失 → npm ci
 *   3. 都正常 → 跳过
 *   4. npm ci 失败 → 降级 npm install
 *
 * 所有出入参都通过日志打印出来（遵循用户规则）
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * 根据检测报告决定是否安装依赖
 * @param {string} projectRoot 项目根目录
 * @param {object} report env-check 返回的检测报告
 * @returns {Promise<boolean>} 是否安装成功
 */
export async function installIfNeeded(projectRoot, report) {
  console.log('[install-deps] 入参: projectRoot=' + projectRoot + ' needInstall=' + report.needInstall);

  if (!report.needInstall) {
    console.log('[install-deps] 依赖已安装，跳过');
    return true;
  }

  console.log('[install-deps] 开始安装依赖...');
  console.log('[install-deps] 原因：' + report.deps.message);

  const hasLockFile = existsSync(path.join(projectRoot, 'package-lock.json'));
  // reason 为 'unsync' 或 'incomplete' 时强制用 ci 重装
  const useCi = hasLockFile;

  const args = useCi ? ['ci'] : ['install'];
  console.log('[install-deps] 执行命令: npm ' + args.join(' '));

  try {
    await runNpm(args, projectRoot);
    console.log('[install-deps] 依赖安装完成 ✓');
    return true;
  } catch (e) {
    console.error('[install-deps] npm ' + args.join(' ') + ' 失败：' + e.message);
    if (useCi) {
      console.log('[install-deps] 降级为 npm install 重试...');
      console.log('[install-deps] 执行命令: npm install');
      try {
        await runNpm(['install'], projectRoot);
        console.log('[install-deps] 依赖安装完成（npm install）✓');
        return true;
      } catch (e2) {
        console.error('[install-deps] npm install 也失败：' + e2.message);
        return false;
      }
    }
    return false;
  }
}

/**
 * 运行 npm 命令
 * @param {string[]} args npm 参数
 * @param {string} cwd 工作目录
 * @returns {Promise<void>}
 */
function runNpm(args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn('npm', args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    proc.on('close', code => {
      console.log('[install-deps] npm ' + args.join(' ') + ' 退出码=' + code);
      if (code === 0) resolve();
      else reject(new Error('npm 退出码 ' + code));
    });
    proc.on('error', err => {
      console.error('[install-deps] spawn error: ' + err.message);
      reject(err);
    });
  });
}
