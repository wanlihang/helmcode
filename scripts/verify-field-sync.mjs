#!/usr/bin/env node

/**
 * HelmCode 字段同步校验
 *
 * 读取行为契约的 Schema 变更和领域模型章节，
 * 检查新增字段在 DDD 各层是否同步存在。
 *
 * 用法: node verify-field-sync.mjs --contract .claude/contracts/F001-xxx.md --project /path/to/project
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ── 参数解析 ─────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--contract') opts.contract = resolve(args[++i]);
    else if (args[i] === '--project') opts.project = resolve(args[++i]);
    else if (args[i] === '--verbose') opts.verbose = true;
  }
  return opts;
}

// ── 解析行为契约 ─────────────────────────────────────────

function parseContract(filePath) {
  const content = readFileSync(filePath, 'utf-8');

  // 提取 Feature ID
  const featureMatch = content.match(/Feature:\s*(F\d+-[\w-]+)/);
  const featureId = featureMatch ? featureMatch[1] : 'UNKNOWN';

  // 提取涉及的领域
  const domainMatch = content.match(/涉及领域:\s*(.+)/);
  const domains = domainMatch ? domainMatch[1].split(',').map(d => d.trim()) : [];

  // 提取 Schema 变更中的新增字段
  // 格式: | 新增 | field_name | TYPE | 说明 |
  const newFields = [];
  const schemaSection = content.match(/## Schema 变更[\s\S]*?(?=\n## [^#]|$)/)?.[0] || '';
  const fieldRegex = /\|\s*新增\s*\|\s*(\w+)\s*\|\s*([^|]+)\|\s*([^|]*)\|/g;
  let match;
  while ((match = fieldRegex.exec(schemaSection)) !== null) {
    newFields.push({
      name: match[1],
      type: match[2].trim(),
    });
  }

  // 提取领域模型中的实体名
  // 格式: ### 聚合根: EntityName 或 ### 实体: EntityName
  const entities = [];
  const entityRegex = /### (?:聚合根|实体):\s*(\w+)/g;
  while ((match = entityRegex.exec(content)) !== null) {
    entities.push(match[1]);
  }

  // 提取 API 契约中的 Command 和 VO
  const commands = [];
  const vos = [];
  const apiSection = content.match(/## API 契约[\s\S]*?(?=\n## [^#]|$)/)?.[0] || '';
  const cmdRegex = /(\w+Command)/g;
  const voRegex = /(\w+VO)/g;
  while ((match = cmdRegex.exec(apiSection)) !== null) {
    if (!commands.includes(match[1])) commands.push(match[1]);
  }
  while ((match = voRegex.exec(apiSection)) !== null) {
    if (!vos.includes(match[1])) vos.push(match[1]);
  }

  return { featureId, domains, newFields, entities, commands, vos, content };
}

// ── Java 字段检查 ────────────────────────────────────────

/**
 * 在 Java 文件中检查字段是否存在
 */
function checkJavaField(filePath, fieldName) {
  if (!existsSync(filePath)) return { exists: false, reason: 'file not found' };

  const content = readFileSync(filePath, 'utf-8');
  // 匹配: private String remark; 或 private String remark = xxx;
  const fieldPattern = new RegExp(`private\\s+\\w+\\s+${fieldName}\\b`);
  // 匹配 getter: getRemark() 或 isRemark()
  const getterPattern = new RegExp(`(get|is)${fieldName.charAt(0).toUpperCase()}${fieldName.slice(1)}\\s*\\(`);

  return {
    exists: fieldPattern.test(content) || getterPattern.test(content),
    filePath,
  };
}

/**
 * 在 Mapper XML 中检查字段是否存在
 */
function checkXmlField(filePath, fieldName, columnName) {
  if (!existsSync(filePath)) return { exists: false, reason: 'file not found' };

  const content = readFileSync(filePath, 'utf-8');
  const hasProperty = content.includes(`property="${fieldName}"`) || content.includes(`#{${fieldName}}`) || content.includes(`#{item.${fieldName}}`);
  const hasColumn = content.includes(`column="${columnName}"`) || content.includes(columnName);

  return {
    exists: hasProperty && hasColumn,
    filePath,
    details: { hasProperty, hasColumn },
  };
}

// ── camelCase to snake_case ──────────────────────────────

function toSnakeCase(str) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

// ── 查找 Java 文件 ──────────────────────────────────────

