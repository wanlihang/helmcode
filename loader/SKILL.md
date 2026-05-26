---
name: helmcode-loader
description: |
  HelmCode 安装器。将 AI 编程工作流（clarify → implement → verify）安装到目标项目。
  按 preset 安装 skills、standards、templates，并创建项目目录结构。

  触发场景：
  - 用户说"安装 HelmCode"、"初始化 HelmCode"、"加载 HelmCode"
  - 用户提到"helmcode-loader"、"loader"
  - 新项目初始化开发环境

  特性：按 preset 安装，每个 skill 自带 references（模板、规范、启发规则）。
version: 2.0
author: HelmCode
tags: [loader, init, 安装, HelmCode]
---

# helmcode-loader: HelmCode 安装器

> **人把舵，AI 划桨** — 围绕"人的判断力是最稀缺资源"设计的 AI 编程工作流

---

## 执行原则

1. **先说明后执行**：列出所有操作，用户确认一次
2. **批量执行**：不要每个命令都单独请求确认
3. **使用 --force 跳过确认**：熟手可用

---

## 核心理念

HelmCode 是什么：
- AI 编程工作流：clarify → implement → verify
- 按项目安装：skills + standards + templates + 目录结构
- behavior-driven：行为契约替代 L1-L4 文档流水线

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

## 核心 Skills（5个）

| Skill | 职责 | 安装内容 |
|-------|------|---------|
| dev-flow | AI 编程主工作流（3步循环） | SKILL.md |
| clarify | 需求拆解，产出行为契约 | SKILL.md + references/（模板、澄清维度） |
| implement | 自动实现，产出判断日志 | SKILL.md + references/（判断规范、上下文规则） |
| verify | 验证与判断审查 | SKILL.md |
| analyze | 架构合规分析 | SKILL.md |

---

## 安装内容

| 来源 | 目的 | 行为 |
|------|------|------|
| `core/{skill}/` | 项目 skills | 复制到 `.claude/skills/{skill}/` |
| `standards/{preset}/` | 编码标准 | 复制到 `.claude/standards/` |
| `templates/` | 行为契约+简报模板 | 已内嵌到 clarify/references/，无需单独复制 |
| **新建** `.claude/contracts/` | 行为契约 | 创建目录 |
| **新建** `.claude/briefs/` | 项目简报 | 创建目录 |
| **新建** `.claude/judgment-logs/` | 判断日志 | 创建目录 |
| **新建** `CLAUDE.md` 或追加 | 项目约束 | 生成/追加 HelmCode 配置 |

---

## Preset 配置

### java-ddd（默认）

完整 Java Spring Boot DDD 开发流程。

Skills: dev-flow, clarify, implement, verify, analyze
Standards: standards.md, review-rules.md, test-standards.md, patterns/

### minimal

仅核心开发流程，不安装技术栈标准。

Skills: dev-flow, clarify
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
│   │   │   └── SKILL.md
│   │   ├── clarify/
│   │   │   ├── SKILL.md
│   │   │   └── references/
│   │   │       ├── contract-template.md
│   │   │       ├── brief-template.md
│   │   │       └── clarification-dimensions.md
│   │   ├── implement/
│   │   │   ├── SKILL.md
│   │   │   └── references/
│   │   │       ├── judgment-log-format.md
│   │   │       ├── judgment-heuristics.md
│   │   │       └── context-loader.md
│   │   ├── verify/
│   │   │   └── SKILL.md
│   │   └── analyze/
│   │       └── SKILL.md
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
│   │       └── application-service.md
│   ├── contracts/
│   │   └── registry.md                # Feature 注册表
│   ├── briefs/                        # 项目简报（不参与代码生成）
│   └── judgment-logs/                 # 判断日志
```

---

## 工作流程

```
Phase 1: 环境检测
    │  检测 .claude/ 是否存在
    │  检测技术栈（pom.xml/package.json/...）
    │  检测已有 CLAUDE.md
    │  选择 preset（自动或手动）
    ▼
