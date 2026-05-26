#!/usr/bin/env node

import { cpSync, mkdirSync, existsSync, readFileSync, writeFileSync, rmSync, symlinkSync, lstatSync, readdirSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const HELMCODE_HOME = __dirname;

// ── Helpers ──────────────────────────────────────────────

function log(emoji, msg) {
  console.log(`  ${emoji} ${msg}`);
}

function header(title) {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  ${title}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

function phaseHeader(n, title) {
  console.log('');
  console.log(`📦 Phase ${n}: ${title}`);
  console.log('─────────────────────────────────────────');
}

// ── Preset definitions ──────────────────────────────────

const PRESETS = {
  'java-ddd': {
    skills: ['dev-flow', 'clarify', 'implement', 'verify', 'analyze'],
    standardsDir: 'java-ddd',
  },
  minimal: {
    skills: ['dev-flow', 'clarify'],
    standardsDir: null,
  },
};

// ── Detect preset ────────────────────────────────────────

function detectPreset(projectDir) {
  if (existsSync(join(projectDir, 'pom.xml')) || existsSync(join(projectDir, 'build.gradle'))) {
    return 'java-ddd';
  }
  return 'minimal';
}

// ── Install Skills ───────────────────────────────────────

function installSkills(projectDir, skills) {
  for (const skill of skills) {
    const source = join(HELMCODE_HOME, 'core', skill);
    const target = join(projectDir, '.claude', 'skills', skill);

    if (!existsSync(source)) {
      log('⚠', `${skill} source not found, skipping`);
      continue;
    }

    mkdirSync(target, { recursive: true });

    // Copy SKILL.md
    cpSync(join(source, 'SKILL.md'), join(target, 'SKILL.md'));

    // Copy references/ if exists
    const refsDir = join(source, 'references');
    if (existsSync(refsDir)) {
      cpSync(refsDir, join(target, 'references'), { recursive: true });
      log('✓', `${skill} (+ references/)`);
    } else {
      log('✓', skill);
    }
  }
}

// ── Install Standards ────────────────────────────────────

function installStandards(projectDir, preset) {
  const presetConfig = PRESETS[preset];
  if (!presetConfig.standardsDir) {
    log('ℹ', `Preset '${preset}' has no standards`);
    return 0;
  }

  const source = join(HELMCODE_HOME, 'standards', presetConfig.standardsDir);
  const target = join(projectDir, '.claude', 'standards');

  if (!existsSync(source)) {
    log('⚠', `Standards source '${presetConfig.standardsDir}' not found`);
    return 0;
  }

  mkdirSync(target, { recursive: true });

  let count = 0;

  // Copy *.md files
  for (const file of readdirSync(source)) {
    if (file.endsWith('.md')) {
      cpSync(join(source, file), join(target, file));
      log('✓', `standards/${file}`);
      count++;
    }
  }

  // Copy patterns/ directory
  const patternsSource = join(source, 'patterns');
  if (existsSync(patternsSource)) {
    const patternsTarget = join(target, 'patterns');
    mkdirSync(patternsTarget, { recursive: true });
    for (const file of readdirSync(patternsSource)) {
      if (file.endsWith('.md')) {
        cpSync(join(patternsSource, file), join(patternsTarget, file));
        log('✓', `standards/patterns/${file}`);
        count++;
      }
    }
  }

  return count;
}

// ── Create project directories ───────────────────────────

function createProjectDirs(projectDir) {
  const dirs = [
    '.claude/contracts',
    '.claude/briefs',
    '.claude/judgment-logs',
  ];

  for (const dir of dirs) {
    const fullPath = join(projectDir, dir);
    if (existsSync(fullPath)) {
      log('✓', `${dir} (exists)`);
    } else {
      mkdirSync(fullPath, { recursive: true });
      log('✓', `${dir} (created)`);
    }
  }

  // Initialize registry.md
  const registry = join(projectDir, '.claude', 'contracts', 'registry.md');
  if (!existsSync(registry)) {
    writeFileSync(registry, `# Feature 注册表

| Feature ID | 名称 | 状态 | 行为契约 | 判断日志 | 创建时间 | 更新时间 |
|------------|------|------|---------|---------|---------|---------|
`);
    log('✓', 'registry.md (created)');
  } else {
    log('✓', 'registry.md (exists)');
  }

  // Install verify scripts
  const scriptsSource = join(HELMCODE_HOME, 'scripts');
  const scriptsTarget = join(projectDir, '.claude', 'scripts');
  if (existsSync(scriptsSource)) {
    mkdirSync(scriptsTarget, { recursive: true });
    for (const file of readdirSync(scriptsSource)) {
      if (file.endsWith('.mjs')) {
        cpSync(join(scriptsSource, file), join(scriptsTarget, file));
      }
    }
    log('✓', '.claude/scripts/ (verify scripts installed)');
  }

  // Install commands
  const commandsSource = join(HELMCODE_HOME, 'commands');
  const commandsTarget = join(projectDir, '.claude', 'commands');
  if (existsSync(commandsSource)) {
    mkdirSync(commandsTarget, { recursive: true });
    for (const file of readdirSync(commandsSource)) {
      if (file.endsWith('.md')) {
        cpSync(join(commandsSource, file), join(commandsTarget, file));
      }
    }
    log('✓', '.claude/commands/ (checkpoint, state)');
  }
}

// ── Configure CLAUDE.md ──────────────────────────────────

function configureClaudeMd(projectDir, preset) {
  const claudeMd = join(projectDir, 'CLAUDE.md');

  const helmcodeSection = `
# HelmCode 工作流

主流程: /dev-flow (clarify → implement → verify)
单独使用: /clarify, /implement, /verify, /analyze

## 编码标准
- 编码标准: .claude/standards/standards.md
- 项目约定: .claude/standards/project-conventions.md（覆盖默认值）
- 审查规则: .claude/standards/review-rules.md
- 测试标准: .claude/standards/test-standards.md
- 代码模式: .claude/standards/patterns/

## 目录约定
- 行为契约: .claude/contracts/
- 项目简报: .claude/briefs/ (不参与代码生成)
- 判断日志: .claude/judgment-logs/
- Feature 注册: .claude/contracts/registry.md
`;

  if (existsSync(claudeMd)) {
    const content = readFileSync(claudeMd, 'utf-8');
    if (content.includes('HelmCode')) {
      log('⚠', 'CLAUDE.md already contains HelmCode config, skipping');
    } else {
      writeFileSync(claudeMd, content + '\n' + helmcodeSection);
      log('✓', 'CLAUDE.md (appended HelmCode config)');
    }
  } else {
    // Detect tech stack
    let techStack = 'unknown';
    if (existsSync(join(projectDir, 'pom.xml'))) {
      techStack = 'Java/Spring Boot DDD';
    } else if (existsSync(join(projectDir, 'package.json'))) {
      techStack = 'Node.js';
    }

    writeFileSync(claudeMd, `# 项目约束

## 技术栈
${techStack}
${helmcodeSection}`);
    log('✓', 'CLAUDE.md (created)');
  }
}

// ── Install global loader ────────────────────────────────

function installGlobalLoader() {
  const globalSkillsDir = join(process.env.HOME, '.claude', 'skills');
  const loaderTarget = join(globalSkillsDir, 'helmcode-loader');
  const loaderSource = join(HELMCODE_HOME, 'loader');

  mkdirSync(globalSkillsDir, { recursive: true });

  // Remove existing symlink or directory
  try {
    const stat = lstatSync(loaderTarget);
    if (stat.isSymbolicLink() || stat.isDirectory()) {
      rmSync(loaderTarget, { recursive: true, force: true });
    }
  } catch {
    // doesn't exist, that's fine
  }

  symlinkSync(loaderSource, loaderTarget);
  log('✓', 'Global loader: ~/.claude/skills/helmcode-loader');
}

// ── Project Scanner ────────────────────────────────────────

function findFilesDeep(dir, pattern, maxDepth = 20) {
  if (!existsSync(dir) || maxDepth <= 0) return [];
  const results = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'target' || entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'build') continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFilesDeep(fullPath, pattern, maxDepth - 1));
    } else if (entry.name.endsWith(pattern)) {
      results.push(fullPath);
    }
  }
  return results;
}

