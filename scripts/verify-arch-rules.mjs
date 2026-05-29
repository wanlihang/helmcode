#!/usr/bin/env node

/**
 * HelmCode 架构规则校验
 *
 * 检查 Java DDD 项目的分层依赖规则、注解使用规范。
 * 使用 import 语句解析构建依赖图，支持循环依赖检测。
 *
 * 用法:
 *   node verify-arch-rules.mjs --project /path/to/project [--domain recon]
 *   node verify-arch-rules.mjs --project /path/to/project --freeze > .claude/arch-baseline.json
 *   node verify-arch-rules.mjs --project /path/to/project --baseline .claude/arch-baseline.json
 *   node verify-arch-rules.mjs --project /path/to/project --diff HEAD~1
 */

import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { execSync } from 'node:child_process';

// ── 参数解析 ─────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project') opts.project = resolve(args[++i]);
    else if (args[i] === '--domain') opts.domain = args[++i];
    else if (args[i] === '--freeze') opts.freeze = true;
    else if (args[i] === '--baseline') opts.baseline = resolve(args[++i]);
    else if (args[i] === '--diff') opts.diff = args[++i] || 'HEAD~1';
  }
  return opts;
}

// ── 文件搜索 ─────────────────────────────────────────────

function findJavaFiles(dir, maxDepth = 10) {
  if (!existsSync(dir)) return [];
  const results = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'target' || entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'build') continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && maxDepth > 0) {
      results.push(...findJavaFiles(fullPath, maxDepth - 1));
    } else if (entry.name.endsWith('.java')) {
      results.push(fullPath);
    }
  }
  return results;
}

// ── Import 解析（替代 content.includes）─────────────────────

/**
 * 从 Java 文件中提取所有 import 语句
 * 返回完整的 import 路径列表
 */
