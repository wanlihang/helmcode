---
name: checkpoint
description: "判断审查命令。goal achieved 后审查 AI 的设计决策，确认或修改 ⚠️ 项的当前选择。"
arguments: "[feature-id]"
---

# /checkpoint — 判断审查（goal achieved 后执行）

在 `/goal` 达成后执行，审查 AI 在自主循环中做出的设计决策。

## 用法

```
/checkpoint [feature-id]
```

- `feature-id`: Feature ID，如 `F001-recon-task`。不指定时列出所有待审查的判断日志。

## 执行逻辑

1. **读取判断日志**：从 `.claude/judgment-logs/{feature-id}.md` 读取判断日志。
   - 如果未指定 feature-id，扫描 `.claude/judgment-logs/` 目录，列出所有判断日志及其中需要确认的判断数量。

2. **展示已做判断**（Confirmed Judgments）：
   - 逐条展示 JD-xxx 及参考依据。
   - 用户可快速扫过，仅对有疑问的标记 ✗。
   - 无异议的判断默认通过。

3. **展示需要确认的判断**（Uncertain Judgments）：
   - 必须逐个审查。
   - 展示问题描述、原因、选项、AI 建议、**当前选择**（goal loop 中 AI 用的默认选项）。
   - 用户确认当前选择可接受（✅），或选择其他选项（修改代码）。
   - 记录用户决策到判断日志。

4. **处理修改**：
   - 如果用户选择了与"当前选择"不同的选项 → 需要代码修改
   - 建议用户设置新的 `/goal` 来完成修改
   - 修改完成后再次 checkpoint 或直接 commit

5. **输出审查结果**：
   - 总结已确认/已修改/待定的判断数量。
   - 所有判断确认后，更新行为契约状态为 done，建议 git commit。

## 设计原则

- **已做判断**：AI 有明确依据的决策，用户一扫而过即可。
- **需要确认**：AI 在 goal loop 中用默认选择推进的决策，用户必须确认是否接受。

## 示例

```
> /checkpoint F001-recon-task

📋 判断日志 - F001-recon-task（8 条判断，3 条需要确认）

━━━ 已做判断 ━━━

✅ [JD-001] 使用策略模式处理多渠道数据源
   参考: contract BR-002

✅ [JD-002] 幂等基于数据库唯一索引 (merchant_id + bill_month)
   参考: contract BR-001

━━━ 需要确认 ━━━

⚠️ [JD-006] PROCESSING → FAILED 超时检测实现方式
   原因: 行为契约未指定超时精度要求
   选项: A: Scheduler 轮询, B: 延迟队列精确超时
   当前选择: A（与项目其他超时处理一致）
   → 确认当前选择? (✅ 确认 / 选B 修改)

⚠️ [JD-007] confirm 操作是否需要操作日志
   原因: 行为契约未明确，但项目惯例使用 @SalLog
   选项: A: 添加 @SalLog, B: 不添加
   当前选择: A（涉及资金操作，审计必要）
   → 确认当前选择? (✅ 确认 / 选B 修改)
```