#!/usr/bin/env node
/**
 * i18n 键完整性检查（V3 §4.4）
 *
 * 以 zh/translation.json 为基准，对比 en/ja 等语言的键集合，
 * 报告缺失键。CI 中可阻断构建（exit 1）。
 *
 * 用法：
 *   node scripts/i18n-check.mjs            # 报告但不阻断
 *   node scripts/i18n-check.mjs --strict   # 有缺失键时 exit 1
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '..', 'src', 'locales');
const BASELINE = 'zh';
const strict = process.argv.includes('--strict');

/** 递归收集对象的所有叶子键路径（dot-separated） */
function collectKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectKeys(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

function loadKeys(lang) {
  const raw = readFileSync(join(LOCALES_DIR, lang, 'translation.json'), 'utf-8');
  return new Set(collectKeys(JSON.parse(raw)));
}

const baselineKeys = loadKeys(BASELINE);
const langs = readdirSync(LOCALES_DIR).filter(d => d !== BASELINE);

let totalMissing = 0;
const report = {};

for (const lang of langs) {
  const langKeys = loadKeys(lang);
  const missing = [...baselineKeys].filter(k => !langKeys.has(k)).sort();
  report[lang] = missing;
  totalMissing += missing.length;
}

// 输出报告
console.log(`\n[i18n 完整性检查] 基准语言: ${BASELINE} (${baselineKeys.size} keys)\n`);
for (const [lang, missing] of Object.entries(report)) {
  if (missing.length === 0) {
    console.log(`  ✓ ${lang}: 完整`);
  } else {
    const pct = ((missing.length / baselineKeys.size) * 100).toFixed(1);
    console.log(`  ✗ ${lang}: 缺失 ${missing.length} keys (${pct}%)`);
    missing.slice(0, 20).forEach(k => console.log(`      - ${k}`));
    if (missing.length > 20) console.log(`      ... 还有 ${missing.length - 20} 个`);
  }
}
console.log(`\n合计缺失: ${totalMissing} keys\n`);

if (strict && totalMissing > 0) {
  console.error('✗ i18n 键不完整，请补全缺失翻译（--strict 模式）');
  process.exit(1);
}
process.exit(0);
