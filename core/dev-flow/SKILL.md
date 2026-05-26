---
name: dev-flow
description: |
  AI 编程主工作流。3 步循环：clarify → implement → verify。
  围绕人的判断力设计，而非文档完整性。

  触发场景：
  - 用户说"开发新功能"、"实现需求"、"做一个xxx"
  - 用户描述了一个需求或 Feature
  - 用户提到 "dev-flow"、"开发流程"

  注意：此技能负责协调 clarify、implement、verify 三个子技能的执行顺序和上下文传递。
version: 1.1
author: HelmCode
tags: [workflow, dev-flow, AI编程]
---

# dev-flow: AI 编程主工作流

## 核心理念

人的判断力是最稀缺资源。系统围绕"人审什么"设计，不是"文档产什么"。

## 上下文隔离约定

行为契约（`.claude/contracts/`）是 AI 代码生成的唯一输入源。项目简报（`.claude/briefs/`）仅供人阅读。

| 目录 | clarify | implement | verify | 人 |
|------|---------|-----------|--------|---|
| contracts/ | ✅ 读取/写入 | ✅ 读取 | ✅ 读取 | ✅ 审查 |
| briefs/ | ✅ 写入 | ❌ 禁止读取 | ❌ 禁止读取 | ✅ 阅读 |
| judgment-logs/ | ❌ | ✅ 写入 | ✅ 读取/更新 | ✅ 审查 |

**关键约束**：如果项目简报中有影响代码生成的信息（如性能指标、兼容性要求），必须在行为契约中体现，而非仅在简报中。

## 流程概览

```
Step 1: clarify  →  行为契约 + 项目简报
Step 2: implement →  代码 + 判断日志
Step 3: verify   →  验证结果 + 判断审查
```

## 执行逻辑

### 入口

1. 检测当前环境：
   - 是否存在 `.claude/` 目录
   - 是否存在 `.claude/contracts/` 目录（行为契约存放位置）
   - 是否有已存在的行为契约（可恢复）
   - 识别技术栈（从 CLAUDE.md 或项目结构推断）

2. 识别场景：
   - **0→1**：全新 Feature，无现有行为契约
   - **1→N**：基于现有行为契约扩展
   - **修复**：基于 bug 描述定位和修复

### Step 1: clarify（理解问题，定义约束）

调用 `/clarify`：

- AI 阅读现有代码 + 同 domain 参考实现 + standards
- 基于标准澄清维度提问
- 产出行为契约草案 + 项目简报草案

**人审查**：关键判断点
- 状态机转换是否完整？
- 业务规则是否精确？
- API 边界是否清晰？
- 兼容性约束是否充分？

**状态转换（draft → approved）**：
- clarify 产出行为契约（状态: draft）
- 人审查行为契约，确认或修改
- 人确认后，将行为契约元信息中状态改为 `approved`
- 更新 registry.md 中对应 Feature 的状态为 `approved`
- **只有 approved 状态的行为契约才能进入 implement**

**输出**：`.claude/contracts/{F-ID}-{short-name}.md`（状态: approved 的行为契约）

### Step 2: implement（自动实现循环）

调用 `/implement`：

- AI 读取：行为契约 + standards + 参考代码
- 按 domain 逐个生成（控制上下文窗口）
- 每个域：生成代码 → 编译 → 测试 → 修复（最多 3 轮）
- 产出：代码 + 判断日志

**暂停条件**（人需要介入）：
- 连续 3 次编译/测试失败
- AI 遇到不确定的设计决策（标记 JD-xxx）
- 需要新增外部依赖

**人**：不被每一步打断，仅在暂停时介入

**输出**：`.claude/judgment-logs/{F-ID}-{short-name}.md`（判断日志）

### Step 3: verify（验证与判断审查）

调用 `/verify`：

- AI 自动验证：编译 + 测试 + 调用 `/analyze`（架构合规检查）
- AI 产出：变更摘要 + 判断日志
- 人审查：逐个审查判断日志中的决策
- 确认后：git commit

