---
name: helmcode-loader
description: |
  HelmCode 安装器。将 AI 编程工作流（clarify → /goal → checkpoint）安装到目标项目。
  按 preset 安装 skills、standards、templates，并创建项目目录结构。

  触发场景：
  - 用户说"安装 HelmCode"、"初始化 HelmCode"、"加载 HelmCode"
  - 用户提到"helmcode-loader"、"loader"
  - 新项目初始化开发环境

  特性：按 preset 安装，每个 skill 自带 references（模板、规范、启发规则）。
  利用 Claude Code 的 /goal 机制驱动自主执行闭环。
version: 3.0.0
author: HelmCode
tags: [loader, init, 安装, HelmCode, goal]
---

# helmcode-loader: HelmCode 安装器

> **人定义终点，AI 自主到达** — goal 驱动的 AI 编程工作流

---

## 执行原则

1. **先说明后执行**：列出所有操作，用户确认一次
2. **批量执行**：不要每个命令都单独请求确认
3. **使用 --force 跳过确认**：熟手可用

---

## 核心理念

HelmCode 是什么：
- AI 编程工作流：clarify → /goal → checkpoint
- 利用 Claude Code 的 /goal 机制驱动自主执行闭环
- 行为契约的验收条件 = /goal 的完成条件
- 按项目安装：skills + standards + templates + 目录结构
- behavior-driven：行为契约是 `/goal` 的唯一机器驱动源（替代 L1-L4 瀑布流水线作为驱动）；PRD(L1)/SDD(L2) 是从契约派生的人读交付物，不参与机器判断

HelmCode 不是什么：
- 不是全局工具——每个项目独立安装
- 不是代码生成器——是需求→代码→验证的完整循环

---

## 知识库路径

**源路径**：`~/.claude/skills/helmcode-loader/` 上级目录结构
**目标路径**：当前项目根目录

> 如果 HelmCode 源码在其他位置（如 /Users/wanlihang/HelmCode），
> 则从该位置的 core/、standards/ 复制。templates/ 已内嵌到 clarify/references/，无需单独复制。

---

## 核心 Skills

| Skill | 职责 | 安装内容 | 适用 Preset |
|-------|------|---------|------------|
| dev-flow | 主编排器（clarify → /goal → checkpoint） | SKILL.md + references/（goal 条件构建器） | 全部 |
| clarify | 需求拆解，产出行为契约 | SKILL.md + references/（模板、澄清维度） | 全部 |
| prd-gen | 产品需求文档（L1-PRD）生成器：从契约+PD原始需求整合人读 PRD | SKILL.md + references/（PRD 模板） | 全部 |
| sdd-gen | 系分设计文档（L2-SDD）生成器：从契约/需求/代码生成 DDD 系分 | SKILL.md + references/（系分模板、PlantUML 规范） | java-ddd |
| implement | goal loop 内的代码生成 worker | SKILL.md + references/（判断规范、上下文规则） | java-ddd |
| verify | goal loop 内的验证动作集 | SKILL.md | java-ddd |
| analyze | 架构合规分析 | SKILL.md | java-ddd |
| init-java-ddd | Java DDD 应用冷启动生成器 | SKILL.md + references/ + templates/ + claude-md/ | java-ddd |

---

## 安装内容

| 来源 | 目的 | 行为 |
|------|------|------|
| `core/{skill}/` | 项目 skills | 复制到 `.claude/skills/{skill}/` |
| `standards/{preset}/` | 编码标准 | 复制到 `.claude/standards/` |
| `scripts/` | 验证脚本 | 复制到 `.claude/scripts/` |
| `commands/` | 自定义命令 | 复制到 `.claude/commands/` |
| **生成** `.claude/standards/project-conventions.md` | 项目约定扫描结果（仅 java-ddd） | 自动检测 DO 注解、异常类、Facade 等模式 |
| **新建** `.claude/contracts/` | 行为契约 | 创建目录 |
| **新建** `.claude/briefs/` | 项目简报 | 创建目录 |
| **新建** `.claude/judgment-logs/` | 判断日志 | 创建目录 |
| **新建** `CLAUDE.md` 或追加 | 项目约束 | 生成/追加 HelmCode 配置 |

---

## Preset 配置

### java-ddd（默认）

完整 Java Spring Boot DDD 开发流程。

Skills: dev-flow, clarify, prd-gen, sdd-gen, implement, verify, analyze, init-java-ddd
Standards: standards.md, review-rules.md, test-standards.md, patterns/
项目约定扫描: DO 注解、异常类、Facade 模式、MapStruct、持久层框架

