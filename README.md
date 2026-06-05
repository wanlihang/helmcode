<p align="center">
  <strong>HelmCode</strong>
</p>

<p align="center">
  An AI coding workflow where humans steer and AI rows.<br>
  <code>clarify → /goal (autonomous loop) → checkpoint</code>
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

> **🚢 Looking for the multi-agent platform?** The full-loop AI coding platform (web portal + 5-node agent pipeline + cross-node fix-task loops + multi-project onboarding) lives in [**HelmFlow**](https://github.com/wanlihang/helmflow). HelmCode (this repo) stays focused on **the lightweight standards + skill installer** that any project can adopt; HelmFlow consumes HelmCode standards and adds the platform layer on top.

---

## Table of Contents

- [Why HelmCode?](#why-helmcode)
- [Key Concepts](#key-concepts)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage Guide](#usage-guide)
  - [End-to-End Workflow](#end-to-end-workflow)
  - [Goal Achievement Criteria](#goal-achievement-criteria)
  - [Command Reference](#command-reference)
  - [Human Checkpoints](#human-checkpoints)
  - [Common Scenarios](#common-scenarios)
  - [Troubleshooting](#troubleshooting)
- [Feature State Machine](#feature-state-machine)
- [Standards](#standards)
- [Project Structure](#project-structure)
- [Example](#example)
- [Comparison](#comparison)
- [CLI Reference](#cli-reference)
- [Contributing](#contributing)
- [License](#license)

---

## Why HelmCode?

When AI writes code, the bottleneck is no longer generation — it is **judgment**.

Reviewing a 400-line diff is slow. Reviewing five key decision points is fast.

HelmCode redesigns the AI coding loop around one principle: **human judgment is the scarcest resource.** Instead of reviewing everything, you review only the decisions that matter.

### How it works

1. **clarify** — You define the problem and constraints. AI produces a **Behavior Contract** — a precise spec for code generation, not a document.
2. **/goal** — Claude Code drives an autonomous loop: implement → verify → fix → verify, until all hard-constraint checks pass.
3. **checkpoint** — You review only the **Judgment Log** — the set of design decisions AI flagged as needing confirmation.

```text
clarify    →  Behavior Contract (what to build + constraints)
/goal      →  Code + Tests + Judgment Log (AI runs the loop autonomously)
checkpoint →  Decision review (you confirm flagged decisions, then commit)
```

## Key Concepts

### Behavior Contract

A single file per feature that replaces scattered spec documents. Contains:

- Problem definition
- State machine (PlantUML)
- Business rules (`BR-xxx`, each programmatically verifiable)
- API contract
- Domain model
- Acceptance criteria

### Judgment Log

The core innovation. AI actively exposes its design decisions:

- `JD-xxx` — Decisions already made (you can skim).
- `JD-xxx ⚠️` — Uncertain decisions (you **must** review).

### Context Budget

~55 KB total context per loop turn (versus 365 KB+ with traditional doc pipelines). Each skill loads only what it needs:

| Skill | Budget |
| --- | --- |
| clarify | 8–10 KB |
| implement | 15–40 KB |
| verify | 5–10 KB |

## Installation

> HelmCode is distributed directly from GitHub. All install commands pull source from `github:wanlihang/helmcode`.

```bash
# Global install (recommended)
npm install -g github:wanlihang/helmcode
helmcode install --preset java-ddd

# Pin to a specific version
npm install -g github:wanlihang/helmcode#v2.1.0

# One-time use (no global install)
npx -y github:wanlihang/helmcode install --preset java-ddd

# Project-local
npm install --save-dev github:wanlihang/helmcode
npx helmcode install

# Upgrade (self-update + reinstall project files)
helmcode update
```

After install, verify with:

```bash
helmcode status      # show installation state, version, remote update check
helmcode version     # show version + install method (npm-global / npx / git-clone)
```

## Quick Start

> **Prerequisites:** HelmCode installed in your project, and the project open in [Claude Code](https://claude.ai/code).

Type in the Claude Code prompt:

```text
/dev-flow Add a "cancel order" feature to the order system
```

HelmCode automatically:

1. Runs **clarify** — asks you about state machine, business rules, API boundaries → produces a behavior contract (`draft`).
2. Waits for you to approve the contract (`draft → approved`).
3. Enters the **`/goal` autonomous loop** — repeatedly runs implement → verify until all hard constraints pass.
4. After `goal achieved`, runs **checkpoint** — surfaces ⚠️ decisions for your review, then commits.

You only intervene at two points: **approve the contract** and **review ⚠️ decisions**. Everything between (code generation, compilation, testing, fixing) is autonomous.

## Usage Guide

### End-to-End Workflow

```text
┌────────────────────────────────────────────────────────────────┐
│  Human: describe the requirement                               │
│       ↓                                                        │
│  Phase 1: /clarify                                             │
│    AI reads existing code + standards → asks clarifying        │
│    questions → produces a Behavior Contract (draft)            │
│       ↓                                                        │
│  ★ Human reviews contract: state machine complete? rules       │
│    precise? ACs programmatically verifiable?                   │
│    draft → approved                                            │
│       ↓                                                        │
│  Phase 2: /goal — autonomous loop (no human intervention)      │
│    ┌─ Turn N: implement reads contract + patterns →            │
│    │           generates code + tests → verify runs 4 checks   │
│    │    ↓                                                      │
│    ├─ Haiku evaluator reads the session: all 4 hard            │
│    │   constraints satisfied?                                  │
│    │   No  → next turn, implement analyzes errors and fixes    │
│    │   Yes → goal achieved                                     │
│    │                                                           │
│    └─ Safety valve: 8 consecutive blocks → loop stops,         │
│       control returns to human                                 │
│       ↓                                                        │
│  Phase 3: /checkpoint                                          │
│    Shows ⚠️ items in the judgment log → human confirms each    │
│       ↓                                                        │
│  ★ Human confirms ⚠️ → git commit (contract status → done)     │
└────────────────────────────────────────────────────────────────┘
```

### Goal Achievement Criteria

`verify` must print all four signals at the end of each turn. Only when all four pass does the Haiku evaluator declare `goal achieved`:

| Check | Pass signal | On failure |
| --- | --- | --- |
| **Compile** | `BUILD SUCCESS` | Next turn analyzes the error and fixes it. |
| **Tests** | `Tests run: N (N ≥ 1), Failures: 0` | **`N = 0` is treated as failure** ("tests do not exist"). Next turn generates tests first. |
| **Field sync** | `verify-field-sync` all ✅ | Next turn fills missing fields. |
| **Arch rules** | `verify-arch-rules` all ✅ | Next turn adjusts per review-rules. |

> **`Tests run ≥ 1` is a hard guard added in v2.1.0.** Without it, AI could skip test generation and let `Tests run: 0, Failures: 0` slip past the Haiku evaluator as a false positive. See `core/verify/SKILL.md` §2.

### Command Reference

| Command | When | Description |
| --- | --- | --- |
| `/dev-flow {requirement}` | **Recommended** | End-to-end pipeline: clarify → /goal → checkpoint. |
| `/clarify` | Standalone | Requirement clarification only, produces a behavior contract. |
| `/implement` | Auto-invoked inside `/goal` | Code generation worker (running standalone skips the verify loop). |
| `/verify` | Auto-invoked inside `/goal` / standalone | Runs the 4 verification checks. |
| `/analyze` | On demand | Architecture compliance check (independent of `/goal`). |
| `/checkpoint` | After `goal achieved` | Surfaces ⚠️ items in the judgment log for human review. |

### Human Checkpoints

Only **two** points require human intervention:

| Checkpoint | What you do | Why AI cannot decide alone |
| --- | --- | --- |
| **After Phase 1** | Review `.claude/contracts/{F-ID}.md` (draft) → change status to `approved`. | If the requirement is misunderstood, no amount of looping fixes it. |
| **Phase 3 checkpoint** | Review ⚠️ items in `.claude/judgment-logs/{F-ID}.md`. | AI's flagged "uncertain decisions" must be ratified by a human — otherwise responsibility is silently transferred to AI. |

Inside the `/goal` loop, AI writes code, runs the compiler, runs tests, reads errors, and fixes code — **without your involvement**. The only exception is when 8 consecutive blocks trigger the safety valve; the loop then stops and waits for your guidance.

### Common Scenarios

| Scenario | Example prompt |
| --- | --- |
| **0→1** new feature | `/dev-flow Add a "batch refund" feature to the order system` |
| **1→N** extension | `/dev-flow Add WeChat channel support to F003-payment` |
| **Bug fix** | `/dev-flow Fix the concurrent-duplicate issue in F002-daily-report` |
| **Exploration** (clarify only) | `/clarify I want to build a reconciliation platform — help me scope the boundaries first` |

### Troubleshooting

| Symptom | Cause | Resolution |
| --- | --- | --- |
| `/goal` stops after 8 turns | Safety valve triggered (usually a compile error that keeps re-occurring). | Read the last few turns' errors, then give explicit guidance (dependency path, correct syntax, or scope reduction). |
| `Tests run: 0` keeps failing | implement did not generate tests on its own. | Check that the contract has clear ACs; manually prompt: "generate ACTS 4-case suite for `{Facade}` per patterns/test.md". |
| `goal achieved` but the code is obviously wrong | The Haiku evaluator is text-match-based and can be fooled by false positives (v2.1.0 closed the `Tests = 0` loophole; other vectors still exist). | Be strict during the checkpoint review of ⚠️ items. Do not commit blindly. |
| Contract `approved` but `/goal` will not start | `registry.md` status mismatch or contract filename does not match. | Run `helmcode status`; or fix `registry.md` manually. |
| Compile passes but `verify-field-sync` fails | DO / Entity / Convert fields out of sync. | Next turn usually backfills automatically. If it loops, manually patch one field, then continue. |

## Feature State Machine

```text
draft → approved → goal-running → done
  ↓                  ↓             ↓
abandoned         blocked       (committed)
```

| State | Meaning | Trigger |
| --- | --- | --- |
| `draft` | clarify produced contract, awaiting human review | clarify completes |
| `approved` | Human approved, ready for `/goal` | Human edits status |
| `goal-running` | `/goal` loop in progress | dev-flow Phase 2 begins |
| `done` | checkpoint passed + commit | dev-flow Phase 3 completes |
| `blocked` | 8-consecutive-block safety valve tripped | `/goal` interrupted |
| `abandoned` | Discarded | Human decides |

## Standards

HelmCode ships with pluggable technology standards.

### Java DDD (default)

Complete Java Spring Boot DDD standards distilled from analysis of 7 production projects:

- **Coding standards** — Layering, annotations, exceptions, transactions, naming.
- **Review rules** — 9 categories (A0–H) of architecture compliance checks, including §A0 package cohesion.
- **Test standards** — Coverage targets, mock rules, test structure.
- **Code patterns** — Entity, Facade, Aggregate, Repository, Strategy, Builder, Handler, Acceptor, etc. (12 files).

**Project auto-detection:** `helmcode install` scans existing code and emits `project-conventions.md` to override defaults. Detects:

- DO annotation style (`@Data` / `@Getter + @Setter` / plain).
- Facade pattern (`@RpcProvider` / `@SofaService`; `BizTemplate` / manual).
- MapStruct usage (`INSTANCE` / `I` / hand-written).
- Persistence framework (MyBatis XML / MyBatis-Plus).

### Minimal

Core workflow only, no technology-specific standards.

## Project Structure

After `helmcode install --preset java-ddd`:

```text
your-project/
├── CLAUDE.md                            # HelmCode project config
├── .claude/
│   ├── skills/                          # Slash-command skills
│   │   ├── dev-flow/SKILL.md
│   │   ├── clarify/SKILL.md + references/
│   │   ├── implement/SKILL.md + references/
│   │   ├── verify/SKILL.md
│   │   ├── analyze/SKILL.md
│   │   └── init-java-ddd/SKILL.md + references/ + templates/ + claude-md/
│   ├── standards/                       # Coding standards
│   │   ├── standards.md
│   │   ├── project-conventions.md       # Auto-detected overrides
│   │   ├── review-rules.md
│   │   ├── test-standards.md
│   │   └── patterns/ (12 files)
│   ├── contracts/                       # Behavior contracts
│   │   └── registry.md
│   ├── briefs/                          # Project briefs (human-only)
│   ├── judgment-logs/                   # Judgment logs
│   ├── commands/                        # /checkpoint, /state
│   ├── scripts/                         # Verify scripts
│   └── .helmcode-version                # Install metadata
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
- BR-001: Same merchant + billMonth cannot have duplicate active tasks
- BR-002: Only WAIT_CONFIRM status can be confirmed/rejected

## API Contract
| Method     | Request           | Response       | Rules  | Error Codes      |
| ---------- | ----------------- | -------------- | ------ | ---------------- |
| createTask | CreateTaskCommand | Result<Long>   | BR-001 | TASK_DUPLICATE   |
```

**Judgment Log** (`.claude/judgment-logs/F001-recon-task.md`):

```markdown
## Made Decisions
- [JD-001] Used strategy pattern for multi-channel data sources
  Reference: standards/patterns/strategy.md

## Needs Confirmation
- [JD-004] ⚠️ Timeout check runs every 5 min; the 30-min timeout therefore has
  a 5–10 min margin of error. Acceptable?
```

## Comparison

| | Traditional | HelmCode |
| --- | --- | --- |
| Human reviews | Entire diff | Judgment log only |
| AI spec input | Scattered docs | Single behavior contract |
| Context usage | 365 KB+ | ~55 KB |
| Review model | Code review | Decision review |
| Tech stack | Fixed | Pluggable presets |
| Loop driver | Manual back-and-forth | `/goal` + Haiku evaluator |

## CLI Reference

```bash
helmcode install [--preset java-ddd|minimal] [--project DIR] [--force] [--global-loader]
helmcode status  [--project DIR]                                   # installation state, version, remote update check
helmcode update  [--project DIR] [--global-loader] [--no-self-update]
                                                                   # npm update -g / git pull + reinstall project files
helmcode version                                                   # version + install method
helmcode list                                                      # available presets and skills
helmcode --version, -v                                             # short version output
```

### v2.1.0 Highlights

- **Self-update** — `helmcode update` auto-detects install method (`npm-global` / `git-clone` / `npx`) and pulls the latest source before reinstalling project files.
- **Version tracking** — `.claude/.helmcode-version` records install version, method, preset, and timestamp.
- **`--no-self-update`** — Reinstall project files only, skipping source self-update (for air-gapped environments).

## Contributing

Contributions are welcome. Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

[MIT](./LICENSE)
