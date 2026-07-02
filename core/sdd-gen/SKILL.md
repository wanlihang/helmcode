---
name: sdd-gen
description: |
  系统分析设计文档（SDD）生成器。从需求、契约、PRD 或代码上下文生成标准化系分文档。
  触发场景：用户说"生成系分"、"写设计文档"、"系统分析设计"、"sdd"、"system design doc"、
  "生成 L2"、"/sdd-gen"；或在 clarify 完成后需要输出详细技术设计文档。
  支持 DDD 架构，遵循阿里/蚂蚁系分规范，输出包含 PlantUML 图表、领域模型、接口设计、数据库设计、三板斧等完整章节。
version: 1.0
author: HelmCode
tags: [sdd, 系分, 设计文档, spec, L2, ddd]
---

# 系统分析设计文档生成器（SDD Gen）

## 概述

从需求描述、行为契约、PRD 或代码上下文，生成符合阿里/蚂蚁系分规范的标准化系统分析设计文档（L2-SDD）。

**核心能力**：
- 自动识别输入类型（契约/PRD/代码/口头需求），按需补充信息
- DDD 分层架构（Facade → Application → Domain → Infrastructure）
- PlantUML 图表（时序图、类图、状态图、ER图、架构图）
- 阿里黄山版编码规范（异常处理、BigDecimal、日志等）
- 输出到 `.claude/sdd/`，Feature 编号与行为契约绑定（同 F002、F003）

## 工作流程

### Phase 1: 上下文收集

1. **识别输入来源**（按优先级）：
   - 行为契约（`.claude/contracts/F*.md`，最推荐——同编号绑定直接复用 Feature ID）
   - 需求文档（`.claude/prd/F*.md`，L1-PRD——业务背景、用户角色、验收标准的权威人读来源，与契约同编号绑定，由 `/prd-gen` 生成）
   - 项目简报（`.claude/briefs/`，人写的需求背景）
   - 现有代码（源码目录，逆向生成）
   - 用户口头描述

2. **读取必要上下文**：
   - 项目编码标准：`.claude/standards/standards.md`（如存在）
   - 项目约定：`.claude/standards/project-conventions.md`（如存在）
   - 代码模式：`.claude/standards/patterns/`（如存在）
   - 已有契约：`.claude/contracts/registry.md`

3. **补充确认**（如信息不足）：
   - 核心业务对象（聚合根、实体）
   - 关键业务流程
   - 外部系统依赖
   - 技术栈约束

### Phase 2: 生成文档

按以下顺序生成各章节，**每章生成后向用户展示关键决策点**：

> **贯穿全程的变更可视化要求**：生成每个图表前，先依据契约/需求判断每个元素是**本次新增**还是**修改已有**，并在图里上色——**红=新增、黄=修改，其余一律默认无色**（含未动元素、分层 box/package 背景）。全篇只有红/黄两种颜色语义，不设分层色/状态色/灰色。详见 [plantuml-style.md](references/plantuml-style.md) 第五节「颜色使用纪律」。这是系分文档的核心价值：让评审一眼看清本次动了什么。

1. **文档元数据** — spec_id、版本、追溯关系
2. **需求概述** — 背景、痛点、范围、业务域词汇表
3. **系统分析** — 系统依赖图、强/弱依赖分析
4. **整体设计** — 业务流程时序图、系统架构、领域模型
5. **详细设计** — 每个业务场景的类调用时序图、状态机、业务规则
6. **接口设计** — Facade 接口定义、请求/响应、错误码、幂等与异常处理
7. **数据库设计** — ER 图、表结构（DDL + 字段说明 + 索引）
8. **兼容性分析** — 数据兼容性、接口兼容性、版本兼容性
9. **测试及回归建议** — 测试重点、回归范围
10. **风险评估** — 依赖评估、技术风险
11. **三板斧** — 监控与核对、灰度与切流、应急方案
12. **工作量拆分** — 按域拆分、人日估算
13. **附录** — 枚举定义、配置项、代码文件索引

### Phase 3: 输出、校验与注册

1. **输出文件**：`.claude/sdd/{F-ID}-{short-name}.md`
   - Feature 编号与行为契约**严格一致**（契约 `F002-xxx.md` ↔ 系分 `F002-xxx.md`）
   - 这是「同一 Feature 编号绑定」的唯一规则：两边 `{F-ID}-{short-name}` 必须相同
2. **强制校验（不可跳过）**：跑 PlantUML 静态校验脚本，有报错必须修到全绿才算完成：
   ```bash
   node .claude/scripts/verify-plantuml.mjs .claude/sdd/{F-ID}-{short-name}.md
   # 退出码 0 = 通过；非 0 = 必须修。脚本会查：@startuml/@enduml 闭合、大括号配平、
   # alt/loop 配对、钉钉/飞书禁忌 skinparam、以及 meta-instruction 残留漏检。
   ```
   > 脚本由 HelmCode 安装到 `.claude/scripts/`。开发态位于 `<仓库>/scripts/verify-plantuml.mjs`。
