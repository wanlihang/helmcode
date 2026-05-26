---
feature: F001-recon-task
generated: 2026-05-13T14:30:00
domains: [recon]
total-judgments: 8
uncertain-judgments: 3
---

# 判断日志 - 对账任务（ReconTask）

## 已做判断

- [JD-001] 使用策略模式处理多渠道数据源，DataProvider 接口定义统一的数据拉取和标准化方法，各渠道实现类独立
  参考: contract BR-002 "支持策略模式扩展新渠道"

- [JD-002] 幂等基于数据库唯一索引 (merchant_id + bill_month)，查询时过滤终态状态，应用层先查后插保证不存在活跃任务
  参考: contract BR-001 "同一商户同一账期只能有一个非终态的对账任务"

- [JD-003] Entity 使用 @Getter/@Setter 不使用 @Data，符合编码标准
  参考: standards/java-ddd/standards.md §2 注解规则

- [JD-004] Facade 返回类型使用 Result<T> 包装，Facade 方法使用 @FacadeIntercept 注解
  参考: standards/java-ddd/standards.md §6 Facade 规范

- [JD-005] 状态机使用 Enum + 守卫方法实现，不引入 Spring Statemachine 框架，保持轻量
  参考: standards/java-ddd/standards.md §1 分层与依赖（减少外部依赖）

## 需要确认

- [JD-006] ⚠️ PROCESSING → FAILED 超时检测实现方式
  原因: 行为契约 BR-005 写"超时30分钟"，但 Scheduler 每5分钟轮询一次，实际超时判断可能有5-10分钟误差。行为契约未指定超时精度要求。
  选项: A: 接受5-10分钟误差，使用 Scheduler 轮询检查（简单实现，与项目中其他超时处理方式一致）, B: 使用延迟队列精确超时，到时间点精确触发（复杂实现，引入新组件）
  建议: A（与项目中其他超时处理方式一致，且对账对精度要求不高）

- [JD-007] ⚠️ confirm 操作是否需要操作日志（@SalLog）
  原因: 行为契约未明确记录审计日志，但项目中 OrderManageFacade 的 confirm 类操作使用了 @SalLog 注解记录操作日志。对账确认涉及资金核对，审计要求可能更高。
  选项: A: 添加 @SalLog 记录审计日志（与项目惯例一致，满足审计要求）, B: 不添加，仅记录 confirmUserId/confirmComment 字段（行为契约未要求）
  建议: A（对账确认涉及财务操作，审计日志是必要的，且保持项目一致性）

- [JD-008] ⚠️ 差异记录（ReconDiffRecord）是否作为 ReconTask 聚合内的实体
  原因: 差异记录在业务上属于对账任务的一部分，但数据量可能很大（单次对账可能有数千条差异记录），聚合内加载大量子实体可能影响性能。
  选项: A: 差异记录作为聚合内实体，通过 ReconTask 聚合根统一管理生命周期（DDD 纯粹，简单场景性能可接受）, B: 差异记录独立聚合，通过 taskId 关联，在 Application Service 中协调（性能更好，但增加复杂度）, C: 折中方案——聚合内定义差异记录操作接口，但使用延迟加载，实际查询走独立 Repository
  建议: C（兼顾 DDD 模型完整性和性能，差异记录通过聚合根行为创建，但独立查询和分页加载）