**输出**：代码已提交，行为契约状态更新为 done

## 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| --feature | Feature ID (如 F001-channel-recon) | 自动生成 |
| --step | 从指定步骤开始 (clarify/implement/verify) | 从 clarify 开始 |
| --domain | 指定领域 | 从行为契约推断 |
| --skip-clarify | 跳过 clarify，使用现有行为契约 | false |

## 上下文管理

| 步骤 | 加载内容 | 估算大小 |
|------|---------|---------|
| clarify | 契约模板 + 简报模板 + 澄清维度 + standards.md | ~8-10KB |
| clarify (技术栈感知) | + review-rules.md | +5KB |
| implement | 行为契约 + standards.md + patterns(按需) + 判断日志规范 | 15-40KB |
| implement (参考代码) | 同 domain 已有代码 (subagent 读取摘要) | 变动 |
| verify | 行为契约 + 判断日志 + test-standards.md | ~5-10KB |
| verify (→analyze) | review-rules.md + 行为契约(行为契约合规) | ~5-10KB |

## 状态持久化

行为契约的元信息记录 Feature 状态：

```
draft → approved → implementing → done
                ↓               ↓
              abandoned       blocked
```

### 状态转换守卫

| 当前状态 | 目标状态 | 守卫条件 | 触发 |
|---------|---------|---------|------|
| (无) | draft | 无 | clarify 生成行为契约 |
| draft | approved | 行为契约必须包含：问题定义 + 至少1条BR + 验收条件 | 人审查确认 |
| draft | abandoned | 无 | 人决定放弃 |
| approved | implementing | 行为契约已 approved + 代码目录可写 | implement 开始 |
| implementing | done | 编译通过 + 测试通过 + 判断日志中无未确认的 ⚠️ 项 | verify 通过 |
| implementing | blocked | 连续3轮编译/测试失败 或 无法解决的不确定判断 | implement 暂停 |
| blocked | implementing | 人提供了指导或确认了未决判断 | 人介入后恢复 |
| blocked | abandoned | 无 | 人决定放弃 |

### 数据流

```
clarify 产出:
  ├── .claude/contracts/{F-ID}-{short-name}.md  (行为契约，状态: draft)
  ├── .claude/briefs/{F-ID}-{short-name}.md     (项目简报，不参与代码生成)
  └── .claude/contracts/registry.md              (更新 Feature 状态为 draft)

人审查后:
  └── .claude/contracts/{F-ID}-{short-name}.md  (状态: draft → approved)

implement 读取:
  └── .claude/contracts/{F-ID}-{short-name}.md  (必须是 approved 状态)

implement 产出:
  ├── 生成的代码文件
  ├── .claude/judgment-logs/{F-ID}-{short-name}.md  (判断日志)
  └── .claude/contracts/registry.md                  (更新 Feature 状态为 implementing)

verify 读取:
  ├── .claude/contracts/{F-ID}-{short-name}.md  (验收条件)
  └── .claude/judgment-logs/{F-ID}-{short-name}.md  (判断日志审查)

verify 产出:
  ├── 验证报告（会话中展示）
  ├── .claude/contracts/registry.md            (更新 Feature 状态为 done 或保持 implementing)
  └── 判断日志确认状态更新
```

### Feature 注册表格式

`.claude/contracts/registry.md`：

```markdown
# Feature 注册表

| Feature ID | 名称 | 状态 | 行为契约 | 判断日志 | 创建时间 | 更新时间 |
|------------|------|------|---------|---------|---------|---------|
| F001-recon-task | 对账任务管理 | done | contracts/F001-recon-task.md | judgment-logs/F001-recon-task.md | 2026-05-14 | 2026-05-14 |
| F002-daily-report | 日报生成 | implementing | contracts/F002-daily-report.md | - | 2026-05-14 | 2026-05-14 |
```