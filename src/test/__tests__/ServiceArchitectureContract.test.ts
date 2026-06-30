/**
 * ServiceArchitectureContract —— Phase 2 反转架构契约测试
 *
 * 目的：
 * - 防止 Phase 2 的"依赖注入反转"被未来代码改动回退
 * - 一旦 Service 直接 import 单例 ApiConfigStore / ConsoleLoggerAdapter，
 *   CI 立即失败 —— 强制开发者维持 Domain 层的纯净
 *
 * 验证项：
 * 1. 13 个核心 Service 文件不 import 单例 ApiConfigStore（仅可 import type）
 * 2. 13 个核心 Service 文件不 import 单例 defaultLogger（应使用注入的 ILoggerPort）
 * 3. 13 个核心 Service 都通过构造函数接受 IApiConfigStore（除少数纯函数式 Service）
 * 4. 构造函数签名中包含 ILoggerPort（除少数纯函数式 Service）
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Phase 2 反转过的 13 个核心 Service（按文件路径列出）
const SERVICE_FILES = [
  'ImageGenerationService.ts',
  'MusicService.ts',
  'VideoGenerationService.ts',
  'MusicLabService.ts',
  'VoiceService.ts',
  'PipelineService.ts',
  'VideoLabService.ts',
  'TextLabService.ts',
  'TextGenerationService.ts',
  'BGMRecommendationService.ts',
  'CinematographyService.ts',
  'AgentService.ts',
  'SubtitleService.ts',
] as const;

const SERVICES_DIR = join(__dirname, '..', '..', 'domain', 'services');

/** 读取 Service 源文件 */
function readServiceSource(filename: string): string {
  return readFileSync(join(SERVICES_DIR, filename), 'utf-8');
}

/** 检查 services 目录存在 */
function ensureServicesDirExists(): void {
  try {
    statSync(SERVICES_DIR);
  } catch {
    throw new Error(`Services 目录不存在: ${SERVICES_DIR}`);
  }
}

describe('Phase 2 反转架构契约（ServiceArchitectureContract）', () => {
  it('services 目录存在且包含目标 Service', () => {
    ensureServicesDirExists();
    const actual = readdirSync(SERVICES_DIR).filter(f => f.endsWith('.ts'));
    for (const f of SERVICE_FILES) {
      expect(actual).toContain(f);
    }
  });

  describe.each(SERVICE_FILES)('%s 反转契约', (serviceFile) => {
    it('不直接 import 单例 ApiConfigStore（仅可 import type）', () => {
      const src = readServiceSource(serviceFile);

      // 抽取所有 ApiConfigStore 的 import 行（排除注释行）
      const importLines = src
        .split('\n')
        .filter(l => /^\s*import\b/.test(l)) // 行首 import 语句
        .filter(l => /ApiConfigStore\b/.test(l));

      expect(importLines.length, `${serviceFile} 不应 import ApiConfigStore`)
        .toBeGreaterThan(0); // 至少要有 type 导入

      for (const line of importLines) {
        expect(
          line,
          `${serviceFile} 仅可 "import type { ... } from '...ApiConfigStore'"，禁止运行时 import: ${line.trim()}`
        ).toMatch(/^import\s+type\s+/);
      }
    });

    it('不直接 import 单例 defaultLogger / ConsoleLoggerAdapter', () => {
      // 移除所有注释行（包括 // 和 /* */ 行内注释），仅检查实际代码
      const codeOnly = readServiceSource(serviceFile)
        .split('\n')
        .filter(l => !/^\s*(\*|\/\/|\/\*)/.test(l)) // 排除纯注释行
        .map(l => l.replace(/\/\/.*$/, '')) // 移除行内 // 注释
        .join('\n');

      // 禁止直接 import 默认 Logger 单例
      expect(
        /from\s+['"][^'"]*ConsoleLoggerAdapter['"]/.test(codeOnly),
        `${serviceFile} 不应 import 单例 ConsoleLoggerAdapter，应通过 ILoggerPort 注入`
      ).toBe(false);

      // 禁止引用 defaultLogger 标识符（运行时）
      expect(
        /\bdefaultLogger\b/.test(codeOnly),
        `${serviceFile} 不应引用单例 defaultLogger，应通过 this.logger 使用注入的 ILoggerPort`
      ).toBe(false);
    });

    it('构造函数接受 IApiConfigStore（除 PipelineService 通过 deps 注入）', () => {
      const src = readServiceSource(serviceFile);

      if (serviceFile === 'PipelineService.ts') {
        // PipelineService 使用 deps 对象注入，验证接口契约
        expect(src).toMatch(/configStore:\s*IApiConfigStore/);
        return;
      }

      // 验证字段声明与赋值
      expect(
        /private\s+configStore:\s*IApiConfigStore\b|configStore:\s*IApiConfigStore\b/.test(src),
        `${serviceFile} 应声明 configStore 字段为 IApiConfigStore 类型`
      ).toBe(true);
      expect(
        /this\.configStore\s*=\s*configStore/.test(src),
        `${serviceFile} 应在构造函数中赋值 this.configStore`
      ).toBe(true);
    });

    it('构造函数接受 ILoggerPort（除 PipelineService 通过 deps 注入）', () => {
      const src = readServiceSource(serviceFile);

      if (serviceFile === 'PipelineService.ts') {
        expect(src).toMatch(/logger:\s*ILoggerPort/);
        return;
      }

      // 验证字段声明与赋值
      expect(
        /private\s+_?logger:\s*ILoggerPort\b|_?logger:\s*ILoggerPort\b/.test(src),
        `${serviceFile} 应声明 logger 字段为 ILoggerPort 类型`
      ).toBe(true);
      expect(
        /this\._?logger\s*=\s*logger/.test(src) || /this\._?logger\s*=\s*deps\.logger/.test(src),
        `${serviceFile} 应在构造函数中赋值 this.logger`
      ).toBe(true);
    });
  });
});