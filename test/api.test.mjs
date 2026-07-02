// 宿主：覆盖 F001(AC-001~AC-006) + F002(matrix 死代码移除)。
// 跑法：node --test test/*.test.mjs（AC-008 = 全套绿）。

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { query, checksum, contentChecksum } from '../api.mjs';
import { install } from '../install.mjs';

const HELMCODE_ROOT = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(readFileSync(join(HELMCODE_ROOT, 'package.json'), 'utf-8'));

// ── AC-001: api.mjs 导出 10 个符号 ─────────────────────────
describe('AC-001 api.mjs exports', () => {
  it('exports exactly the 10 expected symbols', async () => {
    const api = await import('../api.mjs');
    const expected = [
      'checksum',
      'contentChecksum',
      'generateProjectConventions',
      'query',
      'scanDOAnnotations',
      'scanExceptionPattern',
      'scanFacadePattern',
      'scanIntegrationPattern',
      'scanMapStruct',
      'scanPersistence',
    ].sort();
    assert.deepEqual(Object.keys(api).sort(), expected);
  });
});

// ── AC-002: package.json exports + files ───────────────────
describe('AC-002 package.json exports/files', () => {
  it('exports["."] → ./api.mjs, exports["./install"] → ./install.mjs', () => {
    assert.equal(pkg.exports?.['.'], './api.mjs');
    assert.equal(pkg.exports?.['./install'], './install.mjs');
  });
  it('files includes api.mjs', () => {
    assert.ok(Array.isArray(pkg.files) && pkg.files.includes('api.mjs'));
  });
});

// ── AC-003: checksum 稳定 + 与 HelmFlow checksumDir 逐字一致 ──
// 复刻 HelmFlow packages/helmcode-manager/src/version.ts checksumDir(BR-001 基准)。
// 任何对 api.mjs checksum 的改动必须保持与此算法一致,否则 drift 检测误报。
function helmflowChecksumDir(rootDir) {
  if (!existsSync(rootDir)) return createHash('sha256').update('').digest('hex');
  const entries = [];
  const walk = (dir) => {
    let list;
    try { list = readdirSync(dir); } catch { return; }
    for (const name of list) {
      const full = join(dir, name);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) walk(full);
      else if (st.isFile()) {
        try {
          entries.push({ relPath: relative(rootDir, full), content: readFileSync(full).toString('utf-8') });
        } catch { /* skip */ }
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

describe('AC-003 checksum', () => {
  const dir = join(HELMCODE_ROOT, 'standards', 'java-ddd');

  it('is a stable 64-hex across calls', () => {
    const a = checksum(dir);
    const b = checksum(dir);
    assert.equal(a, b);
    assert.match(a, /^[0-9a-f]{64}$/);
  });

  it('matches HelmFlow checksumDir byte-for-byte (BR-001)', () => {
    assert.equal(checksum(dir), helmflowChecksumDir(dir));
  });

  it('returns empty-content hash for missing dir', () => {
    const h = checksum(join(tmpdir(), `helmcode-missing-${process.pid}`));
    assert.equal(h, createHash('sha256').update('').digest('hex'));
  });
});

// ── AC-003b: contentChecksum 全量发布内容 checksum ─────────
// 覆盖 package.json files 字段(core/standards/scripts/commands/loader/bin + 根 mjs),
// 排除非发布内容(.git/.claude/test/...),用于 HelmFlow 全变更 drift 感知。
describe('AC-003b contentChecksum', () => {
  it('is a stable 64-hex across calls', () => {
    const a = contentChecksum(HELMCODE_ROOT);
    assert.equal(a, contentChecksum(HELMCODE_ROOT));
    assert.match(a, /^[0-9a-f]{64}$/);
  });

  it('covers more than checksum(standards/{preset}) — 全量 vs 子集', () => {
    assert.notEqual(
      contentChecksum(HELMCODE_ROOT),
      checksum(join(HELMCODE_ROOT, 'standards', 'java-ddd')),
    );
  });

  it('excludes non-files content (test/ & .claude/ do not affect checksum)', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'helmcode-cc-'));
    mkdirSync(join(tmp, 'core'));
    writeFileSync(join(tmp, 'core', 'a.md'), 'A');
    writeFileSync(join(tmp, 'package.json'), JSON.stringify({ files: ['core'] }));
    const before = contentChecksum(tmp);
    // 加非 files 内容(应被排除):test/ 目录 + .claude/ 目录
    mkdirSync(join(tmp, 'test'));
    writeFileSync(join(tmp, 'test', 'x.md'), 'X');
    mkdirSync(join(tmp, '.claude'));
    writeFileSync(join(tmp, '.claude', 'y.md'), 'Y');
    const after = contentChecksum(tmp);
    assert.equal(before, after, 'test/ 与 .claude/ 应被排除,不影响 contentChecksum');
  });

  it('returns empty-content hash for missing home', () => {
    const h = contentChecksum(join(tmpdir(), `helmcode-missing-${process.pid}`));
    assert.equal(h, createHash('sha256').update('').digest('hex'));
  });
});

