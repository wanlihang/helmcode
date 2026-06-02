# 上下文加载规则

> 定义 implement skill 的精确上下文管理策略，确保只加载必需内容。

## 加载层次

### 第一层：必须加载（每次 implement）

| 内容 | 路径 | 估算大小 | 加载方式 |
|------|------|---------|---------|
| 行为契约 | `.claude/contracts/{F-ID}-{short-name}.md` | 2-5KB | 主会话 |
| 编码标准 | `.claude/standards/standards.md` | 3-5KB | 主会话 |
| 判断日志格式 | `implement/references/judgment-log-format.md` | 2KB | 主会话（首次） |
| 判断启发规则 | `implement/references/judgment-heuristics.md` | 3KB | 主会话（首次） |

**合计：~10-15KB**

### 第二层：按需加载（根据行为契约推断）

根据行为契约内容推断需要加载的 patterns：

| 行为契约包含 | 需要加载的 pattern | 大小 |
|-------------|-------------------|------|
| 领域模型（Entity/值对象/枚举） | .claude/standards/patterns/entity.md | 3KB |
| API 契约（Facade 方法） | .claude/standards/patterns/facade.md | 3KB |
| 聚合根 | .claude/standards/patterns/aggregate.md | 2KB |
| 仓储/数据访问 | .claude/standards/patterns/repository.md | 3KB |
| 简单 CRUD 写操作（≤3 步,整体一个事务） | .claude/standards/patterns/application-service.md | 2KB |
| 多步编排 / 状态机分支 | .claude/standards/patterns/handler.md | 18KB |
| 业务受理（跨字段校验 / 状态前置 / 权限） | .claude/standards/patterns/acceptor.md | 9KB |
| 策略模式/多渠道/多类型 | .claude/standards/patterns/strategy.md | 2KB |
| Builder/复杂构造 | .claude/standards/patterns/builder.md | 1KB |

**推断规则**：
1. 行为契约有"领域模型"章节 → 加载 entity.md
2. 行为契约有"API 契约"章节 → 加载 facade.md
3. 领域模型标注了 AggregateRoot → 加载 aggregate.md
4. 领域模型有 Repository → 加载 repository.md
5. API 契约写操作 ≤3 步且整体一个事务 → 加载 application-service.md
6. API 契约 ≥4 步,**或**需细粒度事务边界控制,**或**含审批回调/状态机分支 → 加载 handler.md（含 StatefulHandlerTemplate）
7. API 契约涉及状态前置检查 / 跨字段校验 / 权限判断 → 加载 acceptor.md
8. 业务规则涉及"多类型"/"多渠道"/"多策略" → 加载 strategy.md
9. 领域模型有复杂构造逻辑（多步骤创建） → 加载 builder.md

> **编排路径决策(按从上往下,第一个命中即定)**:
> 1. 含审批回调/状态机分支 → handler.md(StatefulHandlerTemplate 段)
> 2. ≥4 步,**或**需细粒度事务边界控制 → handler.md + acceptor.md
> 3. ≤3 步且整体一个事务 → application-service.md
>
> 动作步数从契约的"业务规则/流程"段计数:一次 DB 写入或一次外部调用 = 一步。
> 详见 `.claude/standards/standards.md` §0.3。

**典型加载 3-4 个 pattern，合计 ~10KB**

### 第三层：Subagent 加载（参考代码）

不完全加载到主会话，由 subagent 读取参考代码并提取模式：

| 搜索策略 | 路径模式 | 用途 |
|---------|---------|------|
| 同 domain 已有 Entity | `**/domain/model/{domain}/` | 参考字段风格、命名约定 |
| 同 domain 已有 Facade | `**/facade/{domain}/` | 参考接口风格、错误码 |
| 同 domain 已有 Repository | `**/infrastructure/repository/` | 参考 DO 映射、Mapper 写法 |
| 同 domain 已有 Service | `**/application/service/{domain}/` | 参考事务编排模式 |

**Subagent 提取摘要而非全文代码**，摘要格式：
```
参考: {domain}/XxxEntity.java — 充血模型，3个业务方法，状态机在 Entity 内
参考: {domain}/XxxManageFacadeImpl.java — 使用 @RpcProvider + @FacadeIntercept，异常双重 catch
```

## 上下文预算

| 场景 | 主会话预算 | 说明 |
|------|-----------|------|
| 简单 CRUD | 15-20KB | 契约 + standards + 2-3 patterns |
| 标准业务 | 20-30KB | 契约 + standards + 4-5 patterns + 参考摘要 |
| 复杂业务 | 25-40KB | 契约 + standards + 6-7 patterns + 参考摘要 |

**超过 40KB 时**：应分 domain 批次生成，每个 domain 独立加载上下文。

## 禁止加载

以下内容**禁止**在 implement 阶段加载到上下文：

| 内容 | 原因 |
|------|------|
| `.claude/briefs/` 下所有文件 | 项目简报不参与代码生成 |
| `.claude/standards/test-standards.md` | 测试标准在 verify 阶段使用 |
| `examples/` 下所有文件 | 示例用于人阅读，不用于代码生成 |
| 非 current domain 的行为契约 | 只加载当前 Feature 的契约 |

> **路径约定**：以上路径均相对于项目根目录。`.claude/` 目录下的内容由 loader 安装。`implement/references/` 是 skill 自带的参考文档。

## 分 domain 生成策略

当行为契约涉及多个 domain 时：

1. **按依赖拓扑排序**：被依赖的 domain 先生成
2. **每个 domain 独立上下文**：生成完一个 domain 后清理非共享上下文
3. **共享上下文保留**：standards.md 和行为契约始终保留
4. **判断日志汇总**：所有 domain 的判断合并到一个日志文件

```
Domain A (独立) → 生成代码 → 判断日志 A 部分
Domain B (依赖 A) → 加载 A 的接口定义 → 生成代码 → 判断日志 B 部分
汇总: judgment-logs/{F-ID}.md
```