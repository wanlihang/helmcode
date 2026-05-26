#!/usr/bin/env node

/**
 * HelmCode 架构规则校验
 *
 * 检查 Java DDD 项目的分层依赖规则、注解使用规范。
 * 基于项目根目录下的 .claude/standards/review-rules.md。
 *
 * 用法: node verify-arch-rules.mjs --project /path/to/project [--domain recon]
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

// ── 参数解析 ─────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project') opts.project = resolve(args[++i]);
    else if (args[i] === '--domain') opts.domain = args[++i];
  }
  return opts;
}

// ── 文件搜索 ─────────────────────────────────────────────

function findJavaFiles(dir, maxDepth = 10) {
  if (!existsSync(dir)) return [];
  const results = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'target' || entry.name === '.git' || entry.name === 'node_modules') continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && maxDepth > 0) {
      results.push(...findJavaFiles(fullPath, maxDepth - 1));
    } else if (entry.name.endsWith('.java')) {
      results.push(fullPath);
    }
  }
  return results;
}

// ── 检查规则 ─────────────────────────────────────────────

const rules = [
  {
    id: 'ARCH-001',
    name: 'Domain 层不依赖 Infrastructure',
    check(files, projectDir) {
      const issues = [];
      for (const f of files) {
        const content = readFileSync(f, 'utf-8');
        const rel = relative(projectDir, f);
        if (rel.includes('/domain/')) {
          // Detect infrastructure import by pattern: any import containing .infrastructure.
          const infraImportMatch = content.match(/import\s+[\w.]+\.infrastructure\./);
          if (infraImportMatch) {
            issues.push({ file: rel, detail: `domain 层引用了 infrastructure 包: ${infraImportMatch[0]}` });
          }
        }
      }
      return issues;
    },
  },
  {
    id: 'ARCH-002',
    name: 'Domain 层不使用 @Slf4j',
    check(files, projectDir) {
      const issues = [];
      for (const f of files) {
        const rel = relative(projectDir, f);
        if (rel.includes('/domain/')) {
          const content = readFileSync(f, 'utf-8');
          if (content.includes('@Slf4j') || content.includes('import lombok.extern.slf4j.Slf4j')) {
            issues.push({ file: rel, detail: 'domain 层使用了 @Slf4j' });
          }
        }
      }
      return issues;
    },
  },
  {
    id: 'ARCH-003',
    name: 'Entity 使用 @Getter/@Setter 不使用 @Data',
    check(files, projectDir) {
      const issues = [];
      for (const f of files) {
        const rel = relative(projectDir, f);
        if (rel.includes('/domain/model/') && !rel.includes('Test')) {
          const content = readFileSync(f, 'utf-8');
          if (content.includes('@Data') && !content.includes('@Getter')) {
            issues.push({ file: rel, detail: 'Entity 使用了 @Data 而非 @Getter/@Setter' });
          }
        }
      }
      return issues;
    },
  },
  {
    id: 'ARCH-004',
    name: 'Facade 实现使用 @RpcProvider',
    check(files, projectDir) {
      const issues = [];
      for (const f of files) {
        const rel = relative(projectDir, f);
        if (rel.includes('/application/facade/') && rel.endsWith('Impl.java')) {
          const content = readFileSync(f, 'utf-8');
          if (!content.includes('@RpcProvider')) {
            issues.push({ file: rel, detail: 'Facade 实现未使用 @RpcProvider' });
          }
          if (content.includes('@Service') && content.includes('FacadeImpl')) {
            issues.push({ file: rel, detail: 'Facade 实现使用了 @Service（应使用 @RpcProvider）' });
          }
        }
      }
      return issues;
    },
  },
  {
    id: 'ARCH-005',
    name: '不使用 RuntimeException',
    check(files, projectDir) {
      const issues = [];
      for (const f of files) {
        const rel = relative(projectDir, f);
        if (rel.includes('/target/')) continue;
        const content = readFileSync(f, 'utf-8');
        if (content.includes('new RuntimeException(')) {
          issues.push({ file: rel, detail: '使用了 RuntimeException（应使用 MycmBizException/MycmSysException）' });
        }
      }
      return issues;
    },
  },
];

// ── 主逻辑 ───────────────────────────────────────────────

function verify(projectDir, domain) {
  console.log(`\n## 架构规则校验\n`);
  console.log(`项目: ${projectDir}${domain ? `  域: ${domain}` : ''}\n`);

  const srcDir = join(projectDir, 'app');
  if (!existsSync(srcDir)) {
    console.log('⚠️  未找到 app/ 目录，跳过架构检查');
    return { errors: 0, warnings: 0 };
  }

  const files = findJavaFiles(srcDir);
  console.log(`扫描 ${files.length} 个 Java 文件...\n`);

  let errors = 0;
  let warnings = 0;

  for (const rule of rules) {
    const issues = rule.check(files, projectDir);
    if (issues.length === 0) {
      console.log(`✅ [${rule.id}] ${rule.name}`);
    } else {
      for (const issue of issues) {
        // 如果指定了 domain，只检查该 domain
        if (domain && !issue.file.includes(`/${domain}/`)) continue;
        console.log(`❌ [${rule.id}] ${issue.file}: ${issue.detail}`);
        errors++;
      }
    }
  }

  console.log(`\n---`);
  console.log(`结果: ${errors} 错误\n`);

  return { errors, warnings };
}

// ── Entry ────────────────────────────────────────────────

const opts = parseArgs();
if (!opts.project) {
  console.error('用法: node verify-arch-rules.mjs --project <project-dir> [--domain <name>]');
  process.exit(1);
}

const { errors } = verify(opts.project, opts.domain);
process.exit(errors > 0 ? 1 : 0);
