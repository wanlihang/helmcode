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

```bash
# Global install (recommended)
npm install -g helmcode
helmcode install --preset java-ddd

# One-time use
npx helmcode install --preset java-ddd

# Project-level
npm install --save-dev helmcode
npx helmcode install

# Check status
helmcode status
```

## Usage

After installation, use slash commands in [Claude Code](https://claude.ai/code):

```
/dev-flow              # Full workflow (clarify → implement → verify)
/clarify --feature F001-user-registration
/implement --feature F001-user-registration
/verify --feature F001-user-registration
/analyze               # Architecture compliance check
```

### Workflow

```
/dev-flow
    │
    ├─ Step 1: /clarify
    │   AI reads existing code + standards
    │   Produces: Behavior Contract (draft)
    │   You review → approve (draft → approved)
    │
    ├─ Step 2: /implement
    │   AI reads: contract + standards + patterns
    │   Generates code + Judgment Log
    │   Pauses on: 3 failures | uncertain decisions | new dependencies
    │
    └─ Step 3: /verify
        Auto-validation: compile + test + architecture rules
        You review: Judgment Log decisions
        Confirm → git commit (contract status → done)
```

### Feature State Machine

```
draft → approved → implementing → done
  ↓                  ↓           ↓
abandoned         blocked     (committed)
```

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
│   │   └── analyze/SKILL.md
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

## CLI Reference

```bash
helmcode install [--preset java-ddd|minimal] [--project dir] [--force]
helmcode status [--project dir]
helmcode update [--project dir]
helmcode list
```

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

[MIT](./LICENSE)