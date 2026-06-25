#!/usr/bin/env node
/**
 * HelmCode 测试有效性核验（verify §7，F004）。
 *
 * 扫 src/test + app/test 的 *.java，逐 @Test 方法检测反模式（假测试）：
 *   - 无断言（方法体无 assert/verify/expect/throw）
 *   - 恒真断言（assertTrue(true) / assertFalse(false) / assertEquals(x,x)）
 *   - 空 catch（吞异常）
 * 豁免：@AutoFill（ACTS data-driven，断言在 yaml）/ // helmcode-ignore-eff 注释。
 * emit SIG-TEST-EFF / SIG-TEST-EFF-FAIL。
 *
 * 用法:
 *   node verify-test-effectiveness.mjs --project /path/to/project
 *
 * export analyzeMethod/formatSignal 供 test/test-effectiveness.mjs 自测。
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// 有意义的断言/验证/异常抛出
const ASSERT_RE = /\b(assert\w+|Assert\.\w+|Assertions\.\w+|verify\(|expect\(|assertThrows|expectThrow|fail\(|throw\s+new)\b/;
const ALWAYS_TRUE = [/assertTrue\s*\(\s*true\s*\)/, /assertFalse\s*\(\s*false\s*\)/];
// assertEquals(x, x) / assertSame(a, a) —— 两个实参相同标识符
const EQ_SAME = /assert(?:Equals|Same)\s*\(\s*([\w.]+)\s*,\s*\1\s*[,)]/;

/** 分析单个 @Test 方法体，返回反模式列表 [{type, detail}]。 */
export function analyzeMethod(methodSrc) {
  const v = [];
  // 豁免：ACTS @AutoFill data-driven（断言在 yaml Result section）/ 注释逃生口
  if (/@AutoFill/.test(methodSrc) || /helmcode-ignore-eff/.test(methodSrc)) return v;

  for (const re of ALWAYS_TRUE) {
    const m = re.exec(methodSrc);
    if (m) v.push({ type: '恒真断言', detail: m[0] });
  }
  if (EQ_SAME.exec(methodSrc)) v.push({ type: '恒真断言', detail: 'assertEquals(x,x) 同实参' });

  // 空 catch 块（catch (...) { } 内容为空或仅注释）
  const catchRe = /catch\s*\([^)]*\)\s*\{\s*(\/\/[^\n]*)?\s*\}/g;
  if (catchRe.exec(methodSrc)) v.push({ type: '空catch吞异常', detail: 'catch 块无处理' });

  // 无任何断言/验证/异常抛出
  if (!ASSERT_RE.test(methodSrc)) v.push({ type: '无断言', detail: '方法体无 assert/verify/expect/throw' });

  return v;
}

/**
 * 拆 java 文件的 @Test 方法，返回违规 [{file, line, type, detail}]。
 * 用括号平衡提取每个 @Test 注解后的方法体。
 */
export function analyzeFile(content, file) {
  const violations = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/@Test/.test(lines[i])) continue;
    // 从 @Test 行往下找方法体 { ... }
    let j = i;
    let braceStart = -1;
    while (j < lines.length && braceStart < 0) {
      const open = lines[j].indexOf('{');
      if (open >= 0) braceStart = j;
      else j++;
    }
    if (braceStart < 0) continue;
    // 括号平衡取方法体
    let depth = 0;
    let started = false;
    const bodyLines = [];
    for (let k = braceStart; k < lines.length; k++) {
      const line = lines[k];
      for (const ch of line) {
        if (ch === '{') {
          depth++;
          started = true;
        } else if (ch === '}') depth--;
      }
      bodyLines.push(line);
      if (started && depth === 0) {
        const body = bodyLines.join('\n');
        const found = analyzeMethod(body);
        for (const f of found) violations.push({ file, line: i + 1, type: f.type, detail: f.detail });
        i = k; // 跳过已处理方法
        break;
      }
    }
  }
  return violations;
}

/** 生成 SIG-TEST-EFF / SIG-TEST-EFF-FAIL 信号串。 */
export function formatSignal(violations) {
  if (violations.length === 0) return ['✅ 测试有效性：无空断言/废测试'];
  return violations.map((v) => `❌ 测试有效性：${v.file}:${v.line} ${v.type}（${v.detail}）`);
}

function findTestFiles(rootDir) {
  const out = [];
  if (!existsSync(rootDir)) return out;
  const walk = (dir, depth) => {
    if (depth > 10) return;
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const n of entries) {
      if (n === 'node_modules' || n === '.git' || n === 'target' || n === 'build' || n === '.idea') continue;
      const full = join(dir, n);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(full, depth + 1);
      else if (n.endsWith('.java') && /Test\.java$/.test(n)) out.push(full);
    }
  };
  walk(rootDir, 0);
  return out;
}

function parseArgs() {
  const opts = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project') opts.project = resolve(args[++i]);
  }
  return opts;
}

function main() {
  const opts = parseArgs();
  if (!opts.project) {
    console.error('用法: node verify-test-effectiveness.mjs --project <dir>');
    process.exit(1);
  }
  const files = findTestFiles(opts.project);
  if (files.length === 0) {
    console.log('ℹ️ 测试有效性：未找到 *Test.java，SIG-TEST-EFF 跳过');
    return;
  }
  let allViolations = [];
  for (const f of files) {
    const content = readFileSync(f, 'utf-8');
    const rel = f.replace(opts.project + '/', '');
    allViolations = allViolations.concat(analyzeFile(content, rel));
  }
  for (const line of formatSignal(allViolations)) console.log(line);
  if (allViolations.length > 0) process.exitCode = 1;
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === resolve(join(import.meta.dirname, 'verify-test-effectiveness.mjs'));
if (invokedDirectly) main();