### minimal

仅核心开发流程，不安装技术栈标准。

Skills: dev-flow, clarify, prd-gen
Standards: 无

---

## 项目目录结构

安装后的项目结构：

```
项目根目录/
├── CLAUDE.md                          # 项目约束（追加 HelmCode 配置）
├── .claude/
│   ├── skills/
│   │   ├── dev-flow/
│   │   │   ├── SKILL.md
│   │   │   └── references/
│   │   │       └── goal-condition-builder.md
│   │   ├── clarify/
│   │   │   ├── SKILL.md
│   │   │   └── references/
│   │   │       ├── contract-template.md
│   │   │       ├── brief-template.md
│   │   │       └── clarification-dimensions.md
│   │   ├── prd-gen/                   # 全部 preset
│   │   │   ├── SKILL.md
│   │   │   └── references/
│   │   │       ├── prd-template.md
│   │   │       └── plantuml-style.md
│   │   ├── sdd-gen/                  # 仅 java-ddd preset
│   │   │   ├── SKILL.md
│   │   │   └── references/
│   │   │       ├── sdd-template.md
│   │   │       └── plantuml-style.md
│   │   ├── implement/
│   │   │   ├── SKILL.md
│   │   │   └── references/
│   │   │       ├── judgment-log-format.md
│   │   │       ├── judgment-heuristics.md
│   │   │       └── context-loader.md
│   │   ├── verify/
│   │   │   └── SKILL.md
│   │   ├── analyze/
│   │   │   └── SKILL.md
│   │   └── init-java-ddd/            # 仅 java-ddd preset
│   │       ├── SKILL.md
│   │       ├── references/
│   │       │   ├── package-structure.md
│   │       │   ├── sofa-starter-index.md
│   │       │   └── antipatterns.md
│   │       ├── templates/            # 脚手架模板
│   │       └── claude-md/            # CLAUDE.md 模板
│   │           └── CLAUDE.md.tmpl
│   ├── standards/
│   │   ├── standards.md               # 编码标准
│   │   ├── review-rules.md            # 审查规则
│   │   ├── test-standards.md          # 测试标准
│   │   └── patterns/                  # 代码模式
│   │       ├── entity.md
│   │       ├── facade.md
│   │       ├── aggregate.md
│   │       ├── strategy.md
│   │       ├── builder.md
│   │       ├── repository.md
│   │       ├── application-service.md
│   │       ├── domain-event.md
│   │       ├── integration-client.md
│   │       └── test.md
│   │   └── project-conventions.md   # 项目约定（自动扫描生成，仅 java-ddd）
│   ├── scripts/
│   │   ├── verify-arch-rules.mjs    # 架构规则验证脚本
│   │   └── verify-field-sync.mjs    # 字段同步验证脚本
│   ├── commands/
│   │   ├── checkpoint.md            # /checkpoint 命令
│   │   └── state.md                 # /state 命令
│   ├── contracts/
│   │   └── registry.md                # Feature 注册表
│   ├── briefs/                        # 项目简报（不参与代码生成）
│   ├── judgment-logs/                 # 判断日志
│   ├── prd/                           # 需求文档（/prd-gen 生成，人读交付物）
│   └── sdd/                           # 系分文档（/sdd-gen 生成）
```

---

## 工作流程

```
Phase 1: 安装 Skills
    │  复制 core/{skill}/ → .claude/skills/{skill}/
    │  整目录复制 (SKILL.md + references/ + templates/ + claude-md/)
    ▼
Phase 2: 安装 Standards
    │  复制 standards/{preset}/* → .claude/standards/
    │  包括 patterns/ 目录
    ▼
Phase 3: 扫描项目约定（仅 java-ddd）
    │  扫描项目代码检测 DO 注解、异常类、Facade 模式、MapStruct、持久层框架
    │  生成 .claude/standards/project-conventions.md
    ▼
Phase 4: 创建项目目录
    │  创建 contracts/、briefs/、judgment-logs/
    │  初始化 registry.md
    │  安装 scripts/ (verify 脚本) 和 commands/ (checkpoint, state)
    ▼
Phase 5: 配置 CLAUDE.md
    │  生成或追加 HelmCode 配置
    │  包含编码标准路径、项目约定引用、目录约定
    ▼
Phase 6: 安装全局 Loader（可选）
    │  symlink loader/ → ~/.claude/skills/helmcode-loader
    ▼
完成报告
```

---

## 命令参数

