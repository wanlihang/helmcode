<p align="center">
  <strong>HelmCode</strong>
</p>

<p align="center">
  人定终点,AI 自主划到终点的 AI 编程工作流。<br>
  <code>clarify → /goal(自主循环)→ checkpoint</code>
</p>

<p align="center">
  <a href="./README.md">English</a>
  ·
  <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://github.com/wanlihang/helmcode"><img src="https://img.shields.io/github/package-json/v/wanlihang/helmcode?style=flat&colorA=080f12&colorB=1fa669" alt="version"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/wanlihang/helmcode?style=flat&colorA=080f12&colorB=1fa669" alt="License"></a>
  <img src="https://img.shields.io/node/v/helmcode?style=flat&colorA=080f12&colorB=1fa669" alt="Node version">
  <a href="https://claude.ai/code"><img src="https://img.shields.io/badge/runs%20in-Claude%20Code-7C3AED?style=flat&colorA=080f12" alt="Claude Code"></a>
</p>

> **🚢 想找多 agent 中台?** 全流程自动化的 AI 编程中台(web Portal + 5 节点 agent 流水线 + 跨节点 fix-task 循环 + 多项目接入)在 [**HelmFlow**](https://github.com/wanlihang/helmflow)。HelmCode(本仓库)专注**轻量标准 + skill 安装器**,任何项目可接入;HelmFlow 消费 HelmCode 的标准,在上层叠加平台能力。

---

## 目录

- [为什么选择 HelmCode?](#为什么选择-helmcode)
- [核心概念](#核心概念)
- [安装](#安装)
- [快速开始](#快速开始)
- [使用指南](#使用指南)
  - [完整闭环工作流](#完整闭环工作流)
  - [Goal 达成判定标准](#goal-达成判定标准)
  - [命令清单](#命令清单)
  - [人介入节点](#人介入节点)
  - [典型场景](#典型场景)
  - [故障排查](#故障排查)
- [Feature 状态机](#feature-状态机)
- [编码标准](#编码标准)
- [项目结构](#项目结构)
- [示例](#示例)
- [对比](#对比)
- [CLI 参考](#cli-参考)
- [贡献](#贡献)
- [许可证](#许可证)

---

## 为什么选择 HelmCode?

AI 写代码时,瓶颈不再是生成,而是**判断**。

审查 400 行 diff 很慢,审查 5 个关键决策点很快。

HelmCode 围绕一个原则重新设计 AI 编程闭环:**人的判断力是最稀缺资源**。与其审查所有代码,不如只审查关键决策。

### 工作机制

1. **clarify** — 你定义问题和约束,AI 产出**行为契约**——这是一份给代码生成器读的精确规约,不是文档。
2. **/goal** — Claude Code 驱动自主循环:implement → verify → 修复 → verify,直到所有硬约束全部通过。
3. **checkpoint** — 你只审查**判断日志**——AI 明示标记的不确定决策项。

```text
clarify    →  行为契约(要做什么 + 约束)
/goal      →  代码 + 测试 + 判断日志(AI 自主跑闭环)
checkpoint →  决策审查(确认 ⚠️ 项后 commit)
```

## 核心概念

### 行为契约 Behavior Contract

每个 Feature 对应一个文件,替代分散的需求文档。包含:

- 问题定义
- 状态机(PlantUML)
- 业务规则(`BR-xxx`,每条可程序验证)
- API 契约
- 领域模型
- 验收条件

### 判断日志 Judgment Log

HelmCode 的核心创新。AI 主动暴露设计决策:

- `JD-xxx` — 已做决策(扫一眼即可)
- `JD-xxx ⚠️` — 不确定决策(**必须**审查)

### 上下文预算 Context Budget

每个循环 turn 总上下文约 55 KB(传统文档流水线 365 KB+)。每个 skill 按需加载:

| Skill | 预算 |
| --- | --- |
| clarify | 8–10 KB |
| implement | 15–40 KB |
| verify | 5–10 KB |

## 安装

> HelmCode 直接从 GitHub 分发。所有安装命令均从 `github:wanlihang/helmcode` 拉取源码。

```bash
# 全局安装(推荐)
npm install -g github:wanlihang/helmcode
helmcode install --preset java-ddd

# 锁定到特定版本
npm install -g github:wanlihang/helmcode#v3.0.0

# 一次性使用(无需全局安装)
npx -y github:wanlihang/helmcode install --preset java-ddd

# 项目级安装
npm install --save-dev github:wanlihang/helmcode
npx helmcode install

# 升级(自更新 + 重装项目文件)
helmcode update
```

安装完成后验证:

```bash
helmcode status      # 查看安装状态、版本、远程更新检查
helmcode version     # 查看版本和安装方式(npm-global / npx / git-clone)
```

## 快速开始

> **前置条件**:HelmCode 已安装到目标项目;在 [Claude Code](https://claude.ai/code) 里打开该项目。

在 Claude Code 对话框输入:

```text
/dev-flow 给订单系统增加"取消订单"功能
```

HelmCode 自动:

1. 进入 **clarify**,询问状态机、业务规则、API 边界等关键问题 → 产出行为契约(`draft`)。
2. 等你确认契约(`draft → approved`)。
3. 进入 **`/goal` 自主循环**,反复 implement → verify 直到所有硬约束满足。
4. `goal achieved` 后进入 **checkpoint**,展示 ⚠️ 决策项让你审,审完 commit。

你只在 2 个节点介入:**审契约** + **审 ⚠️ 决策**。中间的代码生成 / 编译 / 测试 / 修复全自主。

## 使用指南

### 完整闭环工作流

```text
┌────────────────────────────────────────────────────────────────┐
│  人:输入需求                                                    │
│       ↓                                                        │
│  Phase 1: /clarify                                             │
│    AI 读现有代码 + standards → 问澄清问题 → 产出行为契约 draft   │
│       ↓                                                        │
│  ★ 人审契约:状态机完整? 业务规则精确? AC 可程序验证?         │
│    draft → approved                                            │
│       ↓                                                        │
│  Phase 2: /goal 自主循环(完全无人介入)                          │
│    ┌─ Turn N: implement 读契约+patterns → 生成业务代码          │
│    │           + 同步生成测试 → verify 跑 4 项检查              │
│    │    ↓                                                      │
│    ├─ Haiku 评估器看会话:4 项硬约束全满足?                     │
│    │   否 → 下一 turn,implement 自动分析错误并修复              │
│    │   是 → goal achieved                                      │
│    │                                                           │
│    └─ 安全阀:8 次连续 block 自动停,交还控制权给人              │
│       ↓                                                        │
│  Phase 3: /checkpoint                                          │
│    展示判断日志的 ⚠️ 项 → 人逐个拍板                            │
│       ↓                                                        │
│  ★ 人确认 ⚠️ → git commit(契约 status → done)                  │
└────────────────────────────────────────────────────────────────┘
```

### Goal 达成判定标准

每个 turn 结束 `verify` 打印全部信号。Haiku 评估器在 **headline 防线**全绿 + 所有**核心(P0) AC** 通过时判 `goal achieved`。所有信号串的唯一事实源：[`core/dev-flow/references/signal-glossary.md`](core/dev-flow/references/signal-glossary.md)——`verify` emit、`compile-goal.mjs` 查找、本表只引用。

| 检查项 | 通过信号（见 glossary） | 失败处理 |
| --- | --- | --- |
| **AC-coverage**（headline，success predicate） | `✅ AC-coverage：AC-{a}~AC-{b} 全部 1:1 映射到存在的测试` | 新方法无测试，下一 turn 按契约 AC-测试映射表补 |
| **编译** | `✅ 编译通过：BUILD SUCCESS` | 下一 turn 分析错误并修复 |
| **测试**（N≥1 sanity gate） | `✅ 测试通过：Tests run: {N} (N ≥ 1), Failures: 0` | **`N = 0` 视为失败**("测试不存在"),下一 turn 先补测试 |
| **字段同步** | `✅ 字段同步：全部通过` | 下一 turn 补缺失字段 |
| **架构合规** | `✅ 架构合规：全部通过` | 下一 turn 按 review-rules 调整 |
| **完成** | `✅ 所有验证通过`（次要 AC 失败时为 `✅ 核心 AC 全部通过，次要 AC-{ids} 转 ⚠️ 留 checkpoint`） | 核心 AC 失败——goal 未达成 |

> **v2.1.0 → v3.0 变更：headline 防线从 `Tests run: N ≥ 1` 改为 `SIG-ACCOV`（AC-coverage 1:1）。** N≥1 是 *coverage criterion*（采样代理）——只挡"全项目零测试"，挡不住"新方法裸奔"。`SIG-ACCOV` 是 *success predicate*：核验契约 AC-测试映射表每条 AC 都 1:1 映射到存在的测试。N≥1 保留为 sanity gate 但不再是 headline。见 [`verify-harness.md`](core/dev-flow/references/verify-harness.md) 和 glossary。
>
> **v3.0 另增：核心/次要 AC 分组。** AC 带 `优先级: P0|P1`，核心必须全绿才 goal achieved，次要失败降级为 ⚠️ 交 `/checkpoint`，不阻塞 goal。且 **goal 现由 `node scripts/compile-goal.mjs` 确定性生成**，不再手推导。跑 `node scripts/verify-glossary.mjs` 检查信号串是否跨 glossary / compile-goal / verify 漂移。

### 命令清单

| 命令 | 触发时机 | 说明 |
| --- | --- | --- |
| `/dev-flow {需求}` | **首选** | 完整主流程:clarify → /goal → checkpoint |
| `/clarify` | 单独使用 | 仅需求澄清,产出行为契约 |
| `/implement` | `/goal` 内自动调 | 代码生成 worker(单独跑会缺 verify 闭环) |
| `/verify` | `/goal` 内自动调 / 单独验证 | 跑 4 项验证 |
| `/analyze` | 主动审查 | 架构合规检查(独立于 `/goal` 之外) |
| `/checkpoint` | `goal achieved` 后 | 展示判断日志 ⚠️ 项让人审 |

### 人介入节点

只有 **2 个节点**需要人介入:

| 节点 | 你做什么 | 为什么不能让 AI 自己拍板 |
| --- | --- | --- |
| **Phase 1 之后** | 审 `.claude/contracts/{F-ID}.md` draft → 改 status 为 `approved` | 需求理解错了,后面循环再多遍都是错的 |
| **Phase 3 checkpoint** | 审 `.claude/judgment-logs/{F-ID}.md` 的 ⚠️ 决策项 | AI 标记的"不确定决策"必须人拍板,否则就是把责任甩给 AI |

中间 `/goal` 闭环里,AI 自己写代码、跑编译、跑测试、看错误、修代码——**不需要你介入**。除非 8 次连续 block 触发安全阀,这时循环会停下来等你指导。

### 典型场景

| 场景 | 示例 prompt |
| --- | --- |
| **0→1** 新功能 | `/dev-flow 给订单系统加"批量退款"功能` |
| **1→N** 扩展 | `/dev-flow 给 F003-payment 加"支持微信渠道"` |
| **Bug 修复** | `/dev-flow 修 F002-daily-report 的并发数据重复问题` |
| **探索阶段**(仅 clarify) | `/clarify 我想做一个对账平台,先帮我梳理边界` |

### 故障排查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `/goal` 跑 8 次后停 | 安全阀触发(通常是编译错误反复修不好) | 看最后几 turn 的错误,手动给指导(依赖路径 / 正确语法 / 降低范围) |
| `Tests run: 0` 一直不通过 | implement 没主动生成测试 | 检查契约是否有清晰 AC;手动提示"按 patterns/test.md 给 `{Facade}` 生成 ACTS 4 用例" |
| `goal achieved` 但代码明显不对 | Haiku 评估器只做文本匹配,可能被假阳性骗(v2.1.0 已修复 `Tests = 0` 漏洞,其他场景仍可能) | checkpoint 阶段严格审 ⚠️;不要盲目 commit |
| 契约 `approved` 但 `/goal` 跑不起来 | `registry.md` 状态不一致 / 契约文件名不匹配 | 跑 `helmcode status` 查;或手动改 `registry.md` |
| 编译过但 `verify-field-sync` 报错 | DO / Entity / Convert 字段不一致 | 下一 turn 通常自动补;如反复补不全,人改一次再继续 |

## Feature 状态机

```text
draft → approved → goal-running → done
  ↓                  ↓             ↓
abandoned         blocked       (committed)
```

| 状态 | 含义 | 触发 |
| --- | --- | --- |
| `draft` | clarify 产出契约,等人审 | clarify 完成 |
| `approved` | 人审通过,可进 `/goal` | 人手动改 status |
| `goal-running` | `/goal` 自主循环中 | dev-flow Phase 2 开始 |
| `done` | checkpoint 通过 + commit | dev-flow Phase 3 完成 |
| `blocked` | 8 次连续 block 安全阀触发 | `/goal` 中断 |
| `abandoned` | 主动放弃 | 人决定 |

## 编码标准

HelmCode 内置可插拔的技术标准集。

### Java DDD(默认)

基于 7 个真实生产项目分析提炼的完整 Java Spring Boot DDD 标准:

- **编码标准** — 分层、注解、异常、事务、命名。
- **审查规则** — 9 类(A0–H)架构合规检查,含 §A0 包内聚硬约束。
- **测试标准** — 覆盖率目标、Mock 规则、测试结构。
- **代码模式** — Entity、Facade、Aggregate、Repository、Strategy、Builder、Handler、Acceptor 等(12 份)。

**项目自动检测**:`helmcode install` 扫描已有代码并生成 `project-conventions.md` 覆盖默认值。可检测:

- DO 注解风格(`@Data` / `@Getter + @Setter` / 纯手写)
- Facade 模式(`@RpcProvider` / `@SofaService`、`BizTemplate` / 手写)
- MapStruct 用法(`INSTANCE` / `I` / 手写)
- 持久层框架(MyBatis XML / MyBatis-Plus)

### Minimal

仅核心工作流,不带任何技术栈标准。

## 项目结构

执行 `helmcode install --preset java-ddd` 后:

```text
your-project/
├── CLAUDE.md                            # HelmCode 项目配置
├── .claude/
│   ├── skills/                          # Slash 命令技能
│   │   ├── dev-flow/SKILL.md
│   │   ├── clarify/SKILL.md + references/
│   │   ├── implement/SKILL.md + references/
│   │   ├── verify/SKILL.md
│   │   ├── analyze/SKILL.md
│   │   └── init-java-ddd/SKILL.md + references/ + templates/ + claude-md/
│   ├── standards/                       # 编码标准
│   │   ├── standards.md
│   │   ├── project-conventions.md       # 自动检测的覆盖项
│   │   ├── review-rules.md
│   │   ├── test-standards.md
│   │   └── patterns/(12 份)
│   ├── contracts/                       # 行为契约
│   │   └── registry.md
│   ├── briefs/                          # 项目简报(仅供人阅读)
│   ├── judgment-logs/                   # 判断日志
│   ├── commands/                        # /checkpoint、/state
│   ├── scripts/                         # 验证脚本
│   └── .helmcode-version                # 安装元信息
```

## 示例

**行为契约**(`.claude/contracts/F001-recon-task.md`):

```markdown
# Feature: F001-recon-task

## Problem Definition
平台-渠道交易对账需要自动化。

## State Machine
INIT → DATA_PREPARED → PROCESSING → WAIT_CONFIRM → COMPLETED
                                                  → FAILED

## Business Rules
- BR-001: 同一商户 + 账单月份不允许存在重复 active 任务
- BR-002: 只有 WAIT_CONFIRM 状态可被确认 / 拒绝

## API Contract
| 方法       | 请求              | 返回           | 规则   | 错误码           |
| ---------- | ----------------- | -------------- | ------ | ---------------- |
| createTask | CreateTaskCommand | Result<Long>   | BR-001 | TASK_DUPLICATE   |
```

**判断日志**(`.claude/judgment-logs/F001-recon-task.md`):

```markdown
## Made Decisions
- [JD-001] 多渠道数据源采用策略模式
  参考: standards/patterns/strategy.md

## Needs Confirmation
- [JD-004] ⚠️ 超时检查每 5 分钟跑一次,30 分钟超时实际有 5–10 分钟
  误差。是否可接受?
```

## 对比

| | 传统方式 | HelmCode |
| --- | --- | --- |
| 人审查范围 | 全部 diff | 仅判断日志 |
| AI 规约输入 | 散落文档 | 单一行为契约 |
| 上下文占用 | 365 KB+ | ~55 KB |
| 审查模式 | 代码审查 | 决策审查 |
| 技术栈 | 固定 | 可插拔 preset |
| 闭环驱动 | 人工往返 | `/goal` + Haiku 评估器 |

## CLI 参考

```bash
helmcode install [--preset java-ddd|minimal] [--project DIR] [--force] [--global-loader]
helmcode status  [--project DIR]                                   # 安装状态、版本、远程更新检查
helmcode update  [--project DIR] [--global-loader] [--no-self-update]
                                                                   # npm update -g / git pull + 重装项目文件
helmcode version                                                   # 版本 + 安装方式
helmcode list                                                      # 列出可用 preset 和 skills
helmcode --version, -v                                             # 简化版本输出
```

### v3.0.0 新能力

- **goal 机制升级** — headline 防线从 `Tests run: N ≥ 1`（coverage 代理）升级为 `SIG-ACCOV`（success predicate，核验每条 AC 都 1:1 映射到存在的测试）。见 [`signal-glossary.md`](core/dev-flow/references/signal-glossary.md)。
- **确定性 goal 编译** — `node scripts/compile-goal.mjs` 从契约 AC 经客观闸门定档生成 `/goal` 文本（不再 LLM 手推导）。见 [`goal-condition-builder.md`](core/dev-flow/references/goal-condition-builder.md)。
- **信号单一事实源** — 评估器信号串统一在 `signal-glossary.md`；`scripts/verify-glossary.mjs` 三方对账防 drift（开发态 + 安装态都能跑）。
- **核心/次要 AC 分组** — AC 带 `优先级: P0|P1`；核心 AC 全绿即 `goal achieved`，次要 AC 失败转 ⚠️ 留 checkpoint，不阻塞。
- **Breaking** — 契约 AC 现需 `优先级: P0|P1` 字段 + `验证方式` 取自 `{编译,测试,脚本,命令}`；旧契约需补这些字段才能被 compile-goal 解析。

### v2.1.0 新能力

- **自更新** — `helmcode update` 自动识别安装方式(`npm-global` / `git-clone` / `npx`)拉取最新源后重装项目文件。
- **版本追踪** — `.claude/.helmcode-version` 记录安装版本、方式、preset、时间戳。
- **`--no-self-update`** — 仅重装项目文件,跳过源码自更新(适合 air-gapped 环境)。

## 贡献

欢迎贡献。请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解贡献流程。

## 许可证

[MIT](./LICENSE)
