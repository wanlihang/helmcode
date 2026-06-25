// F004 AC-004：verify-test-effectiveness 反模式检测（测试有效性）。
// 跑法：node --test test/*.test.mjs。

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMethod, formatSignal } from '../scripts/verify-test-effectiveness.mjs';

describe('AC-004 verify-test-effectiveness 反模式检测', () => {
  it('无断言（方法体无 assert/verify/throw）', () => {
    const v = analyzeMethod('public void testFoo() { facade.foo(cmd); }');
    assert.ok(v.some((x) => x.type === '无断言'));
  });

  it('恒真 assertTrue(true)', () => {
    const v = analyzeMethod('public void testFoo() { Assert.assertTrue(true); }');
    assert.ok(v.some((x) => x.type === '恒真断言'));
  });

  it('恒真 assertFalse(false)', () => {
    const v = analyzeMethod('public void testFoo() { Assert.assertFalse(false); }');
    assert.ok(v.some((x) => x.type === '恒真断言'));
  });

  it('恒真 assertEquals(x,x) 同实参', () => {
    const v = analyzeMethod('public void testFoo() { Assert.assertEquals(status, status); }');
    assert.ok(v.some((x) => x.type === '恒真断言'));
  });

  it('空 catch 吞异常', () => {
    const v = analyzeMethod(
      'public void testFoo() { try { facade.foo(); } catch (Exception e) { } }',
    );
    assert.ok(v.some((x) => x.type === '空catch吞异常'));
  });

  it('干净测试（有意义断言）→ 0 违规', () => {
    const v = analyzeMethod(
      'public void testFoo() { Result r = facade.foo(cmd); Assert.assertEquals(Status.OK, r.getStatus()); }',
    );
    assert.equal(v.length, 0);
  });

  it('@AutoFill data-driven 豁免', () => {
    const v = analyzeMethod('@AutoFill public void testFoo() { facade.foo(cmd); }');
    assert.equal(v.length, 0);
  });

  it('// helmcode-ignore-eff 注释豁免', () => {
    const v = analyzeMethod('// helmcode-ignore-eff\npublic void testFoo() { facade.foo(cmd); }');
    assert.equal(v.length, 0);
  });

  it('formatSignal 干净 → SIG-TEST-EFF', () => {
    assert.match(formatSignal([])[0], /测试有效性：无空断言/);
  });

  it('formatSignal 违规 → SIG-TEST-EFF-FAIL（含 file:line）', () => {
    const out = formatSignal([{ file: 'FooTest.java', line: 5, type: '无断言', detail: 'x' }]);
    assert.match(out[0], /❌ 测试有效性：FooTest.java:5 无断言/);
  });
});
