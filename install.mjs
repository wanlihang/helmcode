#!/usr/bin/env node

import { cpSync, mkdirSync, existsSync, readFileSync, writeFileSync, rmSync, symlinkSync, lstatSync, readdirSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// HelmCode 源根目录(不可变默认 = 本包安装位置)。
// programmatic 消费方经 install({helmcodeHome}) / query({helmcodeHome}) 透传覆盖,
// 不靠模块级可变状态(BR-003 无副作用方案:const + 参数默认值)。
const HELMCODE_HOME = __dirname;

// ── Version ──────────────────────────────────────────────

function getHelmcodeVersion(helmcodeHome = HELMCODE_HOME) {
  try {
    const pkg = JSON.parse(readFileSync(join(helmcodeHome, 'package.json'), 'utf-8'));
    return pkg.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

// ── Install method detection ─────────────────────────────

function detectInstallMethod(helmcodeHome = HELMCODE_HOME) {
  // Check if installed via npm (global or local)
  try {
    const npmGlobalPrefix = execSync('npm config get prefix 2>/dev/null', { encoding: 'utf-8' }).trim();
    const npmGlobalBin = join(npmGlobalPrefix, 'bin', 'helmcode');
    const npmGlobalBinWin = join(npmGlobalPrefix, 'helmcode.cmd');
    if (existsSync(npmGlobalBin) || existsSync(npmGlobalBinWin)) {
      // Check if the linked path matches our HELMCODE_HOME
      try {
        const realPath = execSync(`readlink -f "${npmGlobalBin}" 2>/dev/null || echo ""`, { encoding: 'utf-8' }).trim();
        if (realPath && realPath.includes('helmcode')) return 'npm-global';
      } catch { /* fallthrough */ }
      return 'npm-global';
    }
  } catch { /* npm not available */ }

  // Check if installed via npm locally (devDependency)
  try {
    const localPkg = join(helmcodeHome, 'node_modules', 'helmcode');
    if (existsSync(localPkg)) return 'npm-local';
  } catch { /* fallthrough */ }

  // Check if inside a git repo
  try {
    const gitDir = join(helmcodeHome, '.git');
    if (existsSync(gitDir)) return 'git-clone';
  } catch { /* fallthrough */ }

  // Check if run via npx
  if (process.env.npm_lifecycle_event === 'npx' || (process.argv[1] && process.argv[1].includes('_npx'))) {
    return 'npx';
  }

  return 'unknown';
}

// ── Semver comparison ────────────────────────────────────

export function compareSemver(a, b) {
  const parse = (v) => {
    const cleaned = (v || '0.0.0').replace(/^v/, '').split('-')[0];
    return cleaned.split('.').map(Number);
  };
  const pa = parse(a), pb = parse(b);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

// ── Version stamp ────────────────────────────────────────

function writeVersionStamp(projectDir, version, method, preset) {
  const stampPath = join(projectDir, '.claude', '.helmcode-version');
  mkdirSync(dirname(stampPath), { recursive: true });
  const stamp = {
    version,
    installMethod: method,
    preset,
    installedAt: new Date().toISOString(),
  };
  writeFileSync(stampPath, JSON.stringify(stamp, null, 2) + '\n');
}

function readVersionStamp(projectDir) {
  const stampPath = join(projectDir, '.claude', '.helmcode-version');
  if (!existsSync(stampPath)) return null;
  try {
    return JSON.parse(readFileSync(stampPath, 'utf-8'));
  } catch {
    return null;
  }
}

// ── Fetch latest version from registry ───────────────────

async function fetchLatestVersion(method) {
  // For npm-based installs (and unknown/npx), check npm registry
  if (method === 'git-clone') {
    // For git, try GitHub releases API first
    try {
      const resp = await fetch('https://api.github.com/repos/wanlihang/helmcode/releases/latest', {
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': 'helmcode-cli' },
      });
      if (resp.ok) {
        const data = await resp.json();
        const tag = (data.tag_name || '').replace(/^v/, '');
        if (tag) return { latestVersion: tag, source: 'github' };
      }
    } catch { /* fallthrough to git tags */ }

    // Fallback: try git ls-remote tags
    try {
      const tags = execSync('git -C "' + HELMCODE_HOME + '" ls-remote --tags origin 2>/dev/null', {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();
      const versionTags = tags.split('\n')
        .map(line => {
          const m = line.match(/refs\/tags\/v?(\d+\.\d+\.\d+)/);
          return m ? m[1] : null;
        })
        .filter(Boolean);
      if (versionTags.length > 0) {
        // Sort and pick the latest
        versionTags.sort((a, b) => compareSemver(b, a));
        return { latestVersion: versionTags[0], source: 'git' };
      }
    } catch { /* no tags available */ }

    return { latestVersion: null, source: 'unknown' };
  }

  // npm registry (for npm-global, npm-local, npx, unknown)
  try {
    const resp = await fetch('https://registry.npmjs.org/helmcode/latest', {
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.version) return { latestVersion: data.version, source: 'npm' };
    }
  } catch { /* network error */ }

  return { latestVersion: null, source: 'unknown' };
}

// ── Self-update ──────────────────────────────────────────

function selfUpdate(method) {
  try {
    switch (method) {
      case 'npm-global':
        log('⬆', 'Updating via npm: npm install -g wanlihang/helmcode');
        execSync('npm install -g wanlihang/helmcode', { stdio: 'inherit' });
        return true;

      case 'npm-local':
        log('⬆', 'Updating via npm: npm install wanlihang/helmcode');
        execSync('npm install wanlihang/helmcode', { stdio: 'inherit' });
        return true;

      case 'git-clone': {
        const branch = execSync('git -C "' + HELMCODE_HOME + '" rev-parse --abbrev-ref HEAD', {
          encoding: 'utf-8',
        }).trim();
        log('⬆', `Updating via git: git pull origin ${branch}`);
        execSync(`git -C "${HELMCODE_HOME}" pull origin ${branch}`, { stdio: 'inherit' });
        return true;
      }

      case 'npx':
        log('ℹ', 'Running via npx — cannot self-update.');
        log('ℹ', 'Next time use: npx helmcode@latest install');
        return false;

      default:
        log('⚠', 'Could not determine install method. Manual update options:');
        log(' ', '  npm install -g wanlihang/helmcode');
        log(' ', '  git pull  (if cloned from GitHub)');
        log(' ', '  npx helmcode@latest install');
        return false;
    }
  } catch (err) {
    log('⚠', `Self-update failed: ${err.message}`);
    if (method === 'npm-global') {
      log('ℹ', 'You may need sudo: sudo npm install -g wanlihang/helmcode');
    } else if (method === 'git-clone') {
      log('ℹ', 'You may have local changes. Run "git status" in the HelmCode directory.');
    }
    return false;
  }
}

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

export const PRESETS = {
  'java-ddd': {
    skills: ['dev-flow', 'clarify', 'prd-gen', 'sdd-gen', 'implement', 'verify', 'analyze', 'init-java-ddd'],
    standardsDir: 'java-ddd',
  },
  minimal: {
    skills: ['dev-flow', 'clarify', 'prd-gen'],
    standardsDir: null,
  },
};

// ── Detect preset ────────────────────────────────────────

export function detectPreset(projectDir) {
  if (existsSync(join(projectDir, 'pom.xml')) || existsSync(join(projectDir, 'build.gradle'))) {
    return 'java-ddd';
  }
  return 'minimal';
}

// ── Install Skills ───────────────────────────────────────

function installSkills(projectDir, skills, helmcodeHome = HELMCODE_HOME) {
  const installed = [];
  const skipped = [];
  for (const skill of skills) {
    const source = join(helmcodeHome, 'core', skill);
    const target = join(projectDir, '.claude', 'skills', skill);

    if (!existsSync(source)) {
      log('⚠', `${skill} source not found, skipping`);
      skipped.push(skill);
      continue;
    }

    // Copy the entire skill directory (SKILL.md + references/ + templates/ + claude-md/ + any future subdirs).
    // Some skills (e.g. init-java-ddd) ship scaffold templates that are required for the skill to function
    // — copying only SKILL.md + references/ would leave them broken at execution time.
    cpSync(source, target, { recursive: true });

    const extras = [];
    if (existsSync(join(source, 'references'))) extras.push('references/');
    if (existsSync(join(source, 'templates'))) extras.push('templates/');
    if (existsSync(join(source, 'claude-md'))) extras.push('claude-md/');
    log('✓', extras.length ? `${skill} (+ ${extras.join(', ')})` : skill);
    installed.push(skill);
  }
  return { installed, skipped };
}

// ── Install Standards ────────────────────────────────────

function installStandards(projectDir, preset, helmcodeHome = HELMCODE_HOME) {
  const presetConfig = PRESETS[preset];
  if (!presetConfig.standardsDir) {
    log('ℹ', `Preset '${preset}' has no standards`);
    return 0;
  }

  const source = join(helmcodeHome, 'standards', presetConfig.standardsDir);
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

function createProjectDirs(projectDir, helmcodeHome = HELMCODE_HOME) {
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
  const scriptsSource = join(helmcodeHome, 'scripts');
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
  const commandsSource = join(helmcodeHome, 'commands');
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

主流程: /dev-flow (clarify → /goal → checkpoint)
单独使用: /clarify, /implement, /verify, /analyze, /checkpoint
需求文档: /prd-gen（从行为契约+PD原始需求整合生成标准化产品需求文档 L1-PRD，clarify 之后、与 /sdd-gen 并列）
系分文档: /sdd-gen（从需求/契约/PRD/代码生成标准化系分设计文档 L2-SDD，建议 clarify 之后、/goal 之前使用）

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
- 需求文档: .claude/prd/（由 /prd-gen 生成，Feature 编号与行为契约绑定，人读交付物）
- 系分文档: .claude/sdd/（由 /sdd-gen 生成，Feature 编号与行为契约绑定）
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

function installGlobalLoader(helmcodeHome = HELMCODE_HOME) {
  const globalSkillsDir = join(process.env.HOME, '.claude', 'skills');
  const loaderTarget = join(globalSkillsDir, 'helmcode-loader');
  const loaderSource = join(helmcodeHome, 'loader');

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

function detectSourceRoot(projectDir) {
  const candidates = ['app', 'src/main/java', 'src', '.'];
  for (const c of candidates) {
    const dir = join(projectDir, c);
    // maxDepth=8 覆盖 DDD 多模块布局 app/<module>/src/main/java/<pkg>/…(原 2 层扫不到)
    if (existsSync(dir) && findFilesDeep(dir, '.java', 8).length > 0) return dir;
  }
  return null;
}

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

export function scanDOAnnotations(sourceRoot) {
  const doFiles = findFilesDeep(sourceRoot, 'DO.java');
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

export function scanExceptionPattern(sourceRoot) {
  const throwMatches = { MycmBizException: 0, BizException: 0, OperationException: 0, RuntimeException: 0 };
  const errorCodeEnums = new Set();
  const javaFiles = findFilesDeep(sourceRoot, '.java');

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

export function scanFacadePattern(sourceRoot) {
  const facadeFiles = findFilesDeep(sourceRoot, 'FacadeImpl.java');
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

export function scanMapStruct(sourceRoot) {
  const convertFiles = findFilesDeep(sourceRoot, 'Convert.java')
    .concat(findFilesDeep(sourceRoot, 'Converter.java'));

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

export function scanPersistence(sourceRoot) {
  const xmlMappers = findFilesDeep(sourceRoot, 'Mapper.xml');
  const mybatisPlusUsage = findFilesDeep(sourceRoot, 'DO.java')
    .filter(f => readFileSync(f, 'utf-8').includes('@TableName')).length;
  const baseMapperUsage = findFilesDeep(sourceRoot, 'Mapper.java')
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

export function scanIntegrationPattern(sourceRoot) {
  const integrationDir = findFilesDeep(sourceRoot, '.java')
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

export function generateProjectConventions(projectDir) {
  const sourceRoot = detectSourceRoot(projectDir);
  if (!sourceRoot) {
    const md = `# 项目约定 — 自动检测\n\n> ⚠ 未找到 Java 源码目录（搜索顺序：app/, src/main/java/, src/, .），跳过约定扫描。\n> 如有需要，请手动编辑此文件。\n`;
    return { md, doResult: { detected: false }, facadeResult: { detected: false }, convertResult: { detected: false } };
  }

  const doResult = scanDOAnnotations(sourceRoot);
  const exResult = scanExceptionPattern(sourceRoot);
  const facadeResult = scanFacadePattern(sourceRoot);
  const convertResult = scanMapStruct(sourceRoot);
  const persistResult = scanPersistence(sourceRoot);
  const integResult = scanIntegrationPattern(sourceRoot);

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

  return { md, doResult, facadeResult, convertResult };
}

// ── Main install ─────────────────────────────────────────

export async function install(options) {
  const { preset: presetArg, project: projectArg, force, globalLoader, quiet, helmcodeHome } = options;
  const home = helmcodeHome || HELMCODE_HOME;

  const projectDir = resolve(projectArg || process.cwd());
  const preset = presetArg || detectPreset(projectDir);

  // Validate HelmCode source
  if (!existsSync(join(home, 'core'))) {
    console.error('❌ HelmCode core files not found at: ' + home);
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

  if (!quiet) {
    header('HelmCode Installing...');

    const currentVersion = getHelmcodeVersion(home);
    const installMethod = detectInstallMethod(home);
    log('ℹ', `Source version: v${currentVersion} (${installMethod})`);
  }

  // ── Default: sync source from GitHub before install ──
  // 方案 A：helmcode install 默认从 GitHub 拉最新源，确保新技能/修复能被装到。
  // npm install -g 会更新磁盘上的包，但当前进程内存里的 PRESETS/skills 仍是旧的，
  // 故 selfUpdate 后必须 reexec（用新代码重跑 install），否则本次仍按旧 skill 列表安装。
  // 跳过条件：--no-self-update（离线/快速），或被 update() 调用（update 自己已同步源）。
  if (!options.noSelfUpdate && !options.phaseOffset) {
    header('Sync Source (latest from GitHub)');
    const method = detectInstallMethod(home);
    log('ℹ', `Pulling latest helmcode via ${method} (--no-self-update to skip)...`);
    const ok = selfUpdate(method);
    if (ok) {
      log('✓', 'Source synced. Re-running install with the latest code...');
      execSync(
        `"${process.execPath}" "${process.argv[1]}" ${process.argv.slice(2).map(a => `"${a}"`).join(' ')} --no-self-update`,
        { stdio: 'inherit' }
      );
      process.exit(0);
    }
    log('⚠', 'Source sync failed (offline or unreachable). Continuing with installed source.');
    console.log('');
  }

  const presetConfig = PRESETS[preset];

  // Phase numbering: when called from update, continue from the offset
  const phaseBase = options.phaseOffset || 0;
  // Phase 1: Install Skills
  phaseHeader(phaseBase + 1, 'Install Skills');
  const { installed: installedSkills, skipped: skippedSkills } = installSkills(projectDir, presetConfig.skills, home);

  // Phase 2: Install Standards
  phaseHeader(phaseBase + 2, `Install Standards (${preset})`);
  const standardsCount = await installStandards(projectDir, preset, home);

  // Phase 3: Scan project conventions
  if (preset === 'java-ddd') {
    phaseHeader(phaseBase + 3, 'Scan Project Conventions');
    const { md: conventionsMd, doResult, facadeResult, convertResult } = generateProjectConventions(projectDir);
    const conventionsPath = join(projectDir, '.claude', 'standards', 'project-conventions.md');
    mkdirSync(dirname(conventionsPath), { recursive: true });
    writeFileSync(conventionsPath, conventionsMd);
    log('✓', 'project-conventions.md generated');

    console.log('');
    log('ℹ', 'Convention scan results:');
    if (doResult.detected) log(' ', `DO: ${doResult.style} (${doResult.consistency}%)`);
    if (facadeResult.detected) log(' ', `Facade: ${facadeResult.rpcAnnotation}, Result: ${facadeResult.resultStyle}`);
    if (convertResult.detected) log(' ', `Convert: ${convertResult.usage === 'mapstruct' ? 'MapStruct ' + convertResult.instanceField : convertResult.usage}`);
  }

  // Phase 4: Create project directories
  phaseHeader(phaseBase + 4, 'Create Project Directories');
  createProjectDirs(projectDir, home);

  // Phase 5: Configure CLAUDE.md
  phaseHeader(phaseBase + 5, 'Configure CLAUDE.md');
  configureClaudeMd(projectDir, preset);

  // Phase 6: Global loader (optional)
  if (globalLoader) {
    phaseHeader(phaseBase + 6, 'Install Global Loader');
    installGlobalLoader(home);
  }

  // Write version stamp
  writeVersionStamp(projectDir, getHelmcodeVersion(home), detectInstallMethod(home), preset);

  // Summary (skip when called from update — update prints its own summary)
  if (!quiet) {
    header('HelmCode Installed!');
    console.log('');
    console.log(`  Version:   v${getHelmcodeVersion(home)}`);
    console.log(`  Skills:    ${presetConfig.skills.length} installed`);
    console.log(`  Standards: ${standardsCount} files`);
    console.log('');
    console.log('  Usage:');
    console.log('    /dev-flow    — Goal-driven workflow (clarify → /goal → checkpoint)');
    console.log('    /clarify     — Break down requirements into behavior contract');
    console.log('    /checkpoint  — Review judgment log decisions');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  // 结构化返回(programmatic API 用,BR-002;保留上方 console.log 兼容 CLI)
  return {
    installed: {
      skills: [...installedSkills],
      standards: standardsCount,
      dirs: ['.claude/contracts/', '.claude/briefs/', '.claude/judgment-logs/'],
    },
    skipped: [...skippedSkills],
    errors: [],
    version: getHelmcodeVersion(home),
  };
}

// ── Status ───────────────────────────────────────────────

export async function status(options) {
  const projectDir = resolve(options.project || process.cwd());
  const claudeDir = join(projectDir, '.claude');
  const skillsDir = join(claudeDir, 'skills');
  const standardsDir = join(claudeDir, 'standards');

  const currentVersion = getHelmcodeVersion();
  const installMethod = detectInstallMethod();
  const stamp = readVersionStamp(projectDir);

  header('HelmCode Status');
  console.log(`  Source:      ${HELMCODE_HOME}`);
  console.log(`  Install:    ${installMethod}`);
  console.log(`  Version:    v${currentVersion}`);
  if (stamp) {
    console.log(`  Installed:  v${stamp.version} (${stamp.preset}, ${new Date(stamp.installedAt).toLocaleDateString()})`);
  } else {
    console.log('  Installed:  unknown (installed before version tracking)');
  }
  console.log(`  Project:    ${projectDir}`);
  console.log('');

  if (!existsSync(claudeDir)) {
    log('⚠', '.claude/ directory not found');
    log('ℹ', 'Run "helmcode install" to install');
    return;
  }

  // Check for updates
  const latestInfo = await fetchLatestVersion(installMethod);
  if (latestInfo.latestVersion) {
    const cmp = compareSemver(currentVersion, latestInfo.latestVersion);
    if (cmp < 0) {
      log('⬆', `Update available: v${currentVersion} → v${latestInfo.latestVersion} (run: helmcode update)`);
    } else {
      log('✓', `Up to date (v${currentVersion})`);
    }
  } else {
    log('ℹ', 'Could not check for updates (offline or registry unavailable)');
  }
  console.log('');

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
  for (const dir of ['contracts', 'briefs', 'judgment-logs', 'scripts', 'commands']) {
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
  const currentVersion = getHelmcodeVersion();
  const installMethod = detectInstallMethod();
  header(`HelmCode Available Presets (v${currentVersion}, ${installMethod})`);
  console.log('');
  for (const [name, config] of Object.entries(PRESETS)) {
    console.log(`  ${name}:`);
    console.log(`    Skills:    ${config.skills.join(', ')}`);
    console.log(`    Standards: ${config.standardsDir || 'none'}`);
    console.log('');
  }
}

// ── Version ──────────────────────────────────────────────

export async function version() {
  const v = getHelmcodeVersion();
  const method = detectInstallMethod();
  console.log(`HelmCode v${v}`);
  console.log(`  Install method: ${method}`);
  console.log(`  Source path:    ${HELMCODE_HOME}`);
  console.log(`  Node.js:        ${process.version}`);
}

// ── Update ───────────────────────────────────────────────

export async function update(options) {
  const projectDir = resolve(options.project || process.cwd());
  const preset = options.preset || detectPreset(projectDir);
  const method = detectInstallMethod();
  const currentVersion = getHelmcodeVersion();

  header('HelmCode Update');
  console.log(`  Source:      ${HELMCODE_HOME}`);
  console.log(`  Install:    ${method}`);
  console.log(`  Version:    v${currentVersion}`);
  console.log(`  Project:    ${projectDir}`);
  console.log('');

  // Step 1: Self-update (pull latest source)
  if (!options.noSelfUpdate) {
    phaseHeader(1, 'Check for Updates');

    const latestInfo = await fetchLatestVersion(method);

    if (latestInfo.latestVersion === null) {
      log('⚠', 'Could not check for updates (offline or registry unavailable)');
      log('ℹ', 'Reinstalling project files from current source...');
    } else {
      const cmp = compareSemver(currentVersion, latestInfo.latestVersion);

      if (cmp < 0) {
        log('⬆', `New version available: v${currentVersion} → v${latestInfo.latestVersion}`);
        log('ℹ', `Updating source via ${method}...`);

        const success = selfUpdate(method);

        if (success) {
          const newVersion = getHelmcodeVersion();
          log('✓', `Source updated: v${currentVersion} → v${newVersion}`);
        } else {
          log('⚠', `Source update failed. Reinstalling from current version v${currentVersion}`);
        }
      } else {
        log('✓', `Already on latest version (v${currentVersion})`);
        log('ℹ', 'Reinstalling project files...');
      }
    }
  } else {
    phaseHeader(1, 'Self-Update (skipped)');
    log('ℹ', 'Skipping source update (--no-self-update)');
    log('ℹ', 'Reinstalling project files from current source...');
  }

  // Step 2: Reinstall to project (phase numbers continue from 2)
  phaseHeader(2, 'Reinstall Project Files');
  await install({ preset, project: projectDir, force: true, globalLoader: options.globalLoader, quiet: true, phaseOffset: 2 });

  // Summary
  const newVersion = getHelmcodeVersion();
  header('HelmCode Updated!');
  console.log('');
  console.log(`  Version:   v${newVersion}`);
  console.log(`  Preset:    ${preset}`);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
