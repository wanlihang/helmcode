---
name: prd-gen
description: |
  产品需求文档（PRD）生成器。从行为契约、PD 提供的原始需求、项目简报或代码上下文，
  全面整合生成标准化 PRD（L1 业务规范）。
  触发场景：用户说"生成PRD"、"写需求文档"、"整理需求"、"产品需求"、"prd"、
  "生成 L1"、"/prd-gen"；或在 clarify 完成后需要输出人读的正式 PRD 交付物。
  输出业务视角文档：背景目标、用户角色、核心功能、业务流程、状态流转、业务规则、验收标准。
  PRD 是 clarify 之后的「整合产物」——把机器可验证的行为契约 + PD 原始需求，整合成业务/产品/测试可读的交付物。
version: 1.0
author: HelmCode
tags: [prd, 需求文档, L1, spec, 需求, 业务]
---

# 产品需求文档生成器（PRD Gen）

## 概述

从行为契约、PD 原始需求、项目简报或代码上下文，**全面整合**生成符合规范的标准化产品需求文档（L1-PRD）。

**与 clarify 的关系（关键）**：PRD 是 clarify **之后**的产物，不是 clarify 的输入。
- clarify 产出的是**机器可验证的行为契约**（给 `/goal` 用，精确、可测试）
- prd-gen 把契约 + PD 原始需求 + 上下文**整合**成**人可读的正式 PRD**（给业务/产品/测试/评审看）
- 与 sdd-gen（L2 技术系分）**并列**，输入来源相同，定位互补：

```
PD 原始需求 / 口头描述
      ↓ clarify
行为契约（机器契约，/goal 驱动用）
      ↓ 并列派生（输入相同：契约 + 原始PRD + 简报 + 代码）
  ┌───┴───┐
prd-gen   sdd-gen
(L1 人读)  (L2 技术)
```

**核心能力**：
- 自动识别输入类型（契约/PD原始需求/简报/代码/口头描述），按需补充信息
- 业务视角输出（不涉及技术实现、无类图/ER图/DDL/接口签名）
- PlantUML 业务流程图 + 状态机（复用 sdd-gen 的图表规范）
- 业务规则 BR-xxx 与契约**双向追溯**（同 ID）
- HelmFlow 编排下支持 `matrixCellId` 精确匹配
- 输出到 `.claude/prd/`，Feature 编号与行为契约绑定（同 F002、F003）

## 工作流程

### Phase 1: 上下文收集

1. **识别输入来源**（按优先级，与 sdd-gen 一致）：
   - **行为契约**（`.claude/contracts/F*.md`，最推荐——同编号绑定直接复用 Feature ID、业务规则 BR-xxx、状态机、验收条件）
   - **PD 原始需求**（用户粘贴的需求文档、会议纪要、口头描述——业务背景的权威来源）
   - 项目简报（`.claude/briefs/`，人写的需求背景）
   - 现有代码（源码目录，逆向生成）
   - 用户口头描述

2. **读取必要上下文**：
   - 行为契约（主输入）：问题定义、状态机、业务规则、API 契约、领域模型、验收条件
   - 项目简报：业务背景、目标、用户角色、里程碑
   - 已有 PRD（`.claude/prd/`）：保持术语、风格一致
   - PD 原始需求片段：业务语言、关键指标、范围边界

3. **整合与补充**（PRD 的核心价值在于「整合」，不是简单搬运）：
   - 把契约的**技术化表述**翻译成**业务语言**（如 `throw XXX_DUPLICATE` →「重复创建提示已存在」）
   - 用 PD 原始需求**补全**契约里没有的业务背景、用户角色、业务价值、关键指标
   - 识别契约与原始需求的**冲突点**，向用户确认后取舍（契约是技术真相，原始需求是业务意图）

### Phase 2: 生成文档

按以下顺序生成各章节，**每章生成后向用户展示关键决策点**：

> **贯穿全程的变更可视化要求**：业务流程图/状态机里，本次新增的流程或分支用红色，修改的用黄色，其余默认无色。详见 [plantuml-style.md](references/plantuml-style.md)（PRD 自带的图表样式规范，与 SDD 同源）。

1. **文档元数据** — spec_id（PRD-{F-ID}）、版本、追溯关系、`matrixCellId`（HelmFlow 编排下从契约继承）
2. **背景与目标** — 背景、痛点、目标、业务价值、关键指标（整合 PD 原始需求 + 契约问题定义）
3. **用户与角色** — 业务角色及诉求（来自简报 + PD 需求）
4. **核心功能** — 功能清单表（F-NN，业务语言，关联契约 BR）
5. **业务流程** — 业务流程时序图（业务角色名/系统名，非类名）+ 步骤说明
6. **状态流转** — 状态机（业务语言，映射契约枚举）+ 转换规则
7. **业务数据模型** — 业务概念级字段表（含义，非 DDL 类型精度）+ 对象关系
8. **业务规则** — BR-xxx（与契约**同 ID**，业务语言重述）
9. **非功能需求** — 性能、安全、可用性、合规
10. **验收标准** — 业务语言（映射契约 AC，附「PRD 验收项 ↔ 契约 AC」对照表）
11. **依赖与边界** — 上下游、范围内/外
12. **附录** — 术语表、参考文档

