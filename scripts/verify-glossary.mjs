#!/usr/bin/env node

/**
 * HelmCode 信号对账脚本（治 D2）
 *
 * signal-glossary.md 是评估器信号的唯一事实源。
 * 本脚本对账三方一致：
 *   1. signal-glossary.md 定义的信号串
 *   2. scripts/compile-goal.mjs 的 SIGNALS 常量
 *   3. verify/SKILL.md 实际 emit 的串（文本 grep）
 *
 * 任何一方改了措辞，本脚本报不一致——防止评估器静默失效。
 *
 * 双态自适应（终端用户 + 维护者都能跑）：
 *   · 开发态：脚本在 <helmcode仓库>/scripts/，glossary/SKILL 在 <仓库>/core/ 下
 *   · 安装态：脚本在 <project>/.claude/scripts/，glossary/SKILL 在 <project>/.claude/skills/ 下
 *   脚本探测自己所在环境，自动选 core/ 或 skills/ 前缀。
 *
 * 用法:
 *   node scripts/verify-glossary.mjs                       # 开发态/CI（仓库内）
 *   node .claude/scripts/verify-glossary.mjs               # 安装态（用户项目内）
 *   退出码 0 = 一致；非 0 = 有 drift，必须修。
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 双态路径解析 ─────────────────────────────────────────
// SCRIPTS_DIR = 脚本所在目录（开发态 = <仓库>/scripts，安装态 = <project>/.claude/scripts）
// SKILLS_ROOT = skill 文件所在根：
//   · 开发态：<仓库>（core/ 下是 skill 源）
//   · 安装态：<project>/.claude（skills/ 下是装好的 skill）
const SCRIPTS_DIR = __dirname;
const PARENT = resolve(SCRIPTS_DIR, '..'); // 开发态=<仓库>，安装态=<project>/.claude
const IS_INSTALLED = existsSync(join(PARENT, 'skills'));
const SKILLS_ROOT = PARENT; // 两种态都向上一级找 skill 根
const SKILLS_SUBDIR = IS_INSTALLED ? 'skills' : 'core';

function skillPath(...segs) {
  return join(SKILLS_ROOT, SKILLS_SUBDIR, ...segs);
}

// ── 对账目标文件 ─────────────────────────────────────────

const GLOSSARY_PATH = skillPath('dev-flow', 'references', 'signal-glossary.md');
const COMPILE_GOAL_PATH = join(SCRIPTS_DIR, 'compile-goal.mjs'); // 同目录
const VERIFY_SKILL_PATH = skillPath('verify', 'SKILL.md');

// ── 期望一致的信号锚点（从 glossary 提取的关键可 grep 子串）──
// 选「足以唯一标识该信号」的子串，避免占位符干扰。
const EXPECTED = {
  SIG_COMPILE: '编译通过：BUILD SUCCESS',
  SIG_TEST: '测试通过：Tests run:',
  SIG_TEST_N1: '(N ≥ 1)',
  SIG_TEST_EMPTY: '测试不存在：Tests run: 0',
  SIG_ACCOV: 'AC-coverage：AC-',
  SIG_ACCOV_FAIL: 'AC-coverage：AC-',
  SIG_FIELDSYNC: '字段同步：全部通过',
  SIG_ARCH: '架构合规：全部通过',
  SIG_ACLIINE: '— 通过',
  SIG_DONE: '✅ 所有验证通过',
  SIG_DONE_CORE: '✅ 核心 AC 全部通过，次要 AC',
  SIG_COVERAGE: '覆盖率：行',
  SIG_COVERAGE_FAIL: '未达阈值',
  SIG_TEST_EFF: '测试有效性：无空断言',
  SIG_TEST_EFF_FAIL: '测试有效性：',
};

// ── helpers ──────────────────────────────────────────────

function read(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8');
}

function check(label, cond, detail) {
  if (cond) {
    console.log(`  ✅ ${label}`);
    return true;
  }
  console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  return false;
}

// ── 1. glossary 自身完整性 ───────────────────────────────

function checkGlossary(glossary) {
  console.log('\n[1] signal-glossary.md 信号定义完整性');
  let ok = true;
  for (const [id, substr] of Object.entries(EXPECTED)) {
    ok = check(`${id} 定义存在`, glossary.includes(substr), `缺 "${substr}"`) && ok;
  }
  return ok;
}

// ── 2. compile-goal.mjs 的 SIGNALS 常量与 glossary 一致 ──

function checkCompileGoal(src) {
  console.log('\n[2] compile-goal.mjs SIGNALS 常量与 glossary 一致');
  let ok = true;
  // compile-goal 用的是 goal 查找串（BUILD SUCCESS / Tests run: ... N ≥ 1 ... / AC-coverage 全部 1:1 映射 / 字段同步：全部通过 / 架构合规：全部通过）
  ok = check("SIGNALS.COMPILE 含 'BUILD SUCCESS'", src.includes("'BUILD SUCCESS'") || src.includes('"BUILD SUCCESS"')) && ok;
  ok = check("SIGNALS.TEST 含 'N ≥ 1'", src.includes('N ≥ 1')) && ok;
  ok = check("SIGNALS.ACCOV 含 'AC-coverage 全部 1:1 映射'", src.includes('AC-coverage 全部 1:1 映射')) && ok;
  ok = check("SIGNALS.FIELDSYNC 含 '字段同步：全部通过'", src.includes('字段同步：全部通过')) && ok;
  ok = check("SIGNALS.ARCH 含 '架构合规：全部通过'", src.includes('架构合规：全部通过')) && ok;
  return ok;
}

// ── 3. verify/SKILL.md emit 的串与 glossary 一致 ─────────

function checkVerifySkill(src) {
  console.log('\n[3] verify/SKILL.md emit 串与 glossary 一致');
  let ok = true;
  ok = check('emit SIG-COMPILE', src.includes('编译通过：BUILD SUCCESS')) && ok;
  ok = check('emit SIG-TEST（含 N ≥ 1）', src.includes('测试通过：Tests run: {N} (N ≥ 1)')) && ok;
  ok = check('emit SIG-TEST-EMPTY', src.includes('测试不存在：Tests run: 0')) && ok;
  ok = check('emit SIG-ACCOV', src.includes('AC-coverage：AC-')) && ok;
  ok = check('emit SIG-FIELDSYNC', src.includes('字段同步：全部通过')) && ok;
  ok = check('emit SIG-ARCH', src.includes('架构合规：全部通过')) && ok;
  ok = check('emit SIG-DONE', src.includes('✅ 所有验证通过')) && ok;
  ok = check('emit SIG-DONE-CORE', src.includes('✅ 核心 AC 全部通过，次要 AC')) && ok;
  ok = check('emit SIG-COVERAGE', src.includes('覆盖率：行')) && ok;
  ok = check('emit SIG-TEST-EFF', src.includes('测试有效性：无空断言')) && ok;
  // 旧的 drifted 串必须已清除
  ok = check('旧 drift 串「字段同步检查通过」已清除', !src.includes('字段同步检查通过')) && ok;
  ok = check('旧 drift 串「架构合规检查通过」已清除', !src.includes('架构合规检查通过')) && ok;
  ok = check('旧 drift 串「Tests run: {N}, Failures」（缺 N≥1）已清除', !src.includes('Tests run: {N}, Failures: 0')) && ok;
  return ok;
}

// ── 主流程 ───────────────────────────────────────────────

function main() {
  console.log('═══ HelmCode 信号对账（verify-glossary）═══');

  const glossary = read(GLOSSARY_PATH);
  if (!glossary) {
    console.error(`❌ 找不到 ${GLOSSARY_PATH}`);
    process.exit(1);
  }
  const compileGoal = read(COMPILE_GOAL_PATH);
  const verifySkill = read(VERIFY_SKILL_PATH);
  if (!compileGoal || !verifySkill) {
    console.error('❌ 找不到 compile-goal.mjs 或 verify/SKILL.md');
    process.exit(1);
  }

  const results = [
    checkGlossary(glossary),
    checkCompileGoal(compileGoal),
    checkVerifySkill(verifySkill),
  ];
  const allOk = results.every(Boolean);

  console.log('\n══════════════════════════════');
  if (allOk) {
    console.log('✅ 对账通过：glossary / compile-goal / verify 三方信号一致。');
    process.exit(0);
  } else {
    console.log('❌ 对账失败：存在 drift。修法——只改 signal-glossary.md，改完重跑本脚本。');
    process.exit(1);
  }
}

main();
