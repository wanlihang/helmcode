---
name: dev-flow
description: |
  AI 编程主工作流。goal 驱动的自主循环：clarify → /goal → checkpoint。
  人定义终点和关键航标，AI 自主划到终点。

  触发场景：
  - 用户说"开发新功能"、"实现需求"、"做一个xxx"
  - 用户描述了一个需求或 Feature
  - 用户提到 "dev-flow"、"开发流程"

  注意：此技能利用 Claude Code 的 /goal 机制驱动自主执行闭环，
  Haiku 评估器作为独立第三方验证完成条件，替代传统的 self-check。
version: 3.0
author: HelmCode
tags: [workflow, dev-flow, goal, AI编程]
---

# dev-flow: AI 编程主工作流

## 核心理念

人定义终点，AI 自主到达。具体来说：
- 人定义：行为契约（终点）+ 验收条件（什么叫做到了）
- AI 自主执行：通过 `/goal` 驱动循环，直到验收条件全部满足
- 人只审查：goal achieved 后，审查判断日志中的关键决策

## 上下文隔离约定

行为契约（`.claude/contracts/`）是 AI 代码生成的唯一输入源。项目简报（`.claude/briefs/`）仅供人阅读。

| 目录 | clarify | implement | verify | 人 |
|------|---------|-----------|--------|---|
| contracts/ | ✅ 读取/写入 | ✅ 读取 | ✅ 读取 | ✅ 审查 |
| briefs/ | ✅ 写入 | ❌ 禁止读取 | ❌ 禁止读取 | ✅ 阅读 |
| judgment-logs/ | ❌ | ✅ 写入 | ✅ 读取/更新 | ✅ 审查 |

## 流程概览

```
Phase 1: clarify  →  行为契约（人审批：draft → approved）
Phase 2: /goal    →  AI 自主循环（implement → verify → fix → verify → ...）
Phase 3: checkpoint → 人审查判断日志（goal achieved 后）
```

## 执行逻辑

### 入口

1. 检测当前环境：
   - 是否存在 `.claude/` 目录
   - 是否存在 `.claude/contracts/` 目录
   - 是否有已存在的行为契约（可恢复）
   - 识别技术栈（从 CLAUDE.md 或项目结构推断）

2. 识别场景：
   - **0→1**：全新 Feature，无现有行为契约
   - **1→N**：基于现有行为契约扩展
   - **修复**：基于 bug 描述定位和修复

### Phase 1: clarify（理解问题，定义约束）

调用 `/clarify`：

- AI 阅读现有代码 + 同 domain 参考实现 + standards
- 基于标准澄清维度提问
- 产出行为契约草案 + 项目简报草案

**人审查**：关键判断点
- 状态机转换是否完整？
- 业务规则是否精确？
- API 边界是否清晰？
- 验收条件是否可程序验证？

**状态转换（draft → approved）**：
- clarify 产出行为契约（状态: draft）
- 人审查行为契约，确认或修改
- 人确认后，将行为契约元信息中状态改为 `approved`
- 更新 registry.md 中对应 Feature 的状态为 `approved`

**输出**：`.claude/contracts/{F-ID}-{short-name}.md`（状态: approved 的行为契约）

### Phase 2: /goal（自主执行闭环）

**设置 goal 条件**：

按照 `references/goal-condition-builder.md`，从行为契约的验收条件推导 `/goal` 条件：

```
/goal {F-ID} 编译零错误，{测试命令} 全部通过，
verify-field-sync 全部 ✅，verify-arch-rules 全部 ✅，
完成后展示验收条件逐条检查结果
```

**goal 循环内 AI 自主执行**：

每个 turn 内，AI 执行以下动作：

1. **读取上下文**：行为契约 + standards + patterns + 参考代码
2. **生成代码**：按 standards 和 patterns 生成，产出判断日志
3. **运行验证**：
   - 编译检查（`mvn compile` / `npm run build`）
   - 测试（`mvn test` / `npm test`）
   - 字段同步脚本（`node verify-field-sync.mjs`）
   - 架构合规脚本（`node verify-arch-rules.mjs`）
4. **如果验证失败**：分析错误，修复代码，回到步骤 2
5. **如果验证通过**：产出验收条件逐条检查结果

**Haiku 评估器判断**：
- 看到 "BUILD SUCCESS" + "Failures: 0" + 脚本全部 ✅ + 验收条件检查结果 → goal achieved
- 看不到这些信号 → 继续下一个 turn

**安全阀**：
- 8 consecutive block 后自动停止，交还控制权给人
- 人可以随时 Escape 中断，提供指导后继续

**输出**：
- 生成的代码文件
- `.claude/judgment-logs/{F-ID}-{short-name}.md`（判断日志）
- 更新 `.claude/contracts/registry.md`（状态: goal-running）

### Phase 3: checkpoint（判断审查）

goal achieved 后，调用 `/checkpoint`：

- 展示判断日志中的已做判断和需要确认的 ⚠️ 项
- 人逐个审查 ⚠️ 项，做出选择
- 如果 ⚠️ 项需要代码修改 → 设置新的 `/goal` 继续循环
- 如果 ⚠️ 项全部解决 → git commit，行为契约状态 → done

## 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| --feature | Feature ID (如 F001-channel-recon) | 自动生成 |
| --phase | 从指定阶段开始 (clarify/goal/checkpoint) | 从 clarify 开始 |
| --skip-clarify | 跳过 clarify，使用现有行为契约 | false |
| --auto | 同时启用 auto-approve 模式（无工具权限提示） | false |

## 上下文管理

| 阶段 | 加载内容 | 估算大小 |
|------|---------|---------|
| clarify | 契约模板 + 简报模板 + 澄清维度 + standards.md | ~8-10KB |
| clarify (技术栈感知) | + review-rules.md | +5KB |
| goal 循环 | 行为契约 + standards.md + patterns(按需) + 判断日志规范 | 15-40KB |
| goal 循环 (参考代码) | 同 domain 已有代码 (subagent 读取摘要) | 变动 |
| checkpoint | 判断日志 | 1-3KB |

## 状态持久化

行为契约的元信息记录 Feature 状态：

```
draft → approved → goal-running → done
                ↓                  ↓
              abandoned          blocked
```

### 状态转换守卫

| 当前状态 | 目标状态 | 守卫条件 | 触发 |
|---------|---------|---------|------|
| (无) | draft | 无 | clarify 生成行为契约 |
| draft | approved | 验收条件全部可程序验证 | 人审查确认 |
| draft | abandoned | 无 | 人决定放弃 |
| approved | goal-running | 行为契约已 approved | 设置 /goal |
| goal-running | done | goal achieved + 判断日志 ⚠️ 全部处理 | checkpoint 完成 |
| goal-running | blocked | 8-consecutive-block 安全阀触发 | goal 中断 |
| blocked | goal-running | 人提供了指导 | 人介入后恢复 |
| blocked | abandoned | 无 | 人决定放弃 |

### 数据流

```
Phase 1: clarify 产出:
  ├── .claude/contracts/{F-ID}-{short-name}.md  (行为契约，状态: draft)
  ├── .claude/briefs/{F-ID}-{short-name}.md     (项目简报，不参与代码生成)
  └── .claude/contracts/registry.md              (更新 Feature 状态为 draft)

人审查后:
  └── .claude/contracts/{F-ID}-{short-name}.md  (状态: draft → approved)

Phase 2: /goal 循环内产出:
  ├── 生成的代码文件
  ├── .claude/judgment-logs/{F-ID}-{short-name}.md  (判断日志)
  └── .claude/contracts/registry.md                  (更新 Feature 状态为 goal-running)

Phase 3: checkpoint 产出:
  ├── .claude/contracts/registry.md            (更新 Feature 状态为 done 或保持 goal-running)
  └── 判断日志确认状态更新
```

### Feature 注册表格式

`.claude/contracts/registry.md`：

```markdown
# Feature 注册表

| Feature ID | 名称 | 状态 | 行为契约 | 判断日志 | 创建时间 | 更新时间 |
|------------|------|------|---------|---------|---------|---------|
| F001-recon-task | 对账任务管理 | done | contracts/F001-recon-task.md | judgment-logs/F001-recon-task.md | 2026-05-14 | 2026-05-14 |
| F002-daily-report | 日报生成 | goal-running | contracts/F002-daily-report.md | - | 2026-05-14 | 2026-05-14 |
```
