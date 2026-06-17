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
 * 计算目录 checksum:递归收集所有文件相对路径+内容,排序后 sha256 聚合。
 * 不含 mtime(只算内容),保证跨机器/跨时间稳定。
 *
 * ⚠ 算法必须与 HelmFlow packages/helmcode-manager/src/version.ts 的 checksumDir
 *   逐字一致(BR-001),否则 pnpm helmcode:check drift 检测误报。
 *   三处聚合顺序一致:relPath + '\0' + content + '\0'。
 *
 * 目录不存在时返回空串 hash(与 HelmFlow 版本同行为,适配 preset 未装)。
 */
export function checksum(rootDir) {
  if (!existsSync(rootDir)) {
    return createHash('sha256').update('').digest('hex');
  }

  const entries = [];
  const walk = (dir) => {
    let list;
    try {
      list = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of list) {
      const full = join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(full);
      } else if (st.isFile()) {
        try {
          const content = readFileSync(full);
          entries.push({ relPath: relative(rootDir, full), content: content.toString('utf-8') });
        } catch {
          // 读失败的文件跳过(不污染 checksum)
        }
      }
    }
  };
  walk(rootDir);

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