function scanDOAnnotations(projectDir) {
  const doFiles = findFilesDeep(join(projectDir, 'app'), 'DO.java');
  if (doFiles.length === 0) return { detected: false, reason: 'No DO files found' };

  const counts = { '@Data': 0, '@Getter': 0, 'plain': 0, '@TableName': 0 };
  const examples = {};

  for (const file of doFiles) {
    const content = readFileSync(file, 'utf-8');
    if (content.includes('@Data')) {
      counts['@Data']++;
      examples['@Data'] = examples['@Data'] || file;
    } else if (content.includes('@Getter')) {
      counts['@Getter']++;
      examples['@Getter'] = examples['@Getter'] || file;
    } else {
      counts['plain']++;
      examples['plain'] = examples['plain'] || file;
    }
    if (content.includes('@TableName')) counts['@TableName']++;
  }

  const total = doFiles.length;
  const dominant = Object.entries(counts).filter(([k]) => k !== '@TableName').sort((a, b) => b[1] - a[1])[0];
  const consistency = Math.round((dominant[1] / total) * 100);

  let style;
  if (dominant[0] === '@Data') {
    style = counts['@TableName'] > total * 0.5 ? '@Data + @TableName (MyBatis-Plus)' : '@Data';
  } else if (dominant[0] === '@Getter') {
    style = '@Getter + @Setter';
  } else {
    style = 'plain (no Lombok)';
  }

  return {
    detected: true,
    total,
    style,
    consistency,
    counts,
    example: examples[dominant[0]],
  };
}