function parseImports(content) {
  const imports = [];
  const regex = /^import\s+(?:static\s+)?([\w.]+(?:\.\*)?);/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

/**
 * 检查 import 列表是否包含指定包路径的引用
 * 比 content.includes 更精确：只匹配 import 语句，不匹配注释或字符串
 */
function hasImportFor(imports, packagePattern) {
  return imports.some(imp => imp.includes(packagePattern));
}

/**
 * 检查 import 列表是否匹配任一模式
 */
function hasImportMatchingAny(imports, patterns) {
  return patterns.some(p => hasImportFor(imports, p));
}

/**
 * 检查类级别注解（排除注释和字符串内的误匹配）
 */
function hasClassAnnotation(content, annotation) {
  // 排除行注释 // 和块注释 /* */ 内的内容
  const stripped = content
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const regex = new RegExp(`^\\s*${annotation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm');
  return regex.test(stripped);
}

/**
 * 检查是否有 throw new XxxException 语句
 */
function hasThrowStatement(content, exceptionClass) {
  const regex = new RegExp(`throw\\s+new\\s+${exceptionClass}\\s*\\(`);
  return regex.test(content);
}

// ── Git diff 文件列表获取 ──────────────────────────────────

function getDiffFiles(projectDir, diffRef) {
  try {
    const output = execSync(`git diff --name-only ${diffRef}`, {
      cwd: projectDir,
      encoding: 'utf-8',
    });
    return output.trim().split('\n').filter(f => f.endsWith('.java')).map(f => join(projectDir, f));
  } catch {
    console.log(`⚠️  无法获取 git diff ${diffRef}，将检查全部文件`);
    return null;
  }
}

// ── 层路径配置（支持不同架构模式的路径匹配）───────────────────

const LAYER_CONFIGS = {
  // 标准 DDD 4 层（mycmpricefactory, mycmbill, mycmcontractmanage, mycmcharge, mycmcreditacceptmng）
  'ddd-4layer': {
    domain: ['/domain/'],
    application: ['/application/'],
    infrastructure: ['/infrastructure/'],
    facade: ['/facade/'],
    facadeImpl: ['/application/facade/', '/application/'],
  },
  // 蚂蚁标准分层（mycmprodconf, mycmoperationmng, mycmbusinessar）
  'ant-standard': {
    domain: ['/core/model/', '/core/service/'],
    application: ['/biz/service/', '/biz/shared/'],
    infrastructure: ['/common/dal/', '/common/service/integration/'],
    facade: ['/common/service/facade/'],
    facadeImpl: ['/biz/service/impl/'],
  },
};

/**
 * 自动检测架构模式
 */
function detectArchMode(files, projectDir) {
  let ddd4Count = 0;
  let antCount = 0;
  for (const f of files) {
    const rel = relative(projectDir, f);
    if (rel.includes('/domain/')) ddd4Count++;
    if (rel.includes('/infrastructure/')) ddd4Count++;
    if (rel.includes('/core/model/')) antCount++;
    if (rel.includes('/common/dal/')) antCount++;
  }
  return ddd4Count >= antCount ? 'ddd-4layer' : 'ant-standard';
}

/**
 * 检查文件是否属于指定层
 */
function isInLayer(relPath, layerPatterns) {
  return layerPatterns.some(p => relPath.includes(p));
}

// ── 检查规则 ─────────────────────────────────────────────

function buildRules(layerConfig) {
  return [
    {
      id: 'ARCH-001',
      name: 'Domain 层不依赖 Infrastructure',
      severity: 'error',
      check(files, projectDir) {
        const issues = [];
        for (const f of files) {
          const rel = relative(projectDir, f);
          if (!isInLayer(rel, layerConfig.domain)) continue;
          const content = readFileSync(f, 'utf-8');
          const imports = parseImports(content);
          const infraPatterns = layerConfig.infrastructure;
          for (const pattern of infraPatterns) {
            if (hasImportFor(imports, pattern)) {
              const offending = imports.filter(imp => imp.includes(pattern));
              issues.push({ file: rel, detail: `domain 层引用了 infrastructure 包: ${offending.join(', ')}` });
              break;
            }
          }
        }
        return issues;
      },
    },
    {
      id: 'ARCH-002',
      name: 'Domain 层不使用 @Slf4j',
      severity: 'error',
      check(files, projectDir) {
        const issues = [];
        for (const f of files) {
          const rel = relative(projectDir, f);
          if (!isInLayer(rel, layerConfig.domain)) continue;
          const content = readFileSync(f, 'utf-8');
          if (hasClassAnnotation(content, '@Slf4j')) {
            issues.push({ file: rel, detail: 'domain 层使用了 @Slf4j' });
          }
        }
        return issues;
      },
    },
    {
      id: 'ARCH-003',
      name: 'Entity 使用 @Getter/@Setter 不使用 @Data',
      severity: 'warning',
      check(files, projectDir) {
        const issues = [];
        for (const f of files) {
          const rel = relative(projectDir, f);
          if (!isInLayer(rel, layerConfig.domain)) continue;
          if (rel.includes('Test')) continue;
          const content = readFileSync(f, 'utf-8');
          // 只有 @Data 但没有 @Getter 的才算违规
          if (hasClassAnnotation(content, '@Data') && !hasClassAnnotation(content, '@Getter')) {
            issues.push({ file: rel, detail: 'Entity 使用了 @Data 而非 @Getter/@Setter' });
          }
        }
        return issues;
      },
    },
    {
      id: 'ARCH-004',
      name: 'Facade 实现使用 @RpcProvider',
      severity: 'warning',
      check(files, projectDir) {
        const issues = [];
        for (const f of files) {
          const rel = relative(projectDir, f);
          if (!isInLayer(rel, layerConfig.facadeImpl)) continue;
          if (!rel.endsWith('Impl.java')) continue;
          const content = readFileSync(f, 'utf-8');
          const hasRpcProvider = hasClassAnnotation(content, '@RpcProvider') || hasClassAnnotation(content, '@SofaService');
          const hasService = hasClassAnnotation(content, '@Service');
          if (!hasRpcProvider && !hasService) {
            issues.push({ file: rel, detail: 'Facade 实现未使用 @RpcProvider 或 @SofaService' });
          }
        }
        return issues;
      },
    },
    {
      id: 'ARCH-005',
      name: '不使用 RuntimeException',
      severity: 'error',
      check(files, projectDir) {
        const issues = [];
        for (const f of files) {
          const rel = relative(projectDir, f);
          if (rel.includes('/target/')) continue;
          const content = readFileSync(f, 'utf-8');
          if (hasThrowStatement(content, 'RuntimeException')) {
            issues.push({ file: rel, detail: '使用了 RuntimeException（应使用项目业务异常类）' });
          }
        }
        return issues;
      },
    },
    {
      id: 'ARCH-006',
      name: '无循环依赖',
      severity: 'error',
      check(files, projectDir) {
        const issues = [];

        // 构建文件 -> 包的映射
        const fileToPkg = new Map();
        const pkgToFiles = new Map();
        for (const f of files) {
          const rel = relative(projectDir, f);
          // 提取模块内的包路径（如 domain.model.price -> domain）
          const parts = rel.split('/');
          // 找到 app/ 之后的第一个目录作为模块
          const appIdx = parts.indexOf('app');
          if (appIdx < 0 || appIdx + 1 >= parts.length) continue;
          const module = parts[appIdx + 1]; // e.g., domain, infrastructure, application, facade
          fileToPkg.set(f, module);
          if (!pkgToFiles.has(module)) pkgToFiles.set(module, []);
          pkgToFiles.get(module).push(f);
        }

        // 构建模块间依赖图
        const dependencies = new Map(); // module -> Set<module>
        for (const [f, module] of fileToPkg) {
          const content = readFileSync(f, 'utf-8');
          const imports = parseImports(content);
          const deps = new Set();
          for (const [, otherModule] of fileToPkg) {
            if (otherModule === module) continue;
            // 检查是否有 import 指向其他模块
            const otherFiles = pkgToFiles.get(otherModule) || [];
            // 简化：检查 import 路径中是否包含其他模块名
            if (imports.some(imp => imp.includes(`.${otherModule}.`) || imp.includes(`.${otherModule}.model.`) || imp.includes(`.${otherModule}.service.`))) {
              deps.add(otherModule);
            }
          }
          if (!dependencies.has(module)) dependencies.set(module, new Set());
          for (const d of deps) dependencies.get(module).add(d);
        }

        // DFS 检测循环
        const WHITE = 0, GRAY = 1, BLACK = 2;
        const color = new Map();
        for (const [mod] of dependencies) color.set(mod, WHITE);

        function dfs(node, path) {
          color.set(node, GRAY);
          path.push(node);
          const neighbors = dependencies.get(node) || new Set();
          for (const neighbor of neighbors) {
            if (!color.has(neighbor)) continue;
            if (color.get(neighbor) === GRAY) {
              // 找到循环
              const cycleStart = path.indexOf(neighbor);
              const cycle = path.slice(cycleStart).concat([neighbor]).join(' → ');
              issues.push({ file: '模块依赖', detail: `循环依赖: ${cycle}` });
            } else if (color.get(neighbor) === WHITE) {
              dfs(neighbor, path);
            }
          }
          path.pop();
          color.set(node, BLACK);
        }

        for (const [mod] of dependencies) {
          if (color.get(mod) === WHITE) {
            dfs(mod, []);
          }
        }

        return issues;
      },
    },
    {
      id: 'ARCH-007',
      name: 'Facade 层不直接调用 Mapper',
      severity: 'error',
      check(files, projectDir) {
        const issues = [];
        for (const f of files) {
          const rel = relative(projectDir, f);
          if (!isInLayer(rel, layerConfig.facade) && !isInLayer(rel, layerConfig.facadeImpl)) continue;
          const content = readFileSync(f, 'utf-8');
          const imports = parseImports(content);
          // 检查是否有直接 import Mapper 的
          const mapperImports = imports.filter(imp => /Mapper\b/.test(imp) && !imp.includes('MapMapper'));
          if (mapperImports.length > 0) {
            issues.push({ file: rel, detail: `Facade 直接引用了 Mapper: ${mapperImports.join(', ')}` });
          }
        }
        return issues;
      },
    },
  ];
}

// ── 主逻辑 ───────────────────────────────────────────────

function verify(projectDir, domain, opts = {}) {
  console.log(`\n## 架构规则校验\n`);
  console.log(`项目: ${projectDir}${domain ? `  域: ${domain}` : ''}\n`);

  const srcDir = join(projectDir, 'app');
  if (!existsSync(srcDir)) {
    console.log('⚠️  未找到 app/ 目录，跳过架构检查');
    return { errors: 0, warnings: 0 };
  }

  let files = findJavaFiles(srcDir);

  // 增量模式：只检查 git diff 中的文件
  if (opts.diff) {
    const diffFiles = getDiffFiles(projectDir, opts.diff);
    if (diffFiles) {
      const diffSet = new Set(diffFiles);
      files = files.filter(f => diffSet.has(f));
      console.log(`增量模式 (diff ${opts.diff}): 检查 ${files.length} 个变更文件\n`);
    }
  }

  // 自动检测架构模式
  const archMode = detectArchMode(files, projectDir);
  console.log(`架构模式: ${archMode}\n`);
  const layerConfig = LAYER_CONFIGS[archMode];
  const rules = buildRules(layerConfig);

  console.log(`扫描 ${files.length} 个 Java 文件...\n`);

  let errors = 0;
  let warnings = 0;
  const allIssues = [];

  for (const rule of rules) {
    const issues = rule.check(files, projectDir);
    const filteredIssues = domain ? issues.filter(i => i.file.includes(`/${domain}/`)) : issues;

    if (filteredIssues.length === 0) {
      console.log(`✅ [${rule.id}] ${rule.name}`);
    } else {
      for (const issue of filteredIssues) {
        console.log(`${rule.severity === 'error' ? '❌' : '⚠️'} [${rule.id}] ${issue.file}: ${issue.detail}`);
        allIssues.push({ ...issue, ruleId: rule.id, severity: rule.severity });
        if (rule.severity === 'error') errors++;
        else warnings++;
      }
    }
  }

  // 冻结模式：输出 baseline
  if (opts.freeze) {
    const baseline = allIssues.map(i => `${i.ruleId}::${i.file}::${i.detail}`);
    writeFileSync('.claude/arch-baseline.json', JSON.stringify(baseline, null, 2));
    console.log(`\n📦 已冻结 ${baseline.length} 条违规到 .claude/arch-baseline.json`);
  }

  // Baseline 模式：只报告新增违规
  if (opts.baseline && existsSync(opts.baseline)) {
    const known = new Set(JSON.parse(readFileSync(opts.baseline, 'utf-8')));
    const newIssues = allIssues.filter(i => !known.has(`${i.ruleId}::${i.file}::${i.detail}`));
    console.log(`\n📊 已知违规: ${known.size}, 新增违规: ${newIssues.length}`);
    if (newIssues.length > 0) {
      for (const issue of newIssues) {
        console.log(`🆕 [${issue.ruleId}] ${issue.file}: ${issue.detail}`);
      }
    }
  }

  console.log(`\n---`);
  console.log(`结果: ${errors} 错误, ${warnings} 警告\n`);

  return { errors, warnings };
}

// ── Entry ────────────────────────────────────────────────

const opts = parseArgs();
if (!opts.project) {
  console.error('用法: node verify-arch-rules.mjs --project <project-dir> [--domain <name>] [--freeze] [--baseline <file>] [--diff <ref>]');
  process.exit(1);
}

const { errors } = verify(opts.project, opts.domain, opts);
process.exit(errors > 0 ? 1 : 0);