### 子命令

| 命令 | 说明 |
|------|------|
| `install` | 安装 HelmCode 到项目（默认命令） |
| `status` | 显示已安装状态、版本信息和更新检查（只读） |
| `update` | 拉取最新版本并重新安装项目文件 |
| `list` | 列出可用 preset 和 skills（只读） |
| `version` | 显示 HelmCode 版本和安装方式（只读） |

### 选项

| 选项 | 说明 |
|------|------|
| `--preset java-ddd\|minimal` | 技术栈预设（默认自动检测） |
| `--project /path` | 目标项目目录（默认当前目录） |
| `--force` | 跳过确认，直接执行 |
| `--global-loader` | 同时安装全局 helmcode-loader skill |
| `--no-self-update` | 跳过源码更新，仅重新安装项目文件 |
| `--version, -v` | 显示版本 |
| `--help, -h` | 显示帮助 |

---

## 执行逻辑

### Phase 1: 环境检测

1. 检测 `.claude/` 是否存在 → 存在则更新，不存在则全新安装
2. 检测技术栈：
   - `pom.xml` 或 `build.gradle` + `domain/` 目录 → Java DDD
   - 其他 → minimal
3. 检测已有 CLAUDE.md：
   - 存在 → 读取，判断是否已有 HelmCode 配置
   - 不存在 → 新建

### Phase 2: 安装 Skills

```bash
# 根据 preset 确定要安装的 skills
if [ "$PRESET" = "java-ddd" ]; then
  SKILLS=("dev-flow" "clarify" "prd-gen" "sdd-gen" "implement" "verify" "analyze" "init-java-ddd")
elif [ "$PRESET" = "minimal" ]; then
  SKILLS=("dev-flow" "clarify" "prd-gen")
fi

for skill in "${SKILLS[@]}"; do
  # 整目录复制 (SKILL.md + references/ + templates/ + claude-md/ 及未来子目录)
  cp -R "$HELMCODE_HOME/core/$skill" ".claude/skills/$skill"
done
```

### Phase 3: 安装 Standards

```bash
if [ "$PRESET" = "java-ddd" ]; then
  # 复制标准文件
  cp "$HELMCODE_HOME/standards/java-ddd/"*.md ".claude/standards/"

  # 复制 patterns 目录
  mkdir -p ".claude/standards/patterns"
  cp "$HELMCODE_HOME/standards/java-ddd/patterns/"*.md ".claude/standards/patterns/"
fi
```

### Phase 4: 创建项目目录

```bash
mkdir -p .claude/contracts
mkdir -p .claude/briefs
mkdir -p .claude/judgment-logs

# 初始化 registry.md
if [ ! -f .claude/contracts/registry.md ]; then
  cat > .claude/contracts/registry.md << 'EOF'
# Feature 注册表

| Feature ID | 名称 | 状态 | 行为契约 | 判断日志 | 创建时间 | 更新时间 |
|------------|------|------|---------|---------|---------|---------|
EOF
fi

# 安装 verify 脚本
cp "$HELMCODE_HOME/scripts/"*.mjs ".claude/scripts/"

# 安装 commands
cp "$HELMCODE_HOME/commands/"*.md ".claude/commands/"
```

### Phase 5: 配置 CLAUDE.md

检测技术栈后生成或追加：

```markdown
# HelmCode 工作流
主流程: /dev-flow (clarify → /goal → checkpoint)
单独使用: /clarify, /implement, /verify, /analyze, /checkpoint
需求文档: /prd-gen（从行为契约+PD原始需求整合生成 L1-PRD，clarify 之后、与 /sdd-gen 并列）
系分文档: /sdd-gen（从需求/契约/PRD/代码生成 L2-SDD，clarify 之后、/goal 之前）

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
- 需求文档: .claude/prd/（由 /prd-gen 生成，Feature 编号与行为契约绑定）
- 系分文档: .claude/sdd/（由 /sdd-gen 生成，Feature 编号与行为契约绑定）
```

---

## 更新逻辑（自更新）

`helmcode update` 执行两步操作：

### Step 1: 源码自更新

根据安装方式自动拉取最新 HelmCode 源码：

| 安装方式 | 自更新行为 |
|----------|-----------|
| `npm-global` | 执行 `npm update -g helmcode` |
| `npm-local` | 执行 `npm update helmcode` |
| `git-clone` | 执行 `git pull origin <current-branch>` |
| `npx` | 无法自更新，提示使用 `npx helmcode@latest install` |
| `unknown` | 显示手动更新指引 |

