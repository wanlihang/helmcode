---
name: implement
description: |
  自动实现循环。读取行为契约和编码标准，生成代码，产出判断日志。
  核心特点：按 domain 逐个生成，产出判断日志暴露设计决策，3轮失败暂停。

  触发场景：
  - dev-flow Step 2 自动调用
  - 用户说"实现这个 Feature"、"开始编码"
  - 用户指向一个已批准的行为契约

  注意：此技能不是简单地按模板生成代码，而是基于行为契约的约束
  和 standards 的规范，做出设计决策并记录在判断日志中供人审查。
version: 1.1
author: HelmCode
tags: [implement, 代码生成, 判断日志, 自动实现]
---

# implement: 自动实现循环

## 核心理念

1. 按 domain 逐个生成，控制上下文窗口
2. 产出判断日志，暴露设计决策供人审查
3. 3 轮失败暂停，避免无限循环
4. 不确定时主动标记，请求人介入

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

**第三层：参考代码（Subagent 读取）**

使用 Subagent 搜索同 domain 已有代码，提取模式摘要（非全文代码）：
- `**/domain/model/{domain}/` — 参考字段风格
- `**/facade/{domain}/` — 参考接口风格
- `**/application/service/{domain}/` — 参考事务编排

**禁止加载**：
- ❌ `.claude/briefs/`（项目简报不参与代码生成）
- ❌ `test-standards.md`（verify 阶段使用）
- ❌ `examples/`（示例不用于代码生成）
- ❌ 非 current domain 的行为契约

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
   - 对每个 API 变更，搜索所有调用方和实现方

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

   #### Schema 变更
   - recon_task 表新增 3 个字段
     - [ ] DDL 脚本
     - [ ] Mapper XML 同步
   ```

4. **将修改清单纳入生成流程**：
   - Phase 3 生成代码时，逐项对照修改清单
   - 每完成一项标记 `[x]`
   - 生成完成后自查：是否有清单项遗漏

### Phase 3: 按 Domain 逐个生成

对行为契约中的每个 domain：

1. **生成代码**（对照修改清单逐项完成）：
   - 按照 standards 的分层规则生成代码
   - 参照 patterns 的代码模式
   - 遵循行为契约的精确约束（字段、方法、状态机、业务规则）
   - **每生成一个文件后，对照修改清单标记完成项**

2. **遗漏自查**：
   - 所有修改清单项是否已全部标记 `[x]`
   - 新增字段在 Entity/DO/Convert/Mapper/VO/Command 中是否全部同步
   - CRUD 操作中新增字段是否都有赋值和查询
   - 未完成项在判断日志中标记为 JD-xxx ⚠️

3. **编译验证**：
   - 运行编译命令
   - 如果编译失败，分析错误并修复
   - 最多 3 轮

4. **测试验证**：
   - 根据行为契约的验收条件 + test-standards 自动推导测试
   - 运行测试
   - 如果测试失败，分析错误并修复
   - 最多 3 轮

5. **产出判断日志**（参见 `references/judgment-log-format.md` + `references/judgment-heuristics.md`）：
   - 按 judgment-heuristics.md 的决策树判断哪些选择需要记录
   - 记录每个有选择的设计决策（已做判断 JD-xxx）
   - 标记不确定的决策（需要确认 JD-xxx ⚠️）
   - 记录修改清单中未完成或无法确认的项
   - 引用标准和行为契约中的规则来源
   - 判断密度参考：简单 CRUD 2-5 条，标准业务 5-10 条，复杂业务 10-20 条

### Phase 4: 判断日志产出

每个 domain 生成完毕后，汇总判断日志：

```markdown
## 生成判断日志 - {F-ID}

### 已做判断
- [JD-001] {决策描述}
  参考: {standards/patterns/contract 中的具体位置}
- [JD-002] ...

### 需要确认
- [JD-xxx] ⚠️ {不确定的决策}
  原因: {为什么不确定}
  选项: A: {...}, B: {...}
```

### 暂停条件

以下情况暂停实现，请求人介入：

1. **编译/测试连续 3 轮失败**：
   - 输出当前状态和错误信息
   - 标记阻塞点
   - 等待人提供指导

2. **遇到不确定的设计决策**：
   - 行为契约中未明确的选择点
   - 多种实现方式可选且无法从 standards 推断
   - 标记为 JD-xxx，继续生成其他部分

3. **需要新增外部依赖**：
   - 不得自主引入新的 Maven/Gradle/npm 依赖
   - 暂停并请求人确认

4. **上下文窗口压力**：
   - 当感觉生成质量下降时（重复代码、不一致命名）
   - 建议用 `/clear` 清理上下文后继续

## 前置条件

- 行为契约存在且状态为 `approved`（检查 registry.md）
- 行为契约包含问题定义 + 至少1条业务规则 + 验收条件
- 编码标准文件存在（`.claude/standards/standards.md`）
- 目标代码目录可写

**若前置条件不满足**：
- 行为契约不存在 → 提示先执行 clarify
- 行为契约状态为 draft → 提示先审查并批准行为契约
- standards 不存在 → 提示先运行 loader 安装标准

## 后置条件

- 生成的代码文件已写入目标目录
- 产出 `.claude/judgment-logs/{F-ID}-{short-name}.md`（判断日志）
- 更新 `.claude/contracts/registry.md`（状态: implementing）
- 编译通过（如果项目可编译）
- 判断日志中标记了 ⚠️ 的未确认项被明确列出

## 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| --feature | Feature ID 或行为契约文件路径 | 必须 |
| --domain | 只生成指定 domain | 全部 |
| --max-retries | 编译/测试最大重试次数 | 3 |
| --skip-tests | 跳过测试生成 | false |

## 输出

- 生成的代码文件
- `.claude/judgment-logs/{F-ID}-{short-name}.md` — 判断日志