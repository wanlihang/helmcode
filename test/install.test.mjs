import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compareSemver, detectPreset } from '../install.mjs';

describe('compareSemver', () => {
  it('equal versions return 0', () => {
    assert.equal(compareSemver('1.2.3', '1.2.3'), 0);
  });

  it('greater major returns 1', () => {
    assert.equal(compareSemver('2.0.0', '1.9.9'), 1);
  });

  it('lesser minor returns -1', () => {
    assert.equal(compareSemver('1.0.0', '1.1.0'), -1);
  });

  it('patch comparison', () => {
    assert.equal(compareSemver('1.0.2', '1.0.1'), 1);
    assert.equal(compareSemver('1.0.0', '1.0.1'), -1);
  });

  it('strips leading v', () => {
    assert.equal(compareSemver('v2.1.0', '2.1.0'), 0);
    assert.equal(compareSemver('v2.1.0', 'v2.0.0'), 1);
  });

  it('strips prerelease suffix', () => {
    assert.equal(compareSemver('2.1.0-beta.1', '2.1.0'), 0);
  });

  it('handles missing parts', () => {
    assert.equal(compareSemver('1', '1.0.0'), 0);
    assert.equal(compareSemver('1.2', '1.2.0'), 0);
  });

  it('handles null/undefined gracefully', () => {
    assert.equal(compareSemver(null, '1.0.0'), -1);
    assert.equal(compareSemver('1.0.0', undefined), 1);
  });
});

describe('detectPreset', () => {
  let tmpDir;

  it('returns java-ddd when pom.xml exists', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'helmcode-test-'));
    writeFileSync(join(tmpDir, 'pom.xml'), '<project/>');
    assert.equal(detectPreset(tmpDir), 'java-ddd');
    rmSync(tmpDir, { recursive: true });
  });

  it('returns java-ddd when build.gradle exists', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'helmcode-test-'));
    writeFileSync(join(tmpDir, 'build.gradle'), 'plugins {}');
    assert.equal(detectPreset(tmpDir), 'java-ddd');
    rmSync(tmpDir, { recursive: true });
  });

  it('returns minimal for empty directory', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'helmcode-test-'));
    assert.equal(detectPreset(tmpDir), 'minimal');
    rmSync(tmpDir, { recursive: true });
  });

  it('returns minimal for Node.js project', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'helmcode-test-'));
    writeFileSync(join(tmpDir, 'package.json'), '{}');
    assert.equal(detectPreset(tmpDir), 'minimal');
    rmSync(tmpDir, { recursive: true });
  });
});
