---
name: clarify
description: |
  需求拆解与约束定义。产出行为契约和项目简报。
  聚焦于"做什么"和"约束是什么"，而非文档完整性。

  触发场景：
  - dev-flow Phase 1 自动调用
  - 用户说"拆解需求"、"定义约束"、"写行为契约"、"澄清需求"
  - 用户描述了一个需求或 Feature

  注意：此技能的核心价值是帮人想清楚问题定义和约束边界，
  而不是生成完整的文档。
version: 1.1
author: HelmCode
tags: [clarify, 需求分析, 行为契约, 约束定义]
---

# clarify: 需求拆解与约束定义

## 核心理念

不是写文档，而是想清楚问题。行为契约是 AI 代码生成的精确输入，每一条都必须可验证。

## 上下文加载

| 内容 | 路径 | 加载方式 | 估算大小 |
|------|------|---------|---------|
| 行为契约模板 | `references/contract-template.md`（skill 目录内） | 主会话 | 2KB |
| 项目简报模板 | `references/brief-template.md`（skill 目录内） | 主会话 | 1KB |
| 澄清维度 | `references/clarification-dimensions.md`（skill 目录内） | 主会话 | 2KB |
| 编码标准 | `.claude/standards/standards.md`（项目根目录） | 主会话 | 3-5KB |
| 审查规则 | `.claude/standards/review-rules.md`（项目根目录） | 按需 | 5KB |

**路径约定**：
- `references/` 开头 → 相对于**skill 目录**（随 skill 一起安装）
- `.claude/` 开头 → 相对于**项目根目录**（由 loader 安装）

**禁止加载**：
- ❌ `.claude/standards/patterns/`（实现阶段参考，澄清阶段不需要）
- ❌ `.claude/standards/test-standards.md`（验证阶段使用）

**合计**：~8-10KB

## 执行逻辑

### Phase 1: 理解上下文

1. **阅读现有代码**（如果项目已存在）：
   - 识别技术栈（从 CLAUDE.md、pom.xml、package.json 等）
   - 识别领域模型（从已有代码结构）
   - 找到同 domain 或相似 feature 的参考实现

2. **加载约束**：
   - 读取 `.claude/standards/standards.md` 中的编码标准
   - 读取 `.claude/standards/review-rules.md` 中的审查规则（如存在）
   - 读取已有行为契约（`.claude/contracts/` 目录，了解现有 Feature 的约束）

3. **推断领域**：
   - 从代码结构（如 DDD 的 domain/model/ 子目录）推断领域边界
   - 从用户描述中提取领域关键词

### Phase 2: 澄清问题

使用标准澄清维度框架（参见 `references/clarification-dimensions.md`）：

**P0 维度（必须澄清）**：
- 功能边界：做什么、不做什么
- 业务规则：精确的、可验证的规则
- 状态流转：如果有状态变化，必须画出状态机
- 验收条件：什么叫"做完了"

**P1 维度（按需澄清）**：
- API 边界：哪些接口对外暴露
- 兼容性：对现有系统的影响
- 集成点：与外部系统的交互

**P2 维度（简单需求跳过）**：
- 性能要求
- 安全要求

### Phase 3: 生成行为契约

基于澄清结果，使用 `references/contract-template.md` 生成行为契约：

1. 填写元信息（Feature ID、优先级、领域）
2. 写问题定义（一句话）
3. 画状态机（如果有状态流转）
4. 列业务规则（每条有 BR-xxx ID）
5. 定义 API 契约（方法、请求、响应、错误码）
6. **画实体关系图**（标注聚合边界、引用关系、数据流向）
7. 定义领域模型（聚合根、枚举、仓储）
8. 列 Schema 变更
9. 列兼容性约束
10. 写验收条件（每条必须有验证方式，见下方约束）

**验收条件可验证性约束**：

每条验收条件必须满足以下之一，因为 `/goal` 的 Haiku 评估器只能看会话内容：
- 编译检查能发现（如"新增 XxxFacade 接口"→ 编译通过即满足）
- 单元测试能验证（如"重复创建返回错误码"→ 测试断言）
- 验证脚本能检查（如"字段在 Entity/DO/VO 中同步"→ verify-field-sync）
- 可执行的命令能判定（如"API 返回 200"→ curl 检查）

不可接受的写法："用户体验好"、"代码清晰"、"性能足够"。
如果某个 AC 确实无法程序验证，标注为 `人工确认` 并说明原因。

**实体关系要求**：
- 涉及多个聚合根或有实体关联时，**必须**画出 PlantUML 实体关系图
- 标注关系类型（1:1、1:N、M:N）和级联行为
- 画出数据流向图（从触发源到持久化目标）
- 单聚合根且无关联实体时，可简化为一句话描述

### Phase 4: 生成项目简报

使用 `references/brief-template.md` 生成项目简报：
- 业务背景、目标、用户角色
- 里程碑、风险、三板斧、工作量

**项目简报是给人看的，不参与代码生成。**

隔离约定：
- 项目简报存放于 `.claude/briefs/` 目录
- 后续 implement 和 verify 阶段**禁止读取** `.claude/briefs/` 下的任何文件
- 项目简报中如有关键约束（如性能指标、兼容性要求），应在行为契约的验收条件或兼容性约束中体现，而非在简报中

### Phase 5: 提交审查

向用户展示行为契约，标注【需要确认】的关键判断点：
- 状态机是否有遗漏的转换？
- 业务规则是否精确且无歧义？
- API 边界是否清晰？
- 兼容性约束是否充分？

**审查重点是"约束对不对"，不是"文档全不全"。**

## 前置条件

- 项目目录可写
- （可选）已有代码结构可用于推断技术栈和领域模型

## 后置条件

- 产出 `.claude/contracts/{F-ID}-{short-name}.md`（行为契约，状态: draft）
- 产出 `.claude/briefs/{F-ID}-{short-name}.md`（项目简报，可选）
- 更新 `.claude/contracts/registry.md`（注册 Feature，状态: draft）
- 行为契约至少包含：问题定义、至少1条业务规则（BR-xxx）、验收条件

## 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| --feature | Feature ID | 自动生成 F{NNN}-{short-name} |
| --domain | 指定领域 | 从代码/描述推断 |
| --mode | 澄清模式: hybrid/interactive/batch | hybrid |
| --from-contract | 基于现有行为契约修改 | - |

## 输出

- `.claude/contracts/{F-ID}-{short-name}.md` — 行为契约
- `.claude/briefs/{F-ID}-{short-name}.md` — 项目简报（可选）