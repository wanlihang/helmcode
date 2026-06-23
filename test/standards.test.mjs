// F003 验证：review-rules §H 含「禁止内联全限定类名」规则 + 两个例外。
// 跑法：node --test test/*.test.mjs（AC-004 = 全套绿）。

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RULES = readFileSync(join(ROOT, 'standards/java-ddd/review-rules.md'), 'utf-8');

describe('AC-001 review-rules §H 禁止内联全限定类名', () => {
  // §H 是 ## H. 到 ## I. 之间
  const sectionH = RULES.split('## H.')[1]?.split('## I.')[0] ?? '';

  it('§H 含禁止内联全限定类名规则', () => {
    assert.match(sectionH, /不内联全限定类名/);
  });

  it('规则强制 import 后用简名', () => {
    assert.match(sectionH, /import.*简名|import.*后用/);
  });

  it('例外①：同文件同名类消歧', () => {
    assert.match(sectionH, /消歧|java\.util\.Date|java\.sql\.Date/);
  });

  it('例外②：ACTS/序列化 yaml 全限定名', () => {
    assert.match(sectionH, /ACTS|序列化 yaml|!!com/);
  });
});