### Phase 3: 输出、校验与追溯

1. **输出文件**：`.claude/prd/{F-ID}-{short-name}.md`
   - Feature 编号与行为契约**严格一致**（契约 `F002-xxx.md` ↔ PRD `F002-xxx.md` ↔ 系分 `F002-xxx.md`）
   - 这是「同一 Feature 编号绑定」的唯一规则：三边 `{F-ID}-{short-name}` 必须相同
2. **强制校验（不可跳过）**：跑 PlantUML 静态校验脚本，有报错必须修到全绿才算完成：
   ```bash
   node .claude/scripts/verify-plantuml.mjs .claude/prd/{F-ID}-{short-name}.md
   # 退出码 0 = 通过；非 0 = 必须修。脚本会查：@startuml/@enduml 闭合、大括号配平、
   # alt/loop 配对、钉钉/飞书禁忌 skinparam、以及 meta-instruction 残留漏检。
   ```
   > 脚本由 HelmCode 安装到 `.claude/scripts/`。开发态位于 `<仓库>/scripts/verify-plantuml.mjs`。
   > PRD 与 SDD 共用同一校验脚本（图表语法规范一致）。
3. **补全 trace_to**：若该 Feature 已有系分（`.claude/sdd/{F-ID}-xxx.md`），在 PRD 的 `trace_to` 补 `SDD-{F-ID}`；反之在系分的 `trace_from` 补 `PRD-{F-ID}`，保持双向追溯。
4. **验证**：确认 PRD `trace_from` 引用的契约（如 `F002-xxx`）确实存在于 `.claude/contracts/`。

## 命令格式

```
/prd-gen [options]

Options:
  --feature F001-xxx     指定 Feature ID（必填，从契约继承）
  --from contract        从行为契约生成（默认）
  --from brief           从项目简报 + PD 原始需求生成
  --from code            从代码逆向生成
  --from scratch         从零开始，交互式收集信息
  --domain xxx           限定生成某个域的内容
  --quick                快速模式，仅生成核心章节（背景\核心功能\业务流程\状态机\验收标准）
```

## 文档结构规范

### PlantUML 样式

遵循 PlantUML 样式规范，详见 [plantuml-style.md](references/plantuml-style.md)（与 sdd-gen 同源；PRD 自包含一份，确保 minimal preset 未装 sdd-gen 时不断链）。

> **PRD 图表关键规则**：
> - PRD 只画两类图：**业务流程时序图**（业务角色名）+ **状态机**（`left to right direction`）
> - **不画**：类图、ER 图、架构分层图、类调用时序图（这些是 SDD 的内容）
> - 业务流程时序图用业务角色名/系统名（如「运营人员」「对账系统」），消息用业务动作描述
> - 状态机用业务语言标注状态（如「待确认」「已完成」），可与契约枚举名映射

### 业务数据模型规范

PRD 的数据模型是**业务概念级**，与 SDD 的数据库设计严格区分：

| 维度 | PRD（L1 业务） | SDD（L2 技术） |
|------|---------------|---------------|
| 字段表述 | 业务字段名 + 含义（如「任务编号」） | 物理字段 + 类型（如 `task_id VARCHAR(64)`） |
| 类型精度 | 不写（只写是否必填、示例） | 精确到 `VARCHAR(64) NOT NULL` |
| 索引/DDL | 不写 | 完整 CREATE TABLE + 索引 |
| 对象关系 | 文字描述（1:N 等） | ER 图 |

### 业务规则编号

- PRD 的 BR-xxx **必须与契约同 ID**（契约 BR-001 ↔ PRD BR-001），保证双向追溯
- PRD 用业务语言重述（去掉技术校验逻辑），契约保留技术细节

## PRD vs SDD 的区别

> **关键区分**：两者输入相同（契约为主），但**视角与读者**不同

| 维度 | PRD（L1 业务规范） | SDD（L2 功能规范） |
|------|-------------------|-------------------|
| **读者** | 产品/业务/测试/评审 | 开发/架构/评审 |
| **视角** | 业务语义（做什么、为什么） | 技术实现（怎么做） |
| **流程图** | 业务角色 + 业务动作 | 类名 + 方法签名 |
| **数据模型** | 业务字段 + 含义 | DDL + 类型 + 索引 |
| **接口** | 功能输入输出（业务概念） | Facade 方法签名 + 错误码 |
| **示例** | "运营人员发起对账 → 系统比对 → 人工确认" | "ReconTaskFacade.confirm(taskId, operator): Result" |