function scanExceptionPattern(projectDir) {
  const throwMatches = { MycmBizException: 0, BizException: 0, OperationException: 0, RuntimeException: 0 };
  const errorCodeEnums = new Set();
  const javaFiles = findFilesDeep(join(projectDir, 'app'), '.java');

  for (const file of javaFiles) {
    const content = readFileSync(file, 'utf-8');
    for (const ex of Object.keys(throwMatches)) {
      const regex = new RegExp(`throw new ${ex}\\b`, 'g');
      const matches = content.match(regex);
      if (matches) throwMatches[ex] += matches.length;
    }
    const enumMatch = content.match(/throw new \w+\((\w+)\b/g);
    if (enumMatch) {
      for (const m of enumMatch) {
        const codeMatch = m.match(/throw new \w+\((\w+)/);
        if (codeMatch && !['new', 'String', 'Long', 'Integer'].includes(codeMatch[1])) {
          errorCodeEnums.add(codeMatch[1]);
        }
      }
    }
  }

  const total = Object.values(throwMatches).reduce((a, b) => a + b, 0);
  if (total === 0) return { detected: false };

  const dominant = Object.entries(throwMatches).filter(([k]) => k !== 'RuntimeException').sort((a, b) => b[1] - a[1])[0];
  const enumName = [...errorCodeEnums][0] || 'ErrorCodeEnum';

  return {
    detected: true,
    total,
    exceptionClass: dominant[0],
    exceptionCount: dominant[1],
    errorCodeEnum: enumName,
    consistency: Math.round((dominant[1] / total) * 100),
    allExceptions: throwMatches,
  };
}

function scanFacadePattern(projectDir) {
  const facadeFiles = findFilesDeep(join(projectDir, 'app'), 'FacadeImpl.java');
  if (facadeFiles.length === 0) return { detected: false };

  const annotations = { '@RpcProvider': 0, '@SofaService': 0, '@Service': 0 };
  const resultBuild = { bizTemplate: 0, manual: 0 };

  for (const file of facadeFiles) {
    const content = readFileSync(file, 'utf-8');
    if (content.includes('@RpcProvider')) annotations['@RpcProvider']++;
    if (content.includes('@SofaService')) annotations['@SofaService']++;
    if (content.match(/@Service\b/) && !content.includes('@RpcProvider') && !content.includes('@SofaService')) annotations['@Service']++;

    if (content.includes('bizTemplate.doProcess') || content.includes('BizTemplate')) {
      resultBuild.bizTemplate++;
    } else if (content.includes('result.setSuccess') || content.includes('Result<')) {
      resultBuild.manual++;
    }
  }

  const rpcAnnotation = Object.entries(annotations).sort((a, b) => b[1] - a[1])[0];
  const resultStyle = resultBuild.bizTemplate >= resultBuild.manual ? 'BizTemplate' : 'manual';

  return {
    detected: true,
    total: facadeFiles.length,
    rpcAnnotation: rpcAnnotation[0],
    rpcAnnotationCount: rpcAnnotation[1],
    rpcConsistency: Math.round((rpcAnnotation[1] / facadeFiles.length) * 100),
    resultStyle,
    resultBuild,
  };
}

function scanMapStruct(projectDir) {
  const convertFiles = findFilesDeep(join(projectDir, 'app'), 'Convert.java')
    .concat(findFilesDeep(join(projectDir, 'app'), 'Converter.java'));

  const mapstructFiles = [];
  const handWritten = [];
  const instanceNames = {};

  for (const file of convertFiles) {
    const content = readFileSync(file, 'utf-8');
    if (content.includes('@Mapper') && content.includes('Mappers.getMapper')) {
      mapstructFiles.push(file);
      const fieldMatch = content.match(/(\w+)\s*=\s*Mappers\.getMapper/);
      if (fieldMatch) {
        const fieldName = fieldMatch[1];
        instanceNames[fieldName] = (instanceNames[fieldName] || 0) + 1;
      }
    } else if (!content.includes('@Mapper')) {
      handWritten.push(file);
    }
  }

  if (convertFiles.length === 0) return { detected: true, usage: 'none', total: 0 };

  const dominantField = Object.entries(instanceNames).sort((a, b) => b[1] - a[1])[0];

  return {
    detected: true,
    usage: mapstructFiles.length > 0 ? 'mapstruct' : 'handwritten',
    total: convertFiles.length,
    mapstructCount: mapstructFiles.length,
    handWrittenCount: handWritten.length,
    instanceField: dominantField ? dominantField[0] : null,
    instanceNames,
  };
}

function scanPersistence(projectDir) {
  const xmlMappers = findFilesDeep(join(projectDir, 'app'), 'Mapper.xml');
  const mybatisPlusUsage = findFilesDeep(join(projectDir, 'app'), 'DO.java')
    .filter(f => readFileSync(f, 'utf-8').includes('@TableName')).length;
  const baseMapperUsage = findFilesDeep(join(projectDir, 'app'), 'Mapper.java')
    .filter(f => readFileSync(f, 'utf-8').includes('BaseMapper')).length;

  let framework;
  if (mybatisPlusUsage > 3 || baseMapperUsage > 0) {
    framework = 'mybatis-plus';
  } else if (xmlMappers.length > 0) {
    framework = 'mybatis-xml';
  } else {
    framework = 'unknown';
  }

  return { detected: true, framework, xmlMapperCount: xmlMappers.length, mybatisPlusCount: mybatisPlusUsage };
}

function scanIntegrationPattern(projectDir) {
  const integrationDir = findFilesDeep(join(projectDir, 'app'), '.java')
    .filter(f => f.includes('integration') || f.includes('thirdparty') || f.includes('adapter'));

  const hasSalLog = integrationDir.filter(f => readFileSync(f, 'utf-8').includes('@SalLog')).length;
  const hasRpcConsumer = integrationDir.filter(f => readFileSync(f, 'utf-8').includes('@RpcConsumer')).length;
  const hasPreconditions = integrationDir.filter(f => readFileSync(f, 'utf-8').includes('Preconditions')).length;
  const clientFiles = integrationDir.filter(f => f.includes('Client') || f.includes('Adapter') || f.includes('Gateway'));

  return {
    detected: clientFiles.length > 0,
    totalClients: clientFiles.length,
    hasSalLog: hasSalLog > 0,
    hasRpcConsumer: hasRpcConsumer > 0,
    hasPreconditions: hasPreconditions > 0,
  };
}

function generateProjectConventions(projectDir) {
  const doResult = scanDOAnnotations(projectDir);
  const exResult = scanExceptionPattern(projectDir);
  const facadeResult = scanFacadePattern(projectDir);
  const convertResult = scanMapStruct(projectDir);
  const persistResult = scanPersistence(projectDir);
  const integResult = scanIntegrationPattern(projectDir);

  const confidence = (pct) => pct >= 90 ? '✅' : pct >= 60 ? '⚠️' : '❌';

  let md = `# 项目约定 — 自动检测

> 由 helmcode install 自动扫描项目代码生成。
> AI 生成代码时以本文件为准。

`;

  if (doResult.detected) {
    md += `## DO 注解风格\n\n`;
    md += `- **检测结果**: ${doResult.style}\n`;
    md += `- **一致性**: ${confidence(doResult.consistency)} ${doResult.consistency}% (${doResult.total} 个 DO 文件)\n`;
    md += `- **规则**: DO 不继承基类，审计字段 (id, gmtCreate, gmtModified, creator, modifier) 内联声明\n`;
    md += `- **示例**: ${doResult.example || 'N/A'}\n\n`;
  }

  if (exResult.detected) {
    md += `## 异常类与错误码\n\n`;
    md += `- **异常类**: ${exResult.exceptionClass}\n`;
    md += `- **错误码枚举**: ${exResult.errorCodeEnum}\n`;
    md += `- **构造模式**: throw new ${exResult.exceptionClass}(${exResult.errorCodeEnum}.XXX, "message")\n`;
    md += `- **一致性**: ${confidence(exResult.consistency)} ${exResult.consistency}%\n\n`;
  }

  if (facadeResult.detected) {
    md += `## Facade 模式\n\n`;
    md += `- **RPC 发布注解**: ${facadeResult.rpcAnnotation}\n`;
    md += `- **注解一致性**: ${confidence(facadeResult.rpcConsistency)} ${facadeResult.rpcConsistency}%\n`;
    md += `- **Result 构建**: ${facadeResult.resultStyle}\n`;
    md += `- **拦截注解**: @FacadeIntercept(loggerName = ...)\n\n`;
  }

  if (convertResult.detected && convertResult.usage !== 'none') {
    md += `## Convert 模式\n\n`;
    md += `- **使用方式**: ${convertResult.usage === 'mapstruct' ? 'MapStruct' : '手写转换'}\n`;
    if (convertResult.usage === 'mapstruct' && convertResult.instanceField) {
      md += `- **单例字段名**: ${convertResult.instanceField}\n`;
      md += `- **调用方式**: XxxConvert.${convertResult.instanceField}.toEntity(doObj)\n`;
      md += `- **注解**: @Mapper（无 componentModel）\n`;
    }
    md += `- **MapStruct 文件数**: ${convertResult.mapstructCount}\n`;
    md += `- **手写文件数**: ${convertResult.handWrittenCount}\n\n`;
  }

  if (persistResult.detected) {
    md += `## 持久层框架\n\n`;
    md += `- **框架**: ${persistResult.framework}\n`;
    if (persistResult.framework === 'mybatis-xml') {
      md += `- **说明**: 使用 MyBatis XML Mapper\n`;
    } else if (persistResult.framework === 'mybatis-plus') {
      md += `- **说明**: 使用 MyBatis-Plus，DO 使用 @TableName 注解，Mapper 继承 BaseMapper\n`;
    }
    md += `\n`;
  }

  if (integResult.detected) {
    md += `## 集成客户端\n\n`;
    md += `- **客户端文件数**: ${integResult.totalClients}\n`;
    md += `- **SAL 日志**: ${integResult.hasSalLog ? '✅ 使用 @SalLog' : '❌ 未检测到'}\n`;
    md += `- **RPC 注入**: ${integResult.hasRpcConsumer ? '✅ 使用 @RpcConsumer' : '未检测到'}\n`;
    md += `- **结果校验**: ${integResult.hasPreconditions ? '✅ 使用 Preconditions' : '未检测到'}\n\n`;
  }

  md += `---\n`;
  md += `*此文件由 helmcode install 自动生成，可根据需要手动修改。*\n`;

  return md;
}

// ── Main install ─────────────────────────────────────────

export async function install(options) {
  const { preset: presetArg, project: projectArg, force, globalLoader } = options;

  const projectDir = resolve(projectArg || process.cwd());
  const preset = presetArg || detectPreset(projectDir);

  // Validate HelmCode source
  if (!existsSync(join(HELMCODE_HOME, 'core'))) {
    console.error('❌ HelmCode core files not found at: ' + HELMCODE_HOME);
    process.exit(1);
  }

  if (!PRESETS[preset]) {
    console.error(`❌ Unknown preset: ${preset}. Available: ${Object.keys(PRESETS).join(', ')}`);
    process.exit(1);
  }

  // Confirmation
  if (!force) {
    const presetConfig = PRESETS[preset];
    header('HelmCode Install');
    console.log('');
    console.log(`  Project: ${projectDir}`);
    console.log(`  Preset:  ${preset}`);
    console.log(`  Skills:  ${presetConfig.skills.join(', ')}`);
    if (presetConfig.standardsDir) {
      console.log('  Standards: standards.md, patterns/');
    }
    console.log('');
    console.log('  Run with --force to skip confirmation');
    console.log('');

    // Simple prompt (no readline dependency needed for --force mode)
    const { createInterface } = await import('node:readline');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(r => rl.question('  Confirm install? [y/N] ', r));
    rl.close();
    if (!answer.match(/^[yY]/)) {
      console.log('  Cancelled');
      return;
    }
  }

  header('HelmCode Installing...');

  const presetConfig = PRESETS[preset];

  // Phase 1: Install Skills
  phaseHeader(1, 'Install Skills');
  installSkills(projectDir, presetConfig.skills);

  // Phase 2: Install Standards
  phaseHeader(2, `Install Standards (${preset})`);
  const standardsCount = await installStandards(projectDir, preset);

  // Phase 3: Scan project conventions
  if (preset === 'java-ddd') {
    phaseHeader(3, 'Scan Project Conventions');
    const conventionsMd = generateProjectConventions(projectDir);
    const conventionsPath = join(projectDir, '.claude', 'standards', 'project-conventions.md');
    mkdirSync(dirname(conventionsPath), { recursive: true });
    writeFileSync(conventionsPath, conventionsMd);
    log('✓', 'project-conventions.md generated');

    // Print summary
    console.log('');
    log('ℹ', 'Convention scan results:');
    const doResult = scanDOAnnotations(projectDir);
    const facadeResult = scanFacadePattern(projectDir);
    const convertResult = scanMapStruct(projectDir);
    if (doResult.detected) log(' ', `DO: ${doResult.style} (${doResult.consistency}%)`);
    if (facadeResult.detected) log(' ', `Facade: ${facadeResult.rpcAnnotation}, Result: ${facadeResult.resultStyle}`);
    if (convertResult.detected) log(' ', `Convert: ${convertResult.usage === 'mapstruct' ? 'MapStruct ' + convertResult.instanceField : convertResult.usage}`);
  }

  // Phase 4: Create project directories
  phaseHeader(4, 'Create Project Directories');
  createProjectDirs(projectDir);

  // Phase 5: Configure CLAUDE.md
  phaseHeader(5, 'Configure CLAUDE.md');
  configureClaudeMd(projectDir, preset);

  // Phase 6: Global loader (optional)
  if (globalLoader) {
    phaseHeader(6, 'Install Global Loader');
    installGlobalLoader();
  }

  // Summary
  header('HelmCode Installed!');
  console.log('');
  console.log(`  Skills:    ${presetConfig.skills.length} installed`);
  console.log(`  Standards: ${standardsCount} files`);
  console.log('');
  console.log('  Usage:');
  console.log('    /dev-flow    — AI coding workflow (clarify → implement → verify)');
  console.log('    /clarify     — Break down requirements into behavior contract');
  console.log('    /implement   — Generate code + judgment log');
  console.log('    /verify      — Validate code + review judgments');
  console.log('    /analyze     — Architecture compliance check');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// ── Status ───────────────────────────────────────────────

export async function status(options) {
  const projectDir = resolve(options.project || process.cwd());
  const claudeDir = join(projectDir, '.claude');
  const skillsDir = join(claudeDir, 'skills');
  const standardsDir = join(claudeDir, 'standards');

  header('HelmCode Status');
  console.log(`  Project: ${projectDir}`);
  console.log('');

  if (!existsSync(claudeDir)) {
    log('⚠', '.claude/ directory not found');
    log('ℹ', 'Run "helmcode install" to install');
    return;
  }

  // Check skills
  if (existsSync(skillsDir)) {
    const skills = readdirSync(skillsDir).filter(d =>
      existsSync(join(skillsDir, d, 'SKILL.md'))
    );
    log('✓', `Skills: ${skills.join(', ')}`);
  } else {
    log('⚠', 'No skills installed');
  }

  // Check standards
  if (existsSync(standardsDir)) {
    const files = readdirSync(standardsDir).filter(f => f.endsWith('.md'));
    const hasPatterns = existsSync(join(standardsDir, 'patterns'));
    log('✓', `Standards: ${files.join(', ')}${hasPatterns ? ' + patterns/' : ''}`);
  } else {
    log('⚠', 'No standards installed');
  }

  // Check directories
  for (const dir of ['contracts', 'briefs', 'judgment-logs']) {
    if (existsSync(join(claudeDir, dir))) {
      log('✓', `.claude/${dir}/`);
    } else {
      log('⚠', `.claude/${dir}/ not found`);
    }
  }

  // Check CLAUDE.md
  const claudeMd = join(projectDir, 'CLAUDE.md');
  if (existsSync(claudeMd)) {
    const content = readFileSync(claudeMd, 'utf-8');
    if (content.includes('HelmCode')) {
      log('✓', 'CLAUDE.md has HelmCode config');
    } else {
      log('⚠', 'CLAUDE.md missing HelmCode config');
    }
  } else {
    log('⚠', 'CLAUDE.md not found');
  }

  // Check global loader
  const globalLoader = join(process.env.HOME, '.claude', 'skills', 'helmcode-loader');
  if (existsSync(globalLoader)) {
    log('✓', 'Global helmcode-loader installed');
  } else {
    log('ℹ', 'Global helmcode-loader not installed (optional)');
  }
}

// ── List ─────────────────────────────────────────────────

export async function list() {
  header('HelmCode Available Presets');
  console.log('');
  for (const [name, config] of Object.entries(PRESETS)) {
    console.log(`  ${name}:`);
    console.log(`    Skills:    ${config.skills.join(', ')}`);
    console.log(`    Standards: ${config.standardsDir || 'none'}`);
    console.log('');
  }
}

// ── Update ───────────────────────────────────────────────

export async function update(options) {
  const projectDir = resolve(options.project || process.cwd());
  const preset = options.preset || detectPreset(projectDir);

  log('ℹ', `Updating HelmCode (preset: ${preset}) in ${projectDir}`);

  // Update is just reinstall with --force
  await install({ preset, project: projectDir, force: true, globalLoader: options.globalLoader });
}