自更新前会检查远程最新版本：
- npm 安装 → 查询 `registry.npmjs.org/helmcode/latest`
- git 安装 → 查询 GitHub Releases API 或 `git ls-remote --tags`
- 若已是最新版本，跳过源码更新，仅重新安装项目文件
- 若网络不可达，跳过源码更新，从当前源重新安装

使用 `--no-self-update` 可跳过 Step 1，仅执行 Step 2。

### Step 2: 重新安装项目文件

- Skills/standards：直接覆盖（这些是标准化的）
- CLAUDE.md：追加，不覆盖项目自定义内容
- contracts/briefs/judgment-logs：不覆盖（项目特定内容）
- 写入 `.claude/.helmcode-version` 记录安装版本和方法

### 版本追踪

每次 `install` 或 `update` 会写入 `.claude/.helmcode-version`：

```json
{
  "version": "2.0.3",
  "installMethod": "git-clone",
  "preset": "java-ddd",
  "installedAt": "2026-06-02T10:30:00.000Z"
}
```

`status` 命令读取此文件显示已安装版本，并与远程最新版本对比检查更新。

---

## 磁盘占用

- 8 个 skills + references + templates：约 140KB（java-ddd preset）
- 3 个 skills + references：约 35KB（minimal preset）
- standards + patterns：约 50KB（java-ddd preset）
- scripts + commands：约 10KB
- 项目目录和 registry：约 1KB
- **总计约 200KB（java-ddd）/ 35KB（minimal）**

---

## 使用方式

### 首次安装

```
/helmcode-loader
```

### 指定 preset

```
/helmcode-loader --preset java-ddd
```

### 查看已安装状态和版本

```
/helmcode-loader --status
```

### 更新（自动拉取最新版本）

```
/helmcode-loader --update
```

### 仅重新安装项目文件（不更新源码）

```
/helmcode-loader --update --no-self-update
```

### 查看版本信息

```
/helmcode-loader --version
```

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v3.3.0 | 2026-07-02 | api.mjs 新增 `contentChecksum(helmcodeHome)`：按 `package.json files` 字段算全量发布内容 checksum（覆盖 core/standards/scripts/commands/loader/bin + 根 mjs），排除非发布内容（.git/.claude/test/...）。用于 HelmFlow「全变更 drift 感知」（替代旧 standardsChecksum 只覆盖 standards 子集，漏检 core skill 等）。重构 checksum 抽 hashEntries/collectEntries 共享内部函数（算法不变，向后兼容）。 |
| v3.2.0 | 2026-07-02 | 新增 prd-gen 技能（L1-PRD 生成器）：从行为契约+PD原始需求整合生成人读 PRD，与 sdd-gen 并列（clarify 后派生）。prd/sdd 模板 frontmatter 双加 `matrixCellId`（HelmFlow 协同，契约↔PRD↔SDD 三边一致）。java-ddd+minimal 两 preset 注册。 |
| v3.1.0 | 2026-06-16 | install 默认从 GitHub 同步最新源 + reexec 加载新代码（新技能/修复装得到）；新增 api.mjs programmatic 入口（query/checksum/6 scanner）+ 契约 `matrixCellId` + matrix 目录（F001-helmflow-sync）。 |
| v3.0.0 | 2026-06-15 | goal 机制升级：信号单一事实源（signal-glossary.md）+ 确定性 AC→goal 编译器（compile-goal.mjs）+ success predicate（verify-harness SIG-ACCOV）+ 三方对账（verify-glossary.mjs）。契约 AC 加优先级 P0/P1、验证方式 4 枚举、AC-测试映射表。**Breaking**：旧契约需补优先级字段才能被 compile-goal 解析。 |
| v2.1.0 | 2026-06-02 | 新增：`update` 自更新（自动从 GitHub/npm 拉取最新版本）、`version` 命令、`--no-self-update` 选项、版本追踪（`.claude/.helmcode-version`）、`status` 增强（版本+更新检查）、`list` 显示版本 |
| v2.0.3 | 2026-06-01 | 修复：install.sh 与 install.mjs 对齐，补充 init-java-ddd、scripts/commands 安装、项目约定扫描、status/update/list 子命令、--global-loader 选项 |
| v3.0 | 2026-05-26 | 集成 /goal：从手动串联改为 goal 驱动自主闭环 |
| v2.0 | 2026-05-14 | 重构为 HelmCode：行为契约 + 判断日志，替代 L1-L4 |
| v1.0 | 2026-03-16 | 初始版本 |