Phase 2: 安装 Skills
    │  复制 core/{skill}/ → .claude/skills/{skill}/
    │  每个 skill 包含 SKILL.md + references/
    ▼
Phase 3: 安装 Standards
    │  复制 standards/{preset}/* → .claude/standards/
    │  包括 patterns/ 目录
    ▼
Phase 4: 创建项目目录
    │  创建 contracts/、briefs/、judgment-logs/
    │  初始化 registry.md
    ▼
Phase 5: 配置 CLAUDE.md
    │  生成或追加 HelmCode 配置
    ▼
Phase 6: 完成报告
```

---

## 命令参数

| 参数 | 是否需要确认 | 说明 |
|------|-------------|------|
| 无参数 | 是 | 默认安装（自动检测 preset） |
| `--preset java-ddd` | 否 | 指定 Java DDD preset |
| `--preset minimal` | 否 | 指定最小化 preset |
| `--force` | 否 | 跳过确认，直接执行 |
| `--status` | 否 | 显示已安装状态（只读） |
| `--update` | 是 | 更新所有已安装内容 |
| `--list` | 否 | 列出可用 preset 和 skills（只读） |

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
# 源路径（helmcode-loader 所在目录的上级）
HELMCODE_HOME="$(dirname "$(dirname "$(readlink -f "$0")")")"
# 如果是 symlink，获取实际路径
if [ -L "$HOME/.claude/skills/helmcode-loader" ]; then
  HELMCODE_HOME="$(readlink -f "$HOME/.claude/skills/helmcode-loader")"
  HELMCODE_HOME="$(dirname "$HELMCODE_HOME")"
fi

# 根据 preset 确定要安装的 skills
if [ "$PRESET" = "java-ddd" ]; then
  SKILLS=("dev-flow" "clarify" "implement" "verify" "analyze")
elif [ "$PRESET" = "minimal" ]; then
  SKILLS=("dev-flow" "clarify")
fi

for skill in "${SKILLS[@]}"; do
  # 复制 SKILL.md
  mkdir -p ".claude/skills/$skill"
  cp "$HELMCODE_HOME/core/$skill/SKILL.md" ".claude/skills/$skill/"

  # 复制 references/（如果存在）
  if [ -d "$HELMCODE_HOME/core/$skill/references" ]; then
    cp -r "$HELMCODE_HOME/core/$skill/references" ".claude/skills/$skill/"
  fi
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
```

### Phase 5: 配置 CLAUDE.md

检测技术栈后生成或追加：

```markdown
# HelmCode 工作流
主流程: /dev-flow (clarify → implement → verify)
单独使用: /clarify, /implement, /verify, /analyze

## 编码标准
- 编码标准: .claude/standards/standards.md
- 审查规则: .claude/standards/review-rules.md
- 测试标准: .claude/standards/test-standards.md
- 代码模式: .claude/standards/patterns/

## 目录约定
- 行为契约: .claude/contracts/
- 项目简报: .claude/briefs/ (不参与代码生成)
- 判断日志: .claude/judgment-logs/
- Feature 注册: .claude/contracts/registry.md
```

---

## 更新逻辑

`--update` 时：
- Skills/standards：直接覆盖（这些是标准化的）
- CLAUDE.md：追加，不覆盖项目自定义内容
- contracts/briefs/judgment-logs：不覆盖（项目特定内容）

---

## 磁盘占用

- 5 个 skills + references：约 80KB
- standards + patterns：约 50KB（java-ddd preset）
- 项目目录和 registry：约 1KB
- **总计约 130KB**（对比 v2 的 365KB+ 上下文）

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

### 查看已安装状态

```
/helmcode-loader --status
```

### 更新

```
/helmcode-loader --update
```

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v2.0 | 2026-05-14 | 重构为 HelmCode：行为契约 + 判断日志，替代 L1-L4 |
| v1.0 | 2026-03-16 | 初始版本 |