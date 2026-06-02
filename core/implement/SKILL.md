---
name: implement
description: |
  代码生成与判断日志产出。作为 /goal 循环内的 worker 执行，
  不再是独立的手动步骤。由 dev-flow 的 /goal 机制驱动循环。

  触发场景：
  - dev-flow Phase 2 /goal 循环内自动执行
  - 用户指向一个已批准的行为契约

  注意：此技能在 /goal 循环内被反复调用。每次执行是一个 turn：
  读取上下文 → 生成代码 → 运行验证 → 如果失败则修复。
  /goal 的 Haiku 评估器负责判断是否完成。
version: 2.0
author: HelmCode
tags: [implement, 代码生成, 判断日志, goal-worker]
---

# implement: 代码生成（goal loop worker）

## 核心理念

1. 作为 `/goal` 循环内的 worker，每个 turn 完成一部分工作
2. 产出判断日志，暴露设计决策供 goal achieved 后 /checkpoint 审查
3. 不确定的设计决策标记 ⚠️，但不停下来 — 继续用默认选择推进
4. 验证失败时自动分析修复，不需要人介入

## 与 /goal 的关系

```
/goal 设置完成条件
    │
    ├─ Turn 1: implement 读取契约 → 生成代码 → 跑验证 → 有失败
    │   Haiku: "还没完成" → 继续
    │
    ├─ Turn 2: implement 分析错误 → 修复代码 → 跑验证 → 有失败
    │   Haiku: "还没完成" → 继续
    │
    ├─ Turn 3: implement 修复代码 → 跑验证 → 全部通过
    │   Haiku: "完成条件满足" → goal achieved
    │
    └─ /checkpoint: 人审查判断日志
```

## 执行逻辑

### Phase 1: 准备上下文

按照 `references/context-loader.md` 执行上下文加载：

**第一层：必须加载（主会话）**
1. 行为契约：`.claude/contracts/{F-ID}-{short-name}.md`
2. 编码标准：`.claude/standards/standards.md`

**第二层：按需加载 patterns（主会话）**

按 `references/context-loader.md` 的推断规则，根据行为契约为内容加载需要的 patterns：

| 行为契约包含 | 加载 |
|-------------|------|
| 领域模型章节 | `.claude/standards/patterns/entity.md` |
| API 契约章节 | `.claude/standards/patterns/facade.md` |
| 聚合根（AggregateRoot） | `.claude/standards/patterns/aggregate.md` |
| Repository | `.claude/standards/patterns/repository.md` |
| 写操作（create/update/delete） | `.claude/standards/patterns/application-service.md` |
| 多类型/多渠道/多策略 | `.claude/standards/patterns/strategy.md` |
| 复杂构造逻辑 | `.claude/standards/patterns/builder.md` |
| 领域事件 | `.claude/standards/patterns/domain-event.md` |
| 外部集成客户端 | `.claude/standards/patterns/integration-client.md` |
| 测试代码 | `.claude/standards/patterns/test.md` |

**第三层：参考代码（Subagent 读取）**

使用 Subagent 搜索同 domain 已有代码，提取模式摘要（非全文代码）。

**禁止加载**：
- ❌ `.claude/briefs/`（项目简报不参与代码生成）
- ❌ `test-standards.md`（verify 阶段使用）
- ❌ `examples/`（示例不用于代码生成）

**上下文预算**：主会话 15-40KB，超过 40KB 时分 domain 批次生成。

### Phase 2: 影响面追踪

在生成代码之前，先分析行为契约涉及的所有变更点的影响面。

1. **提取变更点**：
   - 行为契约"领域模型"章节中的每个实体/字段变更
   - 行为契约"Schema 变更"章节中的每个 DDL
   - 行为契约"API 契约"章节中的每个接口变更

2. **扫描影响面**（使用 Subagent 搜索）：
   - 对每个变更的 Entity/DO，搜索所有引用该类的代码位置
   - 对每个新增/修改字段，搜索所有 get/set/convert/query 引用

3. **生成修改清单**：
   ```markdown
   ### 修改清单 - {F-ID}

   #### 领域模型变更
   - ReconTask 新增 confirmedBy/gmtConfirmed/confirmRemark 字段
     - [ ] Entity: ReconTaskEntity.java — 新增字段 + confirm/reject 方法
     - [ ] DO: ReconTaskDO.java — 新增字段
     - [ ] Convert: ReconTaskConvert.java — 新增字段映射
     - [ ] Mapper: ReconTaskMapper.xml — resultMap + query 新增字段
     - [ ] VO: ReconTaskVO.java — 新增展示字段
     - [ ] Command: ConfirmCommand.java — 新增请求字段
     - [ ] Service: ReconTaskService.java — 新增 confirm/reject 逻辑
     - [ ] Facade: ReconFacade.java — 新增 confirm/reject 接口
   ```

### Phase 3: 按 Domain 逐个生成

对行为契约中的每个 domain：

1. **生成代码**（对照修改清单逐项完成）
2. **遗漏自查**：所有修改清单项是否已全部标记 `[x]`
3. **产出判断日志**（参见 `references/judgment-log-format.md` + `references/judgment-heuristics.md`）

**⚠️ 项处理策略（与 v1 的关键区别）**：

遇到不确定的设计决策时：
- **不停下来** — 用最合理的默认选择继续推进
- 在判断日志中标记为 ⚠️ 并记录备选方案
- goal achieved 后由 /checkpoint 让人审查

只有以下情况才需要中断等待人介入（由 /goal 的 8-block 安全阀处理）：
- 连续多轮修复无法通过编译或测试
- 上下文窗口压力导致质量下降

### Phase 4: 运行验证

每个 domain 生成完毕后，运行验证：

1. **编译检查**：运行项目编译命令，确认零编译错误
2. **测试验证**：运行相关 domain 的测试，确认测试通过
3. **字段同步检查**：运行 `node .claude/scripts/verify-field-sync.mjs --contract .claude/contracts/{F-ID}.md --project .`（如果脚本存在）
4. **架构合规检查**：运行 `node .claude/scripts/verify-arch-rules.mjs --project .`（如果脚本存在）

**验证失败时**：分析错误，修复代码，不等待人介入。修复后重新验证。

**验证结果出现在会话中**：供 Haiku 评估器判断 goal 是否达成。

### Phase 5: 判断日志产出

汇总判断日志写入 `.claude/judgment-logs/{F-ID}-{short-name}.md`：

```markdown
## 生成判断日志 - {F-ID}

### 已做判断
- [JD-001] {决策描述}
  参考: {standards/patterns/contract 中的具体位置}

### 需要确认
- [JD-xxx] ⚠️ {不确定的决策}
  原因: {为什么不确定}
  选项: A: {...}, B: {...}
  建议: {推荐选项}
  当前选择: {实际用了哪个选项，因为不能停下来等}
```

## 前置条件

- 行为契约存在且状态为 `approved`（检查 registry.md）
- 行为契约包含问题定义 + 至少1条业务规则 + 验收条件（可程序验证）
- 编码标准文件存在（`.claude/standards/standards.md`）

## 后置条件

- 生成的代码文件已写入目标目录
- 产出 `.claude/judgment-logs/{F-ID}-{short-name}.md`（判断日志）
- 更新 `.claude/contracts/registry.md`（状态: goal-running）
- 验证结果出现在会话中（供 Haiku 评估器判断）

## 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| --feature | Feature ID 或行为契约文件路径 | 必须 |
| --domain | 只生成指定 domain | 全部 |