3. **更新注册**：在 `registry.md` 中追加 Feature 条目（如尚不存在）
4. **验证**：确认文档 `trace_from` 引用的契约（如 `F002-xxx`）确实存在于 `.claude/contracts/`

## 命令格式

```
/sdd-gen [options]

Options:
  --feature F001-xxx     指定 Feature ID（必填，从契约或 PRD 继承）
  --from contract        从行为契约生成（默认）
  --from prd             从 PRD 文档生成
  --from code            从代码逆向生成
  --from scratch         从零开始，交互式收集信息
  --domain xxx           限定生成某个域的内容
  --quick                快速模式，仅生成核心章节（需求\整体设计\接口设计\数据库）
```

## 文档结构规范

### PlantUML 样式

严格遵循 PlantUML 样式规范，详见 [plantuml-style.md](references/plantuml-style.md)。

> **关键规则**：
> - 时序图必须使用 `autonumber`
> - 状态图必须使用 `left to right direction`
> - 类图必须标注 `<<Aggregate Root>>` / `<<Entity>>` / `<<Value Object>>` / `<<Interface>>`
> - 参与者顺序：触发方 → 前端 → Facade → Service → Repository → DB
> - 业务时序图与类调用时序图区分：前者用业务角色名，后者用类名+方法签名
> - 领域模型图应穿透到 Facade 层。**若本次无新增对外 Facade**（纯内部 Action/定时任务触发），也要在领域模型图顶部画一个 `<<trigger>>` 入口框（如 `BuildSignModeTreeAction` 或 `XxxScheduler`）说明触发来源，替代 Facade 作为分层最外层，不可省略外层入口直接从聚合根画起。

### DDD 分层命名

| 层级 | 对象 | 后缀 | 示例 |
|------|------|------|------|
| Facade | 服务接口 | Facade | `ReconTaskFacade` |
| Application | 应用服务 | Service / Command | `ReconTaskApplicationService` |
| Domain | 聚合根 | 无后缀 | `ReconTask` |
| Domain | 实体 | 无后缀 | `ReconTaskItem` |
| Domain | 值对象 | VO / Info | `PreConfirmInfo` |
| Domain | 领域服务 | DomainService | `ReconTaskDomainService` |
| Domain | 仓储接口 | Repository | `ReconTaskRepository` |
| Infrastructure | 仓储实现 | RepositoryImpl | `ReconTaskRepositoryImpl` |
| Infrastructure | Mapper | Mapper | `ReconTaskMapper` |

### 数据库字段规范

所有表必须包含基础字段：
```sql
`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`gmt_create` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
`gmt_modified` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '修改时间',
`creator` VARCHAR(64) NOT NULL DEFAULT 'system' COMMENT '创建人',
`modifier` VARCHAR(64) NOT NULL DEFAULT 'system' COMMENT '修改人',
`is_deleted` CHAR(1) NOT NULL DEFAULT 'n' COMMENT '逻辑删除标识(y/n)',
```

> **ER 图与表结构必须体现基础字段**：
> - **新增表**：ER 图 + 建表语句必须列全上述 6 个基础字段。
> - **扩展表（ALTER ADD COLUMN）**：在表结构小节开头显式声明「基础字段历史已有，本次仅新增业务字段」，避免被误判为缺失。
> - **唯一索引必须含 `is_deleted`**：每条 `UNIQUE KEY` 列定义都要带上 `is_deleted`，软删后才能重建相同业务键。

### 索引命名规范

```sql
-- 唯一索引：uk_[业务含义]（必须含 is_deleted）
UNIQUE KEY `uk_biz_code` (`biz_code`, `is_deleted`)

-- 普通索引：idx_[字段名]
KEY `idx_status` (`status`)
KEY `idx_gmt_create` (`gmt_create`)
```

## 整体设计 vs 详细设计的区别

> **关键区分**：两者都是时序图，区别在于**粒度**

| 维度 | 整体设计（业务时序图） | 详细设计（类调用时序图） |
|------|----------------------|------------------------|
| **参与者** | 业务角色/系统名 | 具体类名（Controller/Service/Repository） |
| **消息** | 业务动作描述 | 方法签名（方法名 + 入参类型 + 返回值类型） |
| **粒度** | 业务语义 | 技术实现 |
| **示例** | "对账系统 → 邮件系统：获取邮件" | "ReconTaskFacade → ReconTaskService：confirmIncome(taskId, operator, remark): Result" |

## 与 HelmCode 工作流的集成

```
/dev-flow 流程：
  clarify → /goal → implement → verify → checkpoint

