---
name: state
description: "Feature 状态追踪命令。查看行为契约的实现状态。"
arguments: "[feature-id]"
---

# /state — Feature 状态追踪

查看行为契约的实现状态，跟踪 Feature 从定义到完成的全生命周期。

## 用法

```
/state [feature-id]
```

- `feature-id`: Feature ID，如 `F001-recon-task`。不指定时列出所有 Feature 及其状态。

## 状态机

```
draft → approved → goal-running → done
  ↓                   ↓
abandoned           blocked
```

| 状态 | 含义 | 可转换到 |
|------|------|---------|
| draft | 行为契约草稿，待审查 | approved, abandoned |
| approved | 行为契约已批准，可设置 /goal | goal-running, abandoned |
| goal-running | /goal 循环中，AI 自主执行 | done, blocked, abandoned |
| done | goal achieved，验收通过 | -（终态） |
| abandoned | 已废弃 | draft（重新激活） |
| blocked | /goal 中断（8-block 安全阀），等待人介入 | goal-running, abandoned |

## 执行逻辑

1. **不指定 feature-id**：读取 `.claude/contracts/registry.md`，展示所有 Feature 的状态概览。
2. **指定 feature-id**：展示该 Feature 的详细信息：
   - 当前状态及进入时间
   - 状态转换历史
   - 已完成/未完成的验收条件
   - 判断日志状态（已确认/待确认数量）
   - 阻塞原因（如果是 blocked 状态）

## 示例

```
> /state

📊 Feature 状态概览

  F001-recon-task       goal-running   ██████████░░░░  70%  3/5 验收条件通过
  F002-settlement       approved       ░░░░░░░░░░░░░░   0%  待设置 /goal
  F003-merchant-import  draft          ░░░░░░░░░░░░░░   0%  待审查

> /state F001-recon-task

📊 F001-recon-task — goal-running

  当前状态: goal-running（进入时间: 2026-05-13 10:00）
  行为契约: .claude/contracts/F001-recon-task.md
  判断日志: .claude/judgment-logs/F001-recon-task.md

  验收条件:
  ✅ 创建对账任务幂等校验 —— 通过
  ✅ 状态机完整转换 —— 通过
  ✅ 对账比对逻辑 —— 通过
  ⬜ 人工确认权限控制 —— 未验证
  ⬜ 超时自动失败 —— 未验证

  判断审查:
  已确认: 5/8  |  待确认: 3
```