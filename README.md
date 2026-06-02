<p align="center">
  <strong>HelmCode</strong>
</p>

<p align="center">
  AI Coding Workflow: clarify → implement → verify<br>
  You steer, AI rows.
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/helmcode?style=flat&colorA=080f12&colorB=1fa669" alt="npm version">
  <img src="https://img.shields.io/npm/dm/helmcode?style=flat&colorA=080f12&colorB=1fa669" alt="npm downloads">
  <img src="https://img.shields.io/github/license/mojue/helmcode?style=flat&colorA=080f12&colorB=1fa669" alt="License">
  <img src="https://img.shields.io/node/v/helmcode?style=flat&colorA=080f12&colorB=1fa669" alt="Node version">
</p>

---

## Why HelmCode?

When AI writes code, the bottleneck isn't generation — it's **judgment**.

Reviewing a 400-line diff is slow. Reviewing 5 key decision points is fast.

HelmCode redesigns the AI coding loop around one principle: **human judgment is the scarcest resource**. Instead of reviewing everything, you review only the decisions that matter.

**How it works:**

1. **clarify** — You define the problem and constraints. AI produces a **Behavior Contract** (not a document, a precise spec for code generation).
2. **implement** — AI generates code and a **Judgment Log** — a list of design decisions it made, tagged by confidence.
3. **verify** — AI validates correctness. You review only the **Judgment Log**, not the entire diff.

```
clarify  →  Behavior Contract (what to build + constraints)
implement →  Code + Judgment Log (what AI decided + what needs your input)
verify   →  Validation + Judgment Review (you review decisions, not diffs)
```

## Key Concepts

### Behavior Contract

A single file per feature that replaces scattered spec documents. Contains:
- Problem definition
- State machine (PlantUML)
- Business rules (BR-xxx, each verifiable)
- API contract
- Domain model
- Acceptance criteria

### Judgment Log

The core innovation. AI actively exposes its design decisions:
- **JD-xxx** — Made decisions (you can skim these)
- **JD-xxx ⚠️** — Uncertain decisions (you **must** review these)

### Context Budget

~55KB total context (vs. 365KB+ with traditional doc pipelines). Each skill loads only what it needs:
- clarify: ~8-10KB
- implement: 15-40KB
- verify: ~5-10KB

## Installation

> **Distribution**: HelmCode is distributed directly from GitHub — there is no npm package. All install commands below pull source from `github:wanlihang/helmcode`.

```bash
# Global install (recommended)
npm install -g github:wanlihang/helmcode
helmcode install --preset java-ddd

# Pin a version (release tag)
npm install -g github:wanlihang/helmcode#v2.0.3

# One-time use (no global install)
npx -y github:wanlihang/helmcode install --preset java-ddd

# Project-level
npm install --save-dev github:wanlihang/helmcode
npx helmcode install

# Check status
helmcode status

# Upgrade
npm install -g github:wanlihang/helmcode    # re-pull HEAD of main
helmcode update                             # re-sync skills/standards into project
```

## Usage Guide