function findJavaFile(projectDir, className) {
  const targets = [
    // Search in source directories
    ...findFilesDeep(join(projectDir, 'app'), `${className}.java`),
  ];
  return targets.length > 0 ? targets[0] : null;
}

function findXmlFile(projectDir, entityName) {
  const pattern = `${entityName}*.xml`;
  const targets = findFilesDeep(join(projectDir, 'app'), pattern)
    .filter(f => f.includes('mapper') && !f.includes('target'));
  return targets.length > 0 ? targets[0] : null;
}

function findFilesDeep(dir, pattern) {
  if (!existsSync(dir)) return [];
  const results = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.name === 'target' || entry.name === '.git' || entry.name === 'node_modules') continue;
    if (entry.isDirectory()) {
      results.push(...findFilesDeep(fullPath, pattern));
    } else if (entry.name === pattern || (pattern.includes('*') && matchGlob(entry.name, pattern))) {
      results.push(fullPath);
    }
  }
  return results;
}

function matchGlob(name, pattern) {
  const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
  return regex.test(name);
}

// ── 主校验逻辑 ───────────────────────────────────────────

function verify(contractPath, projectDir) {
  const contract = parseContract(contractPath);

  console.log(`\n## 字段同步校验 - ${contract.featureId}\n`);

  if (contract.newFields.length === 0) {
    console.log('✅ 行为契约中无 Schema 变更（无新增字段），跳过字段同步检查');
    return { errors: 0, warnings: 0 };
  }

  console.log(`检查 ${contract.newFields.length} 个新增字段在 DDD 各层的同步情况:\n`);

  let errors = 0;
  let warnings = 0;

  for (const field of contract.newFields) {
    const columnName = toSnakeCase(field.name);
    console.log(`### 字段: ${field.name} (${field.type})\n`);

    for (const entityName of contract.entities) {
      // 1. Entity
      const entityFile = findJavaFile(projectDir, entityName);
      if (entityFile) {
        const result = checkJavaField(entityFile, field.name);
        report('Entity', entityFile, result);
      }

      // 2. DO
      const doFile = findJavaFile(projectDir, `${entityName}DO`);
      if (doFile) {
        const result = checkJavaField(doFile, field.name);
        report('DO', doFile, result);
      }

      // 3. VO
      for (const voName of contract.vos) {
        const voFile = findJavaFile(projectDir, voName);
        if (voFile) {
          const result = checkJavaField(voFile, field.name);
          report('VO', voFile, result);
        }
      }

      // 4. Command
      for (const cmdName of contract.commands) {
        const cmdFile = findJavaFile(projectDir, cmdName);
        if (cmdFile) {
          const result = checkJavaField(cmdFile, field.name);
          report('Command', cmdFile, result);
        }
      }

      // 5. Mapper XML
      const xmlFile = findXmlFile(projectDir, entityName);
      if (xmlFile) {
        const result = checkXmlField(xmlFile, field.name, columnName);
        report('Mapper XML', xmlFile, result);
      }

      // 6. Convert (MapStruct) - check if field is mapped
      const convertFile = findJavaFile(projectDir, `${entityName}Convert`);
      if (convertFile) {
        const content = readFileSync(convertFile, 'utf-8');
        // MapStruct auto-maps same-name fields, so just check if the file exists
        // and doesn't have an explicit ignore for this field
        const ignored = content.includes(`target = "${field.name}"`) && content.includes('ignore = true');
        if (ignored) {
          console.log(`  ⚠️  Convert: ${convertFile} — field "${field.name}" is explicitly ignored`);
          warnings++;
        } else {
          console.log(`  ✅ Convert: ${convertFile} — auto-mapped (same name)`);
        }
      }
    }
    console.log('');
  }

  console.log(`---`);
  console.log(`结果: ${errors} 错误, ${warnings} 警告\n`);

  return { errors, warnings };
}

function report(layer, filePath, result) {
  if (result.exists) {
    console.log(`  ✅ ${layer}: ${filePath}`);
  } else {
    console.log(`  ❌ ${layer}: ${filePath} — 字段未找到${result.reason ? ` (${result.reason})` : ''}`);
    errors++;
  }
}

// ── Entry ────────────────────────────────────────────────

const opts = parseArgs();
if (!opts.contract || !opts.project) {
  console.error('用法: node verify-field-sync.mjs --contract <contract.md> --project <project-dir>');
  process.exit(1);
}

const { errors } = verify(opts.contract, opts.project);
process.exit(errors > 0 ? 1 : 0);
