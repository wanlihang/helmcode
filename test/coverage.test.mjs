// F004 测试：pom jacoco/pitest + verify-coverage 解析 + 信号 + standards 约束。
// 跑法：node --test test/*.test.mjs（AC-008 = 全套绿）。

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, evaluate, formatSignal } from '../scripts/verify-coverage.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const POM_PATH = join(ROOT, 'core/init-java-ddd/templates/root/pom.xml.tmpl');

// ── AC-001: pom jacoco-maven-plugin ──────────────────────
describe('AC-001 pom jacoco plugin', () => {
  const pom = readFileSync(POM_PATH, 'utf-8');
  it('含 jacoco-maven-plugin', () => assert.match(pom, /jacoco-maven-plugin/));
  it('含 prepare-agent + report + check', () => {
    assert.match(pom, /prepare-agent/);
    assert.match(pom, /<goal>report<\/goal>/);
    assert.match(pom, /<goal>check<\/goal>/);
  });
  it('check 阈值 LINE≥0.80 BRANCH≥0.70', () => {
    assert.match(pom, /<counter>LINE<\/counter><value>COVEREDRATIO<\/value><minimum>0\.80<\/minimum>/);
    assert.match(pom, /<counter>BRANCH<\/counter><value>COVEREDRATIO<\/value><minimum>0\.70<\/minimum>/);
  });
  it('excludes 生成代码', () => assert.match(pom, /<excludes>/));
  it('jacoco propertyName=argLine(非 jacocoArgLine)', () => {
    assert.match(pom, /<propertyName>argLine<\/propertyName>/);
    assert.ok(!/jacocoArgLine/.test(pom), '不应有 jacocoArgLine 残留');
  });
  it('surefire argLine 用 @{argLine}(延迟求值拾取 agent)', () => assert.match(pom, /@\{argLine\}/));
});

// ── AC-002: pom pitest profile ───────────────────────────
describe('AC-002 pom pitest profile', () => {
  const pom = readFileSync(POM_PATH, 'utf-8');
  it('含 pitest profile id=pit', () => {
    assert.match(pom, /<id>pit<\/id>[\s\S]*pitest-maven/);
  });
  it('mutationThreshold 80', () => assert.match(pom, /<mutationThreshold>80<\/mutationThreshold>/));
});

// ── F005: app/test pom surefire @{argLine}(3 execution 拾取 jacoco agent) ──
describe('F005 app/test pom 3 execution @{argLine}', () => {
  const pom = readFileSync(join(ROOT, 'core/init-java-ddd/templates/app/test/pom.xml.tmpl'), 'utf-8');
  const matches = pom.match(/@\{argLine\}/g) || [];
  it('3 个 execution 都拾取 agent(@{argLine} ≥ 3 次)', () => {
    assert.ok(matches.length >= 3, `@{argLine} 出现 ${matches.length} 次,应 ≥ 3(默认/test-arch-and-smoke/test-testng)`);
  });
  it('test-testng 保留 -Xmx(@{argLine} 后追加, AC-003)', () => {
    assert.match(pom, /<argLine>@\{argLine\} -Xmx1024m/);
  });
});

// ── AC-003: verify-coverage 解析 jacoco.csv ──────────────
describe('AC-003 verify-coverage 解析 csv', () => {
  const HEADER =
    'GROUP,PACKAGE,CLASS,INSTRUCTION_MISSED,INSTRUCTION_COVERED,BRANCH_MISSED,BRANCH_COVERED,LINE_MISSED,LINE_COVERED,COMPLEXITY_MISSED,COMPLEXITY_COVERED,METHOD_MISSED,METHOD_COVERED';

  it('parseCsv 累加 line/branch', () => {
    const csv = [HEADER, 'g,p,Foo,0,10,0,4,0,5,0,2,0,2', 'g,p,Bar,2,8,1,3,1,4,1,1,0,1'].join('\n');
    const s = parseCsv(csv);
    assert.equal(s.lineMissed, 1); // 0+1
    assert.equal(s.lineCov, 9); // 5+4
    assert.equal(s.branchMissed, 1); // 0+1
    assert.equal(s.branchCov, 7); // 4+3
  });

  it('达标(行90% 分支87%) emit SIG-COVERAGE', () => {
    const csv = [HEADER, 'g,p,Foo,0,10,0,4,0,5,0,2,0,2', 'g,p,Bar,2,8,1,3,1,4,1,1,0,1'].join('\n');
    const ev = evaluate(parseCsv(csv));
    assert.equal(ev.pass, true);
    assert.match(formatSignal(ev), /^✅ 覆盖率：行 \d+% \/ 分支 \d+% 达标$/);
  });

  it('未达(行20% 分支25%) emit SIG-COVERAGE-FAIL', () => {
    const csv = [HEADER, 'g,p,Foo,8,2,3,1,8,2,3,1,2,0'].join('\n');
    const ev = evaluate(parseCsv(csv));
    assert.equal(ev.pass, false);
    assert.match(formatSignal(ev), /^❌ 覆盖率：行 \d+% \/ 分支 \d+% 未达阈值/);
  });
});

// ── AC-005: signal-glossary 4 新信号(成对) ───────────────
describe('AC-005 signal-glossary 4 新信号', () => {
  const g = readFileSync(join(ROOT, 'core/dev-flow/references/signal-glossary.md'), 'utf-8');
  it('SIG-COVERAGE', () => assert.match(g, /SIG-COVERAGE\b.*覆盖率：行/));
  it('SIG-COVERAGE-FAIL', () => assert.match(g, /SIG-COVERAGE-FAIL.*未达阈值/));
  it('SIG-TEST-EFF', () => assert.match(g, /SIG-TEST-EFF\b.*测试有效性：无空断言/));
  it('SIG-TEST-EFF-FAIL', () => assert.match(g, /SIG-TEST-EFF-FAIL.*测试有效性：/));
});

// ── AC-007: standards/patterns/review-rules/implement 约束 ──
describe('AC-007 standards 约束', () => {
  it('test-standards §8 有效性', () => {
    const t = readFileSync(join(ROOT, 'standards/java-ddd/test-standards.md'), 'utf-8');
    assert.match(t, /## 8\. 测试有效性/);
    assert.match(t, /禁止恒真断言/);
  });
  it('patterns/test 反模式章节', () => {
    const p = readFileSync(join(ROOT, 'standards/java-ddd/patterns/test.md'), 'utf-8');
    assert.match(p, /## 反模式：假测试/);
  });
  it('review-rules §G 分支覆盖 + 无空断言', () => {
    const r = readFileSync(join(ROOT, 'standards/java-ddd/review-rules.md'), 'utf-8');
    assert.match(r, /分支覆盖达标/);
    assert.match(r, /无空断言/);
  });
  it('implement 遗漏自查 无空断言', () => {
    const i = readFileSync(join(ROOT, 'core/implement/SKILL.md'), 'utf-8');
    assert.match(i, /无空断言/);
  });
});