> **前置条件**:已 `helmcode install` 安装到目标项目;在 [Claude Code](https://claude.ai/code) 里打开该项目。

### Quick Start(5 分钟跑通最小 Feature)

```bash
# 在 Claude Code 对话框里输入:
/dev-flow 我要给订单系统增加"取消订单"功能
```

HelmCode 会自动:
1. 进入 clarify,问你状态机、业务规则、API 边界等关键问题 → 产出**行为契约 draft**
2. 等你确认契约(draft → approved)
3. 进入 `/goal` 自主循环,反复 implement → verify 直到所有硬约束满足
4. goal achieved 后进入 checkpoint,展示判断日志 ⚠️ 项让你审

你只需要在 2 个节点介入:**审契约** + **审 ⚠️ 决策**。中间的代码生成/编译/测试/修复 AI 全自动跑。

---

### 完整闭环工作流

```
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

### 闭环硬约束(Haiku 评估器的 goal 达成标准)

每个 turn 结束 verify 必须打印出以下 4 项,全满足才算 goal achieved:

| 检查项 | 通过信号 | 失败处理 |
|--------|---------|---------|
| **编译** | `BUILD SUCCESS` | 下一 turn 分析错误并修 |
| **测试** | `Tests run: N (N ≥ 1), Failures: 0` | **N=0 视为失败"测试不存在"**,下一 turn 先补测试 |
| **字段同步** | `verify-field-sync` 全部 ✅ | 下一 turn 补缺失字段 |
| **架构合规** | `verify-arch-rules` 全部 ✅ | 下一 turn 按 review-rules 调整 |

> **`Tests run ≥ 1` 是 v2.1.0 后的关键约束**——防止 AI 跳过测试用 `Tests run: 0, Failures: 0` 骗 Haiku 误判 goal achieved。详见 `core/verify/SKILL.md` §2。

### 命令清单

| 命令 | 触发时机 | 说明 |
|------|---------|------|
| `/dev-flow {需求}` | **首选** | 完整主流程,clarify → /goal → checkpoint 一条龙 |
| `/clarify` | 单独使用 | 只做需求澄清,产出行为契约 |
| `/implement` | `/goal` 内自动调 | 代码生成 worker(单独跑会缺 verify 闭环) |
| `/verify` | `/goal` 内自动调 / 单独验证 | 跑 4 项验证 |
| `/analyze` | 主动审查 | 架构合规检查(独立于 /goal 之外) |
| `/checkpoint` | goal achieved 后 | 展示判断日志 ⚠️ 项让人审 |

### 何时必须人介入(只有 2 个节点)

| 节点 | 你做什么 | 为什么不能让 AI 自己拍板 |
|------|---------|----------------------|
| **Phase 1 之后** | 审 `.claude/contracts/{F-ID}.md` draft → 改 status 为 `approved` | 需求理解错了,后面循环再多遍都是错的 |
| **Phase 3 checkpoint** | 审 `.claude/judgment-logs/{F-ID}.md` 里 ⚠️ 决策项 | AI 标记的"不确定决策"必须人拍板,否则就是把锅甩给 AI |

中间 `/goal` 闭环里:AI 自己写代码、跑编译、跑测试、看错误、修代码——**不需要你介入**。除非 8 次连续 block 触发安全阀(那时它会停下来等你指导)。

### 典型场景

**场景 A — 0→1 新功能**:`/dev-flow 给订单系统加"批量退款"功能`

**场景 B — 1→N 扩展**:`/dev-flow 给 F003-payment 加"支持微信渠道"`(基于已存在的契约扩)

**场景 C — Bug 修复**:`/dev-flow 修 F002-daily-report 的并发时数据重复问题`

**场景 D — 只澄清不实现**(探索阶段):`/clarify 我想做一个对账平台,先帮我梳理清楚边界`

### 故障排查

| 现象 | 原因 | 处理 |
|------|------|------|
| `/goal` 跑 8 次后停 | 连续 block 安全阀触发(通常是编译错误反复修不好) | 看会话最后几 turn 的错误,手动指导(给依赖路径/给正确语法/降低范围) |
| Tests run: 0 一直不通过 | implement 没主动生成测试 | 检查契约是否有清晰 AC;手动提示"按 patterns/test.md 给 {Facade} 生成 ACTS 4 用例" |
| `goal achieved` 但代码明显不对 | Haiku 评估器只做文本匹配,可能被假阳性骗(v2.1.0 已修复 Tests N≥1 漏洞,其他场景仍可能) | checkpoint 阶段严格审 ⚠️;不要直接 commit |
| 契约 approved 但 `/goal` 跑不起来 | registry.md 状态不一致 / 契约文件名不匹配 | 跑 `helmcode status` 查;或手动改 registry.md |
| 编译过但 verify-field-sync 报错 | DO/Entity/Convert 字段不一致 | 看脚本输出的缺失字段,下一 turn 通常会自动补;如果反复补不全,人改一次再继续 |

## Standards

HelmCode ships with pluggable technology standards:

### Java DDD (default)

Complete Java Spring Boot DDD standards based on analysis of 7 production projects:

- **Coding standards** — Layering, annotations, exceptions, transactions, naming
- **Review rules** — 8 categories (A-H) of architecture compliance checks
- **Test standards** — Coverage targets, mock rules, test structure
- **Code patterns** — Entity, Facade, Aggregate, Repository, Strategy, Builder, etc.

**Project auto-detection:** `helmcode install` scans existing code and generates `project-conventions.md` to override defaults. Detects:
- DO annotation style (`@Data` / `@Getter+@Setter` / plain)
- Facade pattern (`@RpcProvider` / `@SofaService`, BizTemplate / manual)
- MapStruct usage (INSTANCE / I / hand-written)
- Persistence framework (MyBatis XML / MyBatis-Plus)

### Minimal

Core workflow only, no technology-specific standards.

## Project Structure

After `helmcode install --preset java-ddd`:

```
your-project/
├── CLAUDE.md                          # HelmCode config
├── .claude/
│   ├── skills/                        # Slash command skills
│   │   ├── dev-flow/SKILL.md
│   │   ├── clarify/SKILL.md + references/
│   │   ├── implement/SKILL.md + references/
│   │   ├── verify/SKILL.md
│   │   ├── analyze/SKILL.md
│   │   └── init-java-ddd/SKILL.md + references/ + templates/ + claude-md/
│   ├── standards/                     # Coding standards
│   │   ├── standards.md
│   │   ├── project-conventions.md     # Auto-detected overrides
│   │   ├── review-rules.md
│   │   ├── test-standards.md
│   │   └── patterns/ (10 files)
│   ├── contracts/                     # Behavior contracts
│   │   └── registry.md
│   ├── briefs/                        # Project briefs (human-only)
│   ├── judgment-logs/                 # Judgment logs
│   ├── commands/                      # Checkpoint, state
│   └── scripts/                       # Verify scripts
```

## Example

**Behavior Contract** (`.claude/contracts/F001-recon-task.md`):

```markdown
# Feature: F001-recon-task

## Problem Definition
Platform-channel transaction reconciliation needs automation.

## State Machine
INIT → DATA_PREPARED → PROCESSING → WAIT_CONFIRM → COMPLETED
                                                  → FAILED

## Business Rules
- BR-001: Same merchant+billMonth cannot have duplicate active tasks
- BR-002: Only WAIT_CONFIRM status can be confirmed/rejected

## API Contract
| Method | Request | Response | Rules | Error Codes |
|--------|---------|----------|-------|-------------|
| createTask | CreateTaskCommand | Result<Long> | BR-001 | TASK_DUPLICATE |
```

**Judgment Log** (`.claude/judgment-logs/F001-recon-task.md`):

```markdown
## Made Decisions
- [JD-001] Used strategy pattern for multi-channel data sources
  Reference: standards/patterns/strategy.md

## Needs Confirmation
- [JD-004] ⚠️ Timeout check runs every 5 min, 30-min timeout has 5-10 min
  margin of error. Acceptable?
```

## Comparison

| | Traditional | HelmCode |
|---|---|---|
| Human reviews | Entire diff | Judgment log only |
| AI spec input | Scattered docs | Single behavior contract |
| Context usage | 365KB+ | ~55KB |
| Review model | Code review | Decision review |
| Tech stack | Fixed | Pluggable presets |

## Feature State Machine

```
draft → approved → goal-running → done
  ↓                  ↓             ↓
abandoned         blocked       (committed)
```

| 状态 | 含义 | 触发 |
|------|------|------|
| `draft` | clarify 产出契约,等人审 | clarify 完成 |
| `approved` | 人审通过,等进 /goal | 人手动改 status |
| `goal-running` | /goal 自主循环中 | dev-flow Phase 2 设置 |
| `done` | checkpoint 通过 + commit | dev-flow Phase 3 完成 |
| `blocked` | 8 次连续 block 安全阀触发 | /goal 中断 |
| `abandoned` | 主动放弃 | 人决定 |

## CLI Reference

```bash
helmcode install [--preset java-ddd|minimal] [--project dir] [--force] [--global-loader]
helmcode status  [--project dir]                       # 显示安装状态、版本、远程更新检查
helmcode update  [--project dir] [--global-loader] [--no-self-update]
                                                       # 自动 npm update -g / git pull + 重装项目文件
helmcode version                                       # 显示版本和安装方式(npm-global/npm-local/git-clone/npx)
helmcode list                                          # 列出可用 preset 和 skills
helmcode --version, -v                                 # 简化版本输出
```

### v2.1.0 新增能力

- **自更新**:`helmcode update` 自动根据安装方式(npm-global / git-clone / npx)拉取最新源码后再重装
- **版本追踪**:`.claude/.helmcode-version` 记录安装版本/方法/preset/时间戳
- **`--no-self-update`**:仅重装项目文件,跳过源码自更新(适合 air-gapped 环境)

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

[MIT](./LICENSE)