/sdd-gen 可在以下节点触发：
  ├── clarify 之后：从契约生成系分（推荐）
  ├── /prd-gen 之后/之前：PRD 与 SDD 互为 trace（双向追溯）
  ├── /goal 之前：补充技术设计后再编码
  └── 独立使用：对已有需求/代码生成系分文档
```

**推荐流程**：
1. `/clarify` → 产出行为契约（机器契约）
2. `/prd-gen --feature F001-xxx --from contract` → 产出 PRD（L1，给业务/测试）
3. `/sdd-gen --feature F001-xxx --from contract` → 产出系分（L2，给开发）
4. `/goal` → 基于契约驱动实现（PRD/SDD 是参考，契约是唯一驱动源）
5. `checkpoint` → 审查设计决策

> **隔离约定**：行为契约是 `/goal` 的**唯一**驱动源。PRD 和 SDD 是人读交付物，**不参与** goal 循环的机器判断（implement/verify 只读契约 + standards）。

## HelmFlow 协同（matrixCellId 机制）

若在 HelmFlow 编排下使用，系分的 frontmatter `matrixCellId` 必须与行为契约**完全一致**：

- `matrixCellId` 格式：`D-XX__cell名`（业务坐标，HelmFlow 控制平面据此精确匹配 cell）
- **填写规则**：从绑定的行为契约继承 `matrixCellId`（契约 ↔ PRD ↔ SDD 三边一致）
- 独立使用（非 HelmFlow 编排）：留空
- HelmFlow 通过扫描 `.claude/contracts/`、`.claude/prd/`、`.claude/sdd/` 三处同 `matrixCellId` 的文档，建立 cell 级别的契约→需求→设计闭环

## 模板使用纪律（最重要）

`sdd-template.md` 里有两类内容，**生成时必须区分对待**：

1. **HTML 注释 `<!-- GEN-GUIDE ... -->`** = 给你的**编写指引**（画什么图、参与者用什么命名、何时删节）。这些是 meta-instruction，**成品里一个字都不能留**——产出前必须把所有 `<!-- GEN-GUIDE -->` 注释连同内容整体删除。
2. **正文样板**（表格、PlantUML 骨架、章节标题、文档头注 `> 文档类型/适用层级`）= 成品该有的结构，**替换占位符后保留**。

> **红线**：成品系分文档是给评审/开发/测试读的交付物，**严禁出现任何「教你怎么写」的元说明**，例如「关键区分：整体设计用业务角色名、详细设计用类名」「参与者必须是具体类名」「无状态流转则删除此节」之类。这些规则你自己遵守即可，不要写进文档自述。模板里若残留这类可见引用块（`> ⚠️ 关键区分` 等），等同于把 GEN-GUIDE 漏删——视为不合格。

## 生成质量检查清单

文档生成后，对照以下清单自查：

- [ ] **成品无任何 `<!-- GEN-GUIDE -->` 注释、无任何「教你怎么写」的元说明**（最高优先级）
- [ ] YAML frontmatter 中 spec_id、spec_level、trace_from、trace_to 正确
- [ ] 文档修订历史已填写
- [ ] **`verify-plantuml.mjs` 校验通过（退出码 0）——强制，未过不算完成**
- [ ] 所有 PlantUML 图表可渲染（无语法错误）
- [ ] **变更可视化：全篇只有红(新增)/黄(修改)两色，其余元素默认无色；无分层色/状态色/灰色。评审一眼区分本次动效**
- [ ] 整体设计的时序图使用业务角色名，详细设计使用类名（规则你自己遵守，不要写进文档）
- [ ] 领域模型图穿透到 Facade 层（或 trigger 入口），标注变更类型（新增/修改/已有）
- [ ] 每个业务场景有对应的类调用时序图
- [ ] 有状态机的实体已画出状态图
- [ ] 业务规则有 BR-xxx 编号
- [ ] 接口设计包含请求参数、响应参数、错误码
- [ ] 数据库设计包含完整 CREATE TABLE + 索引 + 字段说明
- [ ] 幂等设计已覆盖所有写接口
- [ ] 异常处理标准表已填写
- [ ] 三板斧（监控、灰度、应急）已填写
- [ ] 工作量拆分已估算人日

## 参考资源

- **文档模板**：[sdd-template.md](references/sdd-template.md) — 完整模板（含占位符和说明）
- **PlantUML 样式**：[plantuml-style.md](references/plantuml-style.md) — 图表样式规范
- **编码规范**：如项目有 `.claude/standards/standards.md`，自动加载