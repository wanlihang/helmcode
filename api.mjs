#!/usr/bin/env node

/**
 * HelmCode programmatic API — 给 HelmFlow 等消费方 import 的库入口。
 *
 * 补齐 docs(HelmFlow)/architecture/helmcode-management-goals.md §6 第 1 条承诺:
 *   - query/checksum 程序化查询
 *   - 6 scanner + generateProjectConventions 重导出(替代消费方手动复制)
 *
 * 与 CLI 入口 install.mjs 的关系:install.mjs 仍是 `helmcode` CLI 主入口;
 * 本文件是 `import` 入口(package.json exports["."] → api.mjs)。
 * HelmFlow `@helmflow/helmcode-manager` 可经此正式 API 消费 HelmCode,
 * 不再被迫直读文件系统。
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRESETS } from './install.mjs';

const DEFAULT_HOME = fileURLToPath(new URL('.', import.meta.url));

/**
 * 聚合 entries[{relPath,content}] → sha256 hex(按 relPath 排序,逐条 relPath + '\0' + content + '\0')。
 *
 * ⚠ 算法必须与 HelmFlow packages/helmcode-manager/src/version.ts 的聚合逐字一致(BR-001),
 *   否则 pnpm helmcode:check drift 检测误报。checksum 与 contentChecksum 共用此函数。
 */
function hashEntries(entries) {
  entries.sort((a, b) => (a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0));
  const hash = createHash('sha256');
  for (const e of entries) {
    hash.update(e.relPath);
    hash.update('\0');
    hash.update(e.content);
    hash.update('\0');
  }
  return hash.digest('hex');
}

/**
 * 递归收集 dir 下所有文件为 entries[{relPath,content}],relPath 相对 base。
 * excludeSet 命中任一目录/文件名段则跳过(defense-in-depth:contentChecksum 算"源"时排除非发布内容)。
 * 读失败的文件跳过(不污染 checksum)。不含 mtime(只算内容),保证跨机器/跨时间稳定。
 */
function collectEntries(dir, base, entries, excludeSet) {
  let list;
  try {
    list = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of list) {
    if (excludeSet && excludeSet.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      collectEntries(full, base, entries, excludeSet);
    } else if (st.isFile()) {
      try {
        entries.push({ relPath: relative(base, full), content: readFileSync(full).toString('utf-8') });
      } catch {
        // 读失败的文件跳过(不污染 checksum)
      }
    }
  }
}

/**
 * 计算目录 checksum:递归收集所有文件相对路径+内容,排序后 sha256 聚合。
 * 目录不存在时返回空串 hash(与 HelmFlow 版本同行为,适配 preset 未装)。
 * 覆盖范围 = rootDir 下全部文件(不排除);算 standards/{preset} 子集用本函数。
 */
export function checksum(rootDir) {
  if (!existsSync(rootDir)) {
    return createHash('sha256').update('').digest('hex');
  }
  const entries = [];
  collectEntries(rootDir, rootDir, entries, null);
  return hashEntries(entries);
}

// 发布内容排除集(非 package.json files 范围 / 本地态):contentChecksum 算"源 helmcode"时用,
// 保证源侧(含 .git/test/.claude 等)算出的 == 副本侧(HelmFlow sync 时已过滤这些)。
const CONTENT_EXCLUDE = new Set([
  '.git', '.claude', '.idea', 'node_modules', 'test', 'examples',
  '.test-output', '.DS_Store',
]);

/**
 * 计算 HelmCode 发布内容的 checksum(全量,覆盖 core/standards/scripts/commands/... )。
 * 按 package.json files 字段选择源子集(目录 walk + 单文件读),排除非发布内容,
 * 复用 hashEntries 聚合算法(与 checksum 同源)。
 *
 * 与 checksum(算指定子目录,如 standards/{preset})的区别:contentChecksum 覆盖整个发布面,
 * 用于 HelmFlow「全变更 drift 感知」——改 core skill / install.mjs / scripts 等
 * 任何 files 内文件都触发 drift(旧 standardsChecksum 只覆盖 standards 子集,漏检 core 等)。
 *
 * HelmFlow 三处(sync 写副本元数据 / helmcode:check 算源 / version.ts 运行时算副本)
 * 都动态 import 本函数,维护「checksum 单一事实源 = helmcode api.mjs」契约。
 *
 * @param {string} helmcodeHome HelmCode 仓库/副本根
 * @returns {string} 64 位 hex;home 不存在或 package.json 无 files → 空串 hash
 */
export function contentChecksum(helmcodeHome) {
  if (!existsSync(helmcodeHome)) {
    return createHash('sha256').update('').digest('hex');
  }
  let files = [];
  try {
    const pkg = JSON.parse(readFileSync(join(helmcodeHome, 'package.json'), 'utf-8'));
    if (Array.isArray(pkg.files)) files = pkg.files;
  } catch {
    // package.json 缺失/解析失败 → files 空聚合
  }
  const entries = [];
  for (const entry of files) {
    const full = join(helmcodeHome, entry);
    if (!existsSync(full)) continue;
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      collectEntries(full, helmcodeHome, entries, CONTENT_EXCLUDE);
    } else if (st.isFile()) {
      if (CONTENT_EXCLUDE.has(entry)) continue;
      try {
        entries.push({ relPath: entry, content: readFileSync(full).toString('utf-8') });
      } catch {
        // 读失败跳过
      }
    }
  }
  return hashEntries(entries);
}

/** 递归列 dir 下所有文件相对路径(按相对路径排序)。 */
function listFiles(dir, base = dir) {
  const out = [];
  const walk = (d) => {
    let list;
    try {
      list = readdirSync(d);
    } catch {
      return;
    }
    for (const name of list) {
      const full = join(d, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(full);
      else if (st.isFile()) out.push(relative(base, full));
    }
  };
  walk(dir);
  out.sort();
  return out;
}

/**
 * 枚举 HelmCode 的 PRESETS 资源:各 preset 的 standards 文件清单 + checksum。
 *
 * @param {object} [opts]
 * @param {string} [opts.helmcodeHome] HelmCode 源根目录;不传回落到本包目录(BR-003)。
 * @returns {{ presets: Array<{ name: string, files: string[], checksum: string|null }> }}
 */
export function query({ helmcodeHome } = {}) {
  const home = helmcodeHome || DEFAULT_HOME;
  return {
    presets: Object.keys(PRESETS).map((name) => {
      const cfg = PRESETS[name];
      const standardsDir = cfg.standardsDir ? join(home, 'standards', cfg.standardsDir) : null;
      const files = standardsDir && existsSync(standardsDir) ? listFiles(standardsDir) : [];
      return { name, files, checksum: standardsDir ? checksum(standardsDir) : null };
    }),
  };
}

// 6 scanner + generateProjectConventions 重导出(替代消费方手动复制)。
// 实现仍在 install.mjs(单一事实源),本入口仅暴露。
export {
  scanDOAnnotations,
  scanExceptionPattern,
  scanFacadePattern,
  scanMapStruct,
  scanPersistence,
  scanIntegrationPattern,
  generateProjectConventions,
} from './install.mjs';
