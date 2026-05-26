# 判断日志格式规范

## 什么是判断日志

判断日志记录 AI 在代码生成过程中的设计决策。它是 implement 技能的核心产出之一，
让人能够聚焦审查 AI 的关键判断，而不是审查整个 diff。

## 判断分类

### 已做判断（Confirmed Judgments）

AI 基于行为契约和编码标准已经做出的决策，有明确的依据。
用户可以快速扫过，仅针对有疑问的标记 ✗。

格式：
```
- [JD-{NNN}] {一句话决策描述}
  参考: {依据来源}
```

示例：
```
- [JD-001] 使用策略模式处理多渠道数据源，因为行为契约中暗示了多种数据源类型
  参考: contract BR-003 "支持多种数据提供方"
- [JD-002] 幂等基于数据库唯一索引(bill_month + data_provider_inst_id)
  参考: standards/patterns/facade.md § 幂等处理
- [JD-003] Entity 使用 @Getter/@Setter 不使用 @Data
  参考: standards/review-rules.md § Lombok 规则
- [JD-004] Facade 返回类型使用 Result<T> 包装
  参考: standards/patterns/facade.md
```

### 需要确认（Uncertain Judgments）

AI 遇到行为契约和编码标准都未明确的情况，需要人做决策。
用户必须逐个审查并给出选择。

格式：
```
- [JD-{NNN}] ⚠️ {问题描述}
  原因: {为什么 AI 无法自行决定}
  选项: A: {选项A描述}, B: {选项B描述}
  建议: {AI 的推荐，如果有}
```

示例：
```
- [JD-005] ⚠️ PROCESSING→FAILED 超时误差处理
  原因: 行为契约 BR-001 写"超时30分钟"，但 Scheduler 每5分钟检查一次，
        实际超时判断可能有5-10分钟误差
  选项: A: 接受5-10分钟误差（简单实现）, B: 使用延迟队列精确超时（复杂实现）
  建议: A（与项目中其他超时处理方式一致）

- [JD-006] ⚠️ confirm 操作是否需要操作日志(@SalLog)
  原因: 行为契约未明确，但项目中 OrderManageFacade 使用了 @SalLog
  选项: A: 添加 @SalLog（与项目惯例一致）, B: 不添加（行为契约未要求）
  建议: A（保持项目一致性）
```

## 判断 ID 编号规则

- 格式：JD-{NNN}，从 001 开始
- 同一个 Feature 的判断日志统一编号
- 编号在判断日志文件内唯一

## 什么需要记录

**必须记录的判断**：
- 架构决策（分层、模式选择）
- 状态机实现方式
- 幂等策略
- 并发处理策略
- 外部集成方式
- 行为契约中有歧义的规则的解读

**不需要记录的判断**：
- 编码标准中有明确规定的（如用 @Getter/@Setter）
- 项目统一约定的（如包命名规则）
- 唯一选择的决策（没有其他选项）

## 判断日志文件

存放位置：`.claude/judgment-logs/{F-ID}-{short-name}.md`

文件头：
```markdown
---
feature: {F-ID}-{short-name}
generated: {datetime}
domains: [{domain1}, {domain2}]
total-judgments: {N}
uncertain-judgments: {M}
---

# 判断日志 - {Feature 名称}

## 已做判断
{JD-001 ~ JD-N}

## 需要确认
{JD-xxx ~ JD-M}
```