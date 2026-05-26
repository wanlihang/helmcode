---
name: checkpoint
description: "关键判断审查命令。审查 AI 生成过程中的设计决策，而非文档完整性。"
arguments: "[feature-id]"
---

# /checkpoint — 关键判断审查

审查 AI 在代码生成过程中的设计决策，而非文档完整性。

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
   - 展示问题描述、原因、选项、AI 建议。
   - 用户选择选项（A/B/C）或给出其他决策。
   - 记录用户决策到判断日志。

4. **输出审查结果**：
   - 总结已确认/已修改/待定的判断数量。
   - 如有待定判断，提示需要再次审查。
   - 所有判断确认后，更新行为契约状态。

## 设计原则

人的判断力是最稀缺资源。checkpoint 聚焦于"AI 的判断对不对"，让人只审关键决策点，而不是审整个 diff。

- **已做判断**：AI 有明确依据的决策，用户一扫而过即可。
- **需要确认**：行为契约和编码标准都未明确的情况，用户必须做出决策。

## 示例

```
> /checkpoint F001-recon-task

📋 判断日志 - F001-recon-task（8 条判断，3 条需要确认）

━━━ 已做判断 ━━━

✅ [JD-001] 使用策略模式处理多渠道数据源
   参考: contract BR-002

✅ [JD-002] 幂等基于数据库唯一索引 (merchant_id + bill_month)
   参考: contract BR-001

✅ [JD-003] Entity 使用 @Getter/@Setter 不使用 @Data
   参考: standards §2 注解规则

✅ [JD-004] Facade 返回类型使用 Result<T> 包装
   参考: standards §6 Facade 规范

✅ [JD-005] 状态机使用 Enum + 守卫方法实现
   参考: standards §1 分层与依赖

━━━ 需要确认 ━━━

⚠️ [JD-006] PROCESSING → FAILED 超时检测实现方式
   原因: 行为契约未指定超时精度要求
   选项: A: Scheduler 轮询（接受5-10分钟误差）, B: 延迟队列精确超时
   建议: A
   → 请选择: _

⚠️ [JD-007] confirm 操作是否需要操作日志
   原因: 行为契约未明确，但项目惯例使用 @SalLog
   选项: A: 添加 @SalLog, B: 不添加
   建议: A
   → 请选择: _

⚠️ [JD-008] 差异记录是否作为聚合内实体
   原因: 数据量大可能影响性能
   选项: A: 聚合内实体, B: 独立聚合, C: 折中方案
   建议: C
   → 请选择: _
```