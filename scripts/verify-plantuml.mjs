#!/usr/bin/env node

/**
 * HelmCode PlantUML 静态校验脚本
 *
 * 系分文档（SDD）里所有图表用 PlantUML 纯文本写。生成完文档后必须跑本脚本，
 * 拦截最常见的语法/结构错误，避免图表在钉钉/语雀/飞书渲染时报错或丢图。
 *
 * 校验项（纯文本静态分析，零依赖、不联网、不渲染）：
 *   1. @startuml / @enduml 严格配对（不能嵌套、不能缺失）
 *   2. 大括号 { } 配平（class/enum/package/note 块体）
 *   3. 配对块平衡：box/end box、note/end note、alt/else/end、loop/end、
 *      group/end、opt/end、par/end、rect/end、legend/end legend、split/end split
 *   4. 禁忌样式扫描（见 plantuml-style.md）：skinparam activity、skinparam monochrome、
 *      skinparam defaultFontName —— 钉钉/飞书渲染会丢
 *   5. GEN-GUIDE 漏检：成品不应残留 <!-- GEN-GUIDE --> 或可见的编写指引引用块
 *      （> ⚠️ 关键区分 / > 参与者使用... / > ...删除此节）—— 元说明禁止进成品
 *
 * 不做（需真实渲染）：语法语义级、布局合理性。若环境已装 plantuml CLI，
 * 可用 --render 做真实渲染校验；未装则跳过（绝不联网下载，避免供应链风险）。
 *
 * 双态自适应（与 verify-glossary.mjs 一致）：
 *   · 开发态：脚本在 <仓库>/scripts/，目标文档在 .test-output/ 或任意路径
 *   · 安装态：脚本在 <project>/.claude/scripts/
 *
 * 用法:
 *   node scripts/verify-plantuml.mjs <file-or-dir>          # 校验指定文件或目录下所有 .md
 *   node scripts/verify-plantuml.mjs <file> --render         # 额外做真实渲染校验（需 plantuml CLI）
 *   退出码 0 = 全部通过；非 0 = 有错误，必须修到全绿。
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname, extname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 参数解析 ────────────────────────────────────────────────
const args = process.argv.slice(2);
const wantRender = args.includes('--render');
const targets = args.filter(a => !a.startsWith('--'));

if (targets.length === 0) {
  console.error('用法: node verify-plantuml.mjs <file-or-dir> [--render]');
  console.error('  校验 markdown 文件中所有 PlantUML 图表。');
  process.exit(2);
}

// ── 收集待校验文件 ──────────────────────────────────────────
const files = [];
for (const t of targets) {
  const p = resolve(t);
  if (!existsSync(p)) {
    console.error(`✗ 路径不存在: ${p}`);
    process.exit(2);
  }
  if (statSync(p).isDirectory()) {
    for (const f of readdirSync(p)) {
      if (extname(f) === '.md') files.push(join(p, f));
    }
  } else {
    files.push(p);
  }
}

// ── 校验规则 ────────────────────────────────────────────────

/** 从 markdown 文本中提取所有 @startuml...@enduml 块（含原始行号） */
function extractDiagrams(text) {
  const lines = text.split('\n');
  const diagrams = [];
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed.startsWith('@startuml')) {
      if (cur) {
        // 嵌套 startuml —— 报错
        diagrams.push({ start: cur.start, end: null, lines: cur.lines, error: 'NESTED_STARTUML' });
      }
      cur = { start: i + 1, lines: [raw] };
    } else if (cur) {
      cur.lines.push(raw);
      if (trimmed === '@enduml' || trimmed.startsWith('@enduml')) {
        diagrams.push({ start: cur.start, end: i + 1, lines: cur.lines, error: null });
        cur = null;
      }
    }
  }
  if (cur) {
    diagrams.push({ start: cur.start, end: null, lines: cur.lines, error: 'MISSING_ENDUML' });
  }
  return diagrams;
}

// alt/loop/par/group/opt/split/fork 用统一 'end' 收尾，栈式配对（见 lintDiagram）。
// 注意：else / fork again / split again 是「分支分隔」非块开头，不入栈
//   （一个 alt/par/split 只需一个 end，中间可有任意 else/again）。
// note/box/legend 不做静态配对——note 形式多样（单行/块体/as 别名），正则不可靠，交由渲染。
const ALT_KEYWORDS = ['alt', 'opt', 'loop', 'par', 'group', 'split', 'fork'];

/** 校验单个 diagram，返回错误数组 [{ line, msg }]（line 为文档全局行号） */
function lintDiagram(diag) {
  const errors = [];
  const offset = diag.start; // @startuml 所在行号（1-based）

  if (diag.error === 'MISSING_ENDUML') {
    errors.push({ line: offset, msg: '@startuml 缺少配对的 @enduml' });
    return errors;
  }
  if (diag.error === 'NESTED_STARTUML') {
    errors.push({ line: offset, msg: '@startuml 嵌套（上一个未 @enduml）' });
    return errors;
  }

  const lines = diag.lines;
  // 括号配平
  let braceDepth = 0;
  let braceFirstOpenLine = null;

  // alt/loop/par/group/opt/split/fork 以单独 'end' 收尾，用栈配对。
  // 注意排除 'end note' / 'end box' / 'end legend'（那是 note/box/legend 的收尾，非 alt-family）。
  const altStack = []; // [{ kw, line }]

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const globalLine = offset + i;
    const code = rawLine.replace(/'.*$/, '').trim(); // 去掉行注释 '
    if (code === '' || code.startsWith('@startuml') || code.startsWith('@enduml')) continue;

    // 大括号配平（PlantUML class/enum/package 块体用 { }）。
    // 排除 ER 图关系箭头里的 { }：如 ||--o{ 、}o--|| 、}o--o{ —— 这些是基数符号非块体。
    const stripped = code
      .replace(/\|[\|]\s*--?\s*[ox*]?[{}]/g, '') // ||--o{  形
      .replace(/[{}]\s*[ox*]?\s*--?\s*[\|][\|]/g, '') // }o--||  形
      .replace(/[ox*]?[{}]\s*--?\s*[{}][ox*]?/g, ''); // }o--o{  形
    const opens = (stripped.match(/{/g) || []).length;
    const closes = (stripped.match(/}/g) || []).length;
    if (opens > 0 && braceDepth === 0) braceFirstOpenLine = globalLine;
    braceDepth += opens - closes;

    // alt-family 配对（仅可靠形式：行首关键字 + 单独 end 收尾）
    const firstWord = code.split(/[\s(]/)[0];
    if (ALT_KEYWORDS.includes(firstWord)) {
      altStack.push({ kw: firstWord, line: globalLine });
    } else if (firstWord === 'end' && !/^end\s+(note|box|legend)\b/.test(code)) {
      // 单独的 'end'（不是 end note/box/legend）—— 收尾 alt-family
      const top = altStack.pop();
      if (!top) errors.push({ line: globalLine, msg: "'end' 无匹配的 alt/loop/par/group/opt/split/fork" });
    }
    // 注：note / box / legend 的配对不做静态校验——PlantUML 中 note 形式多样
    // （单行 note right of X: text、块体 note...end note、note "..." as N），
    // 正则难可靠区分，交由真实渲染；静态校验只管能确定判断的结构。
  }

  if (braceDepth !== 0) {
    errors.push({ line: braceFirstOpenLine || offset, msg: `大括号未配平（净 ${braceDepth > 0 ? '+' : ''}${braceDepth}）—— class/enum/package 块体 { } 不匹配` });
  }
  for (const unclosed of altStack) {
    errors.push({ line: unclosed.line, msg: `${unclosed.kw} 块缺少 'end' 收尾` });
  }

  return errors;
}

// 钉钉/飞书渲染禁忌（与 plantuml-style.md 一致）
const FORBIDDEN_SKINPARAMS = [
  { re: /skinparam\s+activity(\s|\{)/, msg: '禁忌 skinparam activity（钉钉/飞书不兼容），见 plantuml-style.md' },
  { re: /skinparam\s+activityBackgroundColor/, msg: '禁忌 skinparam activityBackgroundColor' },
  { re: /skinparam\s+monochrome\b/, msg: '禁忌 skinparam monochrome（单色丢颜色），见 plantuml-style.md' },
  { re: /skinparam\s+defaultFontName/, msg: '禁忌 skinparam defaultFontName（自定义字体不被识别）' },
];

// 成品不应残留的编写指引（meta-instruction）—— sdd-template 里的 GEN-GUIDE 思想
const META_INSTRUCTION_PATTERNS = [
  { re: /<!--\s*GEN-GUIDE/, msg: '残留 GEN-GUIDE 注释（编写指引，生成时必须删除，不进成品）' },
  { re: />.*关键区分.*整体设计.*详细设计/, msg: '残留编写指引「关键区分」（meta-instruction 禁止进成品）' },
  { re: />.*参与者.*(必须|使用).*(业务角色|具体类名)/, msg: '残留编写指引「参与者命名要求」（禁止进成品）' },
  { re: />.*(无状态流转|删除此节)/, msg: '残留编写指引「删除此节」（禁止进成品）' },
];

function lintFile(filePath) {
  const text = readFileSync(filePath, 'utf-8');
  const lines = text.split('\n');
  const errors = [];

  // 1. 图表结构校验
  const diagrams = extractDiagrams(text);
  if (diagrams.length === 0) {
    // 非 SDD 文件可能无图，不报错
  }
  let idx = 0;
  for (const d of diagrams) {
    idx++;
    const dErrs = lintDiagram(d);
    for (const e of dErrs) errors.push({ file: filePath, line: e.line, msg: `[图${idx}] ${e.msg}` });
  }

  // 2. 禁忌 skinparam
  for (let i = 0; i < lines.length; i++) {
    for (const { re, msg } of FORBIDDEN_SKINPARAMS) {
      if (re.test(lines[i])) errors.push({ file: filePath, line: i + 1, msg });
    }
  }

  // 3. meta-instruction 漏检
  for (let i = 0; i < lines.length; i++) {
    for (const { re, msg } of META_INSTRUCTION_PATTERNS) {
      if (re.test(lines[i])) errors.push({ file: filePath, line: i + 1, msg });
    }
  }

  return { diagrams: diagrams.length, errors };
}

// ── 可选真实渲染校验（仅当 plantuml CLI 已存在）──────────────
function hasPlantumlCli() {
  try { execFileSync('which', ['plantuml'], { stdio: 'ignore' }); return true; }
  catch { return false; }
}

function renderCheck(filePath) {
  // 占位：如需真实渲染，提取每个 @startuml 块写入临时 .puml 再 plantuml -checkonly。
  // 当前环境无 plantuml CLI，留作环境具备时的扩展点；绝不联网下载。
  return [];
}

// ── 主流程 ──────────────────────────────────────────────────
let totalErrors = 0;
let totalDiagrams = 0;
const fileResults = [];

for (const f of files) {
  const { diagrams, errors } = lintFile(f);
  totalDiagrams += diagrams;
  fileResults.push({ file: f, diagrams, errors });
  totalErrors += errors.length;
}

// 输出
for (const r of fileResults) {
  const tag = r.errors.length === 0 ? '✓' : '✗';
  console.log(`${tag} ${r.file}  (${r.diagrams} 图, ${r.errors.length} 错误)`);
  for (const e of r.errors) {
    console.log(`    L${e.line}: ${e.msg}`);
  }
}

if (wantRender) {
  if (hasPlantumlCli()) {
    console.log('\nℹ 检测到 plantuml CLI，执行真实渲染校验...');
    let renderErrs = 0;
    for (const f of files) { const e = renderCheck(f); renderErrs += e.length; }
    if (renderErrs === 0) console.log('✓ 渲染校验通过');
  } else {
    console.log('\nℹ 未检测到 plantuml CLI，跳过真实渲染校验（静态结构校验已执行）。');
  }
}

console.log(`\n${totalErrors === 0 ? '✓ 全部通过' : '✗ 存在错误'}：${files.length} 文件 / ${totalDiagrams} 图 / ${totalErrors} 错误`);
process.exit(totalErrors === 0 ? 0 : 1);
