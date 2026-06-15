#!/usr/bin/env node

/**
 * HelmCode goal 条件编译器（确定性，非 LLM）
 *
 * 读行为契约的验收条件（AC），按客观闸门定档（simple/standard/complex），
 * 从 signal-glossary 取信号串，确定性生成 /goal 文本。
 *
 * 取代旧的「LLM 按 goal-condition-builder.md 推导 goal」——
 * 推导本身是 LLM 判断，非确定、不可复现（治 D3）。
 * 本脚本是确定性函数：同 contract 输入 → 同 goal 输出。
 *
 * 用法:
 *   node scripts/compile-goal.mjs --contract .claude/contracts/F001-xxx.md
 *   node scripts/compile-goal.mjs --contract <path> --print   # 只打印不解释
 *
 * AC 格式（由 contract-template 约束）:
 *   - [ ] AC-001: {desc} — 验证方式: 测试 — 优先级: P0
 *
 * 信号串与 signal-glossary.md / verify-glossary.mjs 必须三者一致。
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── 信号常量（与 core/dev-flow/references/signal-glossary.md 唯一事实源一致）──
// 改这里必须同步改 glossary 与 verify-glossary.mjs。
const SIGNALS = {
  COMPILE: 'BUILD SUCCESS',
  TEST: 'Tests run: {N} (N ≥ 1), Failures: 0',
  ACCOV: 'AC-coverage 全部 1:1 映射',
  FIELDSYNC: '字段同步：全部通过',
  ARCH: '架构合规：全部通过',
};

const VERIFY_METHODS = new Set(['编译', '测试', '脚本', '命令']);
const PRIORITIES = new Set(['P0', 'P1']);

// ── 参数解析 ─────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { contract: null, print: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--contract') opts.contract = resolve(args[++i]);
    else if (args[i] === '--print') opts.print = true;
    else if (args[i] === '--help' || args[i] === '-h') opts.help = true;
  }
  return opts;
}

// ── 解析行为契约 ─────────────────────────────────────────

function parseContract(filePath) {
  const content = readFileSync(filePath, 'utf-8');

  const featureMatch = content.match(/Feature:\s*(F\d+-[\w-]+)/);
  const featureId = featureMatch ? featureMatch[1] : null;

  const domainMatch = content.match(/涉及领域:\s*(.+)/);
  const domains = domainMatch
    ? domainMatch[1].split(/[,，]/).map((d) => d.trim()).filter(Boolean)
    : [];

  // 提取 AC 列表
  // 格式: - [ ] AC-001: {desc} — 验证方式: 测试 — 优先级: P0
  const acs = [];
  const acRegex =
    /-\s*\[[ xX]\]\s*(AC-\d+):\s*(.+?)\s*—\s*验证方式:\s*(\S+)\s*(?:—\s*优先级:\s*(P[01]))?/g;
  let m;
  while ((m = acRegex.exec(content)) !== null) {
    acs.push({
      id: m[1],
      desc: m[2].trim(),
      method: m[3].trim(),
      priority: m[4] ? m[4].trim() : 'P0', // 缺省 P0（兼容旧契约）
    });
  }

  return { featureId, domains, acs, content };
}

// ── 校验契约结构（机器可解析的前提）─────────────────────

function validate({ featureId, acs }) {
  const errors = [];

  if (!featureId) {
    errors.push('无法解析 Feature ID（期望 "Feature: F{NNN}-{name}"）');
  }

  if (acs.length === 0) {
    errors.push('未解析到任何 AC（期望格式：AC-001: {desc} — 验证方式: 测试 — 优先级: P0）');
  }

  for (const ac of acs) {
    if (!VERIFY_METHODS.has(ac.method)) {
      errors.push(
        `${ac.id}: 验证方式 "${ac.method}" 不在枚举 {编译,测试,脚本,命令} 内——compile-goal 无法分类`,
      );
    }
    if (!PRIORITIES.has(ac.priority)) {
      errors.push(`${ac.id}: 优先级 "${ac.priority}" 不在 {P0,P1} 内`);
    }
  }

  return errors;
}

// ── 客观定档（替代 LLM 的简单/标准/复杂感觉判断）─────────
//
// 闸门（确定性）：
//   · 含「命令」类 AC，或含「脚本」类 AC        → complex
//   · 否则「测试」类 AC > 3                     → standard
//   · 否则                                       → simple
//
function decideTier(acs) {
  const byMethod = (m) => acs.filter((a) => a.method === m);
  if (byMethod('命令').length > 0 || byMethod('脚本').length > 0) return 'complex';
  if (byMethod('测试').length > 3) return 'standard';
  return 'simple';
}

// ── goal 文本生成 ────────────────────────────────────────

const DOMAIN_TEST_HINT = (domains) =>
  domains.length ? `覆盖 ${domains.join('/')} 相关测试` : '覆盖相关 domain 测试';

function buildGoal({ featureId, domains, acs, tier }) {
  const coreIds = acs.filter((a) => a.priority === 'P0').map((a) => a.id);
  const minorIds = acs.filter((a) => a.priority === 'P1').map((a) => a.id);
  const coreRange = coreIds.length ? `${coreIds[0]}~${coreIds[coreIds.length - 1]}` : '无';

  const lines = [];
  lines.push(`/goal ${featureId} 编译零错误（${SIGNALS.COMPILE}），`);
  lines.push(`${DOMAIN_TEST_HINT(domains)} 全绿且非空（${SIGNALS.TEST}），`);
  lines.push(`AC-coverage 核验通过（${SIGNALS.ACCOV}），`);

  if (tier === 'standard' || tier === 'complex') {
    lines.push(`架构合规（${SIGNALS.ARCH}）+ 字段同步（${SIGNALS.FIELDSYNC}），`);
  }
  if (tier === 'complex') {
    // 「命令」类 AC 需显式列出（测试覆盖不到）
    const cmdAcs = acs.filter((a) => a.method === '命令');
    for (const ac of cmdAcs) {
      lines.push(`${ac.id}（${ac.desc}）通过对应命令验证，`);
    }
  }

  // 核心/次要分组判定语
  if (minorIds.length > 0) {
    lines.push(`核心 AC（${coreRange}）全部达成即视为完成；次要 AC（${minorIds.join(',')}）失败转 ⚠️ 留 checkpoint。`);
  } else {
    lines.push(`核心 AC（${coreRange}）全部达成。`);
  }

  lines.push(`完成后展示验收条件逐条检查结果。`);

  return lines.join('\n');
}

// ── 主流程 ───────────────────────────────────────────────

function main() {
  const opts = parseArgs();
  if (opts.help || !opts.contract) {
    console.error(
      '用法: node scripts/compile-goal.mjs --contract .claude/contracts/F001-xxx.md [--print]',
    );
    process.exit(opts.help ? 0 : 1);
  }

  let parsed;
  try {
    parsed = parseContract(opts.contract);
  } catch (e) {
    console.error(`❌ 读取契约失败: ${e.message}`);
    process.exit(1);
  }

  const errors = validate(parsed);
  if (errors.length > 0) {
    console.error('❌ 契约结构不满足 compile-goal 的机器解析前提，请先修契约：');
    for (const err of errors) console.error(`  · ${err}`);
    console.error('\n提示：验证方式必须是 {编译,测试,脚本,命令} 之一，优先级必须 {P0,P1}。');
    process.exit(1);
  }

  const tier = decideTier(parsed.acs);
  const goal = buildGoal({ ...parsed, tier });

  if (opts.print) {
    process.stdout.write(goal + '\n');
  } else {
    console.log('═══ compile-goal 推导结果 ═══');
    console.log(`Feature: ${parsed.featureId}`);
    console.log(`领域: ${parsed.domains.join(', ') || '(未标注)'}`);
    console.log(`AC 数: ${parsed.acs.length}（P0 核心 ${parsed.acs.filter((a) => a.priority === 'P0').length} / P1 次要 ${parsed.acs.filter((a) => a.priority === 'P1').length}）`);
    console.log(`定档: ${tier}（客观闸门，非 LLM 判断）`);
    console.log('────────────────────────────');
    console.log(goal);
    console.log('────────────────────────────');
    console.log('复制上方 /goal 文本到 Claude Code。信号串定义见 core/dev-flow/references/signal-glossary.md。');
  }
}

main();