// ── AC-004: install() 结构化返回 ───────────────────────────
describe('AC-004 install structured return', () => {
  it('returns {installed,skipped,errors,version} for minimal preset', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'helmcode-ac004-'));
    const result = await install({
      preset: 'minimal',
      project: tmp,
      force: true,
      noSelfUpdate: true,
      phaseOffset: 1,
      quiet: true,
    });
    assert.ok(result, 'install() must return a result object');
    for (const k of ['installed', 'skipped', 'errors', 'version']) {
      assert.ok(k in result, `result missing key: ${k}`);
    }
    assert.equal(result.version, pkg.version);
    // installed 为结构化对象(JD-007 正确方案:可程序消费)
    assert.ok(result.installed && typeof result.installed === 'object');
    assert.ok(Array.isArray(result.installed.skills));
    assert.equal(typeof result.installed.standards, 'number');
    assert.ok(Array.isArray(result.installed.dirs));
    assert.ok(!result.installed.dirs.includes('.claude/matrix/'), 'dirs 不含 matrix(已退役)');
    assert.ok(Array.isArray(result.skipped));
    assert.ok(Array.isArray(result.errors));
  });
});

// ── AC-005: query helmcodeHome 注入 ────────────────────────
describe('AC-005 query helmcodeHome injection', () => {
  it('default resolves to package dir (java-ddd has files + checksum)', () => {
    const r = query();
    const java = r.presets.find((p) => p.name === 'java-ddd');
    assert.ok(java, 'java-ddd preset present');
    assert.ok(java.files.length > 0);
    assert.match(java.checksum, /^[0-9a-f]{64}$/);
  });

  it('injected helmcodeHome overrides resolution', () => {
    const injected = query({ helmcodeHome: HELMCODE_ROOT });
    const def = query();
    // 注入本仓库根 与 默认 应得到相同 preset 名集合
    assert.deepEqual(
      injected.presets.map((p) => p.name).sort(),
      def.presets.map((p) => p.name).sort(),
    );
    // 且 java-ddd checksum 一致(同目录)
    assert.equal(
      injected.presets.find((p) => p.name === 'java-ddd').checksum,
      def.presets.find((p) => p.name === 'java-ddd').checksum,
    );
  });

  it('minimal preset has standardsDir=null → checksum null', () => {
    const r = query();
    const minimal = r.presets.find((p) => p.name === 'minimal');
    assert.ok(minimal);
    assert.equal(minimal.checksum, null);
  });
});

// ── AC-006: contract-template matrixCellId + 状态枚举 ──────
describe('AC-006 contract-template', () => {
  const tpl = readFileSync(
    join(HELMCODE_ROOT, 'core', 'clarify', 'references', 'contract-template.md'),
    'utf-8',
  );

  it('contains matrixCellId metadata line', () => {
    assert.match(tpl, /^> - matrixCellId:/m);
  });

  it('status line lists all 6 states incl blocked + abandoned', () => {
    const statusLine = tpl.split('\n').find((l) => l.includes('> - 状态:'));
    assert.ok(statusLine, 'status metadata line exists');
    for (const s of ['draft', 'approved', 'goal-running', 'done', 'blocked', 'abandoned']) {
      assert.ok(statusLine.includes(s), `status line missing: ${s}`);
    }
  });
});

// ── F002 AC-001: install 不再创建 .claude/matrix/(matrix.yaml 退役,死代码移除) ──
describe('F002 no .claude/matrix on install', () => {
  it('install 后无 .claude/matrix/ 目录', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'helmcode-f002-'));
    await install({
      preset: 'minimal',
      project: tmp,
      force: true,
      noSelfUpdate: true,
      phaseOffset: 1,
      quiet: true,
    });
    const matrixDir = join(tmp, '.claude', 'matrix');
    assert.ok(!existsSync(matrixDir), '.claude/matrix/ 不应存在(matrix.yaml 已退役)');
  });
});
