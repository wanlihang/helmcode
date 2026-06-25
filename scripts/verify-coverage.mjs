#!/usr/bin/env node
/**
 * HelmCode JaCoCo 覆盖率核验（verify §6，F004）。
 *
 * 解析 jacoco.csv 算行/分支覆盖率，对比 test-standards §1 阈值（行≥80% 分支≥70%）。
 * emit SIG-COVERAGE / SIG-COVERAGE-FAIL。无 report 时跳过（不阻塞）。
 *
 * 用法:
 *   node verify-coverage.mjs --project /path/to/project     # 扫所有 target/site/jacoco/jacoco.csv（多模块聚合）
 *   node verify-coverage.mjs --csv /path/to/jacoco.csv      # 单个 csv
 *
 * export parseCsv/evaluate/formatSignal 供 test/coverage.test.mjs 自测。
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// test-standards §1 总体阈值
export const THRESHOLDS = { line: 0.80, branch: 0.70 };

function zero() {
  return { lineMissed: 0, lineCov: 0, branchMissed: 0, branchCov: 0 };
}

function num(s) {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** 解析单个 jacoco.csv 文本 → 累计 line/branch missed/covered。 */
export function parseCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;
  const header = lines[0].split(',');
  const idx = (n) => header.indexOf(n);
  const lm = idx('LINE_MISSED');
  const lc = idx('LINE_COVERED');
  const bm = idx('BRANCH_MISSED');
  const bc = idx('BRANCH_COVERED');
  if (lm < 0 || lc < 0 || bm < 0 || bc < 0) return null; // 列不存在
  const acc = zero();
  const last = Math.max(lm, lc, bm, bc);
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    if (c.length <= last) continue;
    acc.lineMissed += num(c[lm]);
    acc.lineCov += num(c[lc]);
    acc.branchMissed += num(c[bm]);
    acc.branchCov += num(c[bc]);
  }
  return acc;
}

export function mergeStats(a, b) {
  return {
    lineMissed: a.lineMissed + b.lineMissed,
    lineCov: a.lineCov + b.lineCov,
    branchMissed: a.branchMissed + b.branchMissed,
    branchCov: a.branchCov + b.branchCov,
  };
}

/** 算覆盖率 + 判定是否达标。 */
export function evaluate(stats) {
  const lineTotal = stats.lineMissed + stats.lineCov;
  const branchTotal = stats.branchMissed + stats.branchCov;
  const linePct = lineTotal === 0 ? 1 : stats.lineCov / lineTotal;
  const branchPct = branchTotal === 0 ? 1 : stats.branchCov / branchTotal;
  const pass = linePct >= THRESHOLDS.line && branchPct >= THRESHOLDS.branch;
  return { linePct: Math.round(linePct * 100), branchPct: Math.round(branchPct * 100), pass };
}

/** 生成 SIG-COVERAGE / SIG-COVERAGE-FAIL 信号串（措辞见 signal-glossary.md）。 */
export function formatSignal(ev) {
  return ev.pass
    ? `✅ 覆盖率：行 ${ev.linePct}% / 分支 ${ev.branchPct}% 达标`
    : `❌ 覆盖率：行 ${ev.linePct}% / 分支 ${ev.branchPct}% 未达阈值（行≥80% 分支≥70%）`;
}

/** 递归找项目所有 target/site/jacoco/jacoco.csv（多模块）。 */
export function findJacocoCsvs(rootDir) {
  const out = [];
  if (!existsSync(rootDir)) return out;
  const walk = (dir, depth) => {
    if (depth > 8) return;
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const n of entries) {
      if (n === 'node_modules' || n === '.git' || n === 'src' || n === '.idea') continue;
      const full = join(dir, n);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (n === 'jacoco' && existsSync(join(full, 'jacoco.csv'))) {
          out.push(join(full, 'jacoco.csv'));
        } else {
          walk(full, depth + 1);
        }
      }
    }
  };
  walk(rootDir, 0);
  return out;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project') opts.project = resolve(args[++i]);
    else if (args[i] === '--csv') opts.csv = resolve(args[++i]);
  }
  return opts;
}

function main() {
  const opts = parseArgs();
  const csvs = opts.csv ? [opts.csv] : opts.project ? findJacocoCsvs(opts.project) : [];
  if (csvs.length === 0) {
    console.log('ℹ️ 覆盖率：未找到 jacoco.csv（无 JaCoCo report 或未跑 mvn verify），SIG-COVERAGE 跳过');
    return;
  }
  let stats = zero();
  for (const f of csvs) {
    const s = parseCsv(readFileSync(f, 'utf-8'));
    if (!s) {
      console.error(`⚠️ ${f} 格式异常（缺 LINE/BRANCH 列），跳过`);
      continue;
    }
    stats = mergeStats(stats, s);
  }
  const ev = evaluate(stats);
  console.log(formatSignal(ev));
  if (!ev.pass) process.exitCode = 1;
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === resolve(join(import.meta.dirname, 'verify-coverage.mjs'));
if (invokedDirectly) main();