## 与 HelmCode 工作流的集成

```
/dev-flow 流程：
  clarify → /goal → implement → verify → checkpoint

/prd-gen 可在以下节点触发：
  ├── clarify 之后：从契约整合 PRD（推荐，与 /sdd-gen 并列）
  ├── /sdd-gen 之前/之后：PRD 与 SDD 互为 trace（双向追溯）
  └── 独立使用：对已有需求/代码整合 PRD
```

**推荐流程**：
1. `/clarify` → 产出行为契约（机器契约）
2. `/prd-gen --feature F001-xxx --from contract` → 产出 PRD（人读，给业务/测试）
3. `/sdd-gen --feature F001-xxx --from contract` → 产出系分（给开发）
4. `/goal` → 基于契约驱动实现（PRD/SDD 是参考，契约是唯一驱动源）

> **隔离约定**：行为契约是 `/goal` 的**唯一**驱动源。PRD 和 SDD 是人读交付物，**不参与** goal 循环的机器判断（implement/verify 不读 PRD，只读契约 + standards）。

## HelmFlow 协同（matrixCellId 机制）

若在 HelmFlow 编排下使用，PRD 的 frontmatter `matrixCellId` 必须与行为契约**完全一致**：

- `matrixCellId` 格式：`D-XX__cell名`（业务坐标，HelmFlow 控制平面据此精确匹配 cell）
- **填写规则**：从绑定的行为契约继承 `matrixCellId`（契约 ↔ PRD ↔ SDD 三边一致）
- 独立使用（非 HelmFlow 编排）：留空
- HelmFlow 通过扫描 `.claude/prd/`、`.claude/sdd/`、`.claude/contracts/` 三处同 `matrixCellId` 的文档，建立 cell 级别的需求→设计→契约闭环

> 与契约模板的 `matrixCellId` 字段（见 clarify 的 contract-template.md）保持同一套机制，PRD/SDD 是该机制向交付物的延伸。

## 模板使用纪律（最重要）

`prd-template.md` 里有两类内容，**生成时必须区分对待**（同 sdd-gen 纪律）：

1. **HTML 注释 `<!-- GEN-GUIDE ... -->`** = 给你的**编写指引**（画什么图、何时删节、业务/技术如何取舍）。这些是 meta-instruction，**成品里一个字都不能留**——产出前必须把所有 `<!-- GEN-GUIDE -->` 注释连同内容整体删除。
2. **正文样板**（表格、PlantUML 骨架、章节标题、文档头注 `> 文档类型/适用层级`）= 成品该有的结构，**替换占位符后保留**。

> **红线**：成品 PRD 是给业务/产品/测试/评审读的交付物，**严禁出现任何「教你怎么写」的元说明**。模板里若残留这类可见引用块，等同于把 GEN-GUIDE 漏删——视为不合格。

## 生成质量检查清单

文档生成后，对照以下清单自查：

- [ ] **成品无任何 `<!-- GEN-GUIDE -->` 注释、无任何「教你怎么写」的元说明**（最高优先级）
- [ ] YAML frontmatter 中 spec_id、spec_level、feature_id、contract、trace_from、trace_to 正确
- [ ] **`matrixCellId` 与行为契约一致**（HelmFlow 编排下）；独立使用留空
- [ ] 文档修订历史已填写
- [ ] **`verify-plantuml.mjs` 校验通过（退出码 0）——强制，未过不算完成**
- [ ] 业务流程时序图用业务角色名（非类名），状态机用 `left to right direction`
- [ ] **业务规则 BR-xxx 与契约同 ID**，业务语言重述
- [ ] **验收标准与契约 AC 有映射表**（PRD 验收项 ↔ 契约 AC）
- [ ] 业务数据模型是业务概念级（无 DDL/类型精度/索引）
- [ ] 未出现类图/ER图/架构分层图/接口签名（这些属 SDD，PRD 不画）
- [ ] 有状态流转的实体已画状态机（无状态则该节整体删除，不留空占位）
- [ ] 文档全文用业务语言，技术细节留给 SDD
- [ ] 术语表已填写（减少业务/开发理解偏差）

## 参考资源

- **文档模板**：[prd-template.md](references/prd-template.md) — 完整 PRD 模板（含占位符和说明）
- **PlantUML 样式**：[plantuml-style.md](references/plantuml-style.md) — 图表样式规范（与 sdd-gen 同源，PRD 自包含）
- **行为契约**：`.claude/contracts/{F-ID}-{short-name}.md` — PRD 的主输入
- **系分文档**：`.claude/sdd/{F-ID}-{short-name}.md` — 互补的 L2 技术文档（双向 trace）
