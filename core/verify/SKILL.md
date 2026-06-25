---
name: verify
description: |
  验证动作集。在 /goal 循环内被 implement 每个 turn 调用。
  不再是独立的手动步骤，而是 AI 自主执行的验证动作：
  AC-coverage 核验、编译、测试、脚本检查。结果出现在会话中供 Haiku 评估器判断。

  触发场景：
  - /goal 循环内每个 turn 自动执行
  - 用户手动说"验证"、"检查"

  注意：验证结果必须输出到会话中（不只是文件中），
  因为 Haiku 评估器只能看会话内容来判断 goal 是否达成。
  所有 emit 的信号串措辞以 references/signal-glossary.md 为唯一事实源，
  不得自由发挥（否则评估器静默失效，见 glossary 维护规则）。
version: 3.0
author: HelmCode
tags: [verify, 验证, goal-loop, 验证动作]
---

# verify: 验证动作集（goal loop 内使用）

## 核心理念

verify 是一组验证动作，不是独立步骤。它在 `/goal` 循环内被反复调用：
- implement 生成代码后 → verify 检查 → 结果出现在会话中
- Haiku 评估器看会话内容 → 判断 goal 是否达成
- 验证失败 → 下一个 turn implement 自动修复 → 再次 verify

## 关键原则

1. **结果必须在会话中可见**——Haiku 评估器只能看会话内容。
2. **信号串措辞严格按 `references/signal-glossary.md`**——那是唯一事实源。
   emit 侧（本文件）和查找侧（compile-goal 生成的 goal）必须用同一份串，
   否则评估器静默失效。改措辞只去改 glossary，改完跑 `scripts/verify-glossary.mjs` 对账。

## 验证动作

### 0. AC-coverage 核验（headline 防线，最先做）

按 `references/verify-harness.md` 执行：读契约的「AC-测试映射」表，
逐条核验每条「验证方式: 测试」的 AC 是否 1:1 映射到**存在**的测试。

**会话输出要求**（串见 glossary）：
- 全部命中：`✅ AC-coverage：AC-{a}~AC-{b} 全部 1:1 映射到存在的测试`（SIG-ACCOV）
- 有缺失：`❌ AC-coverage：AC-{id} 映射的 {TestClass} 不存在`（SIG-ACCOV-FAIL）

> 这是 **success predicate**，取代旧的「N≥1 当 headline」。
> N≥1 是采样代理，防不住「新方法裸奔」；AC-coverage 核验「新代码每个该有测试的 AC 都真有测试」。
> 详见 `references/verify-harness.md`。

### 1. 编译检查

```bash
# Java
mvn compile -pl {module} -q 2>&1 || echo "COMPILE FAILED"

# Node
npm run build 2>&1 || echo "COMPILE FAILED"
```

**会话输出要求**（SIG-COMPILE / 失败）：
- 通过：`✅ 编译通过：BUILD SUCCESS`
- 失败：`❌ 编译失败` + 错误信息

### 2. 测试验证（N≥1 是 sanity gate）

```bash
# Java - 运行相关 domain 的测试
mvn test -pl {module} -Dtest={Domain}*Test 2>&1

# Node
npm test 2>&1
```

**会话输出要求**（SIG-TEST / SIG-TEST-EMPTY）：
- **通过**: `✅ 测试通过：Tests run: {N} (N ≥ 1), Failures: 0`——**N 必须 ≥ 1**（显式带 N≥1）
- **失败 — 测试运行有错**: `❌ 测试失败` + 失败的测试名和错误信息
- **失败 — 测试不存在**: `Tests run: 0` 即便 `Failures: 0`,**也视为失败**,
  输出 `❌ 测试不存在：Tests run: 0。下一 turn 必须先按 AC-测试映射表 / patterns/test.md
  为新增 Facade 方法 / Domain Service / Handler 生成对应测试用例，再重跑此检查`

> **N≥1 现在是 sanity gate,不是 headline 防线**——headline 是 §0 的 SIG-ACCOV。
> N≥1 只防「全项目零测试」的极端；真正防「新方法裸奔」的是 §0。
> 但 N≥1 仍是硬约束：`Tests run: 0` 一律判失败（防零测试假阳性），不可豁免。

> **跨项目/类型例外**:纯文档/配置类 PR(不含 .java/.ts/.py 业务代码变更)可在
> goal 条件里显式排除测试验证(`--skip-tests`);其他场景 N ≥ 1 不可豁免。

### 3. 字段同步检查

```bash
node .claude/scripts/verify-field-sync.mjs \
  --contract .claude/contracts/{F-ID}.md --project . 2>&1
```

（脚本由 `helmcode install` 安装到 `.claude/scripts/`，如果不存在则跳过此检查）

**会话输出要求**（SIG-FIELDSYNC / 失败）：
- 通过：`✅ 字段同步：全部通过`
- 失败：`❌ 字段同步失败` + 缺失字段详情

### 4. 架构合规检查

```bash
node .claude/scripts/verify-arch-rules.mjs --project . [--domain {domain}] 2>&1
```

（脚本由 `helmcode install` 安装到 `.claude/scripts/`，如果不存在则跳过此检查）

**会话输出要求**（SIG-ARCH / 失败）：
- 通过：`✅ 架构合规：全部通过`
- 失败：`❌ 架构合规失败` + 违反的规则详情

### 5. 验收条件逐条检查（按优先级判定）

逐条检查行为契约中的验收条件，**按 AC 优先级（P0/P1）分组判定**：

```markdown
## 验收条件检查 - {F-ID}

### 核心 AC（P0，必须全绿）
- [x] AC-001: {描述} — ✅ AC-001：{描述} — 通过（测试断言通过）
- [x] AC-002: {描述} — ✅ AC-002：{描述} — 通过
- [ ] AC-003: {描述} — ❌ AC-003：{描述} — 未通过（{原因}）

### 次要 AC（P1，失败转 ⚠️ 不阻塞）
- [x] AC-005: {描述} — ✅ AC-005：{描述} — 通过
- [ ] AC-006: {描述} — ❌ AC-006：{描述} — 未通过 → 转 ⚠️ 留 checkpoint
```

**逐条 emit 规则**（SIG-ACLINE / SIG-ACLINE-FAIL，串见 glossary）：
- 通过：`✅ AC-{id}：{desc} — 通过`
- 未通过：`❌ AC-{id}：{desc} — 未通过`

**这一步 + §0 共同构成 goal 达成的最终判定依据**（见下方汇总）。

### 6. 覆盖率检查（JaCoCo，sanity gate）

跑 `node scripts/verify-coverage.mjs --project <project>`（解析 `jacoco.csv`，对比 test-standards §1 阈值 行≥80% 分支≥70%）。

- report 不存在（未跑 `mvn verify` / 无 JaCoCo）：**跳过**（打印 `ℹ️ 覆盖率：...跳过`），不阻塞。
- 达标：`✅ 覆盖率：行 {L}% / 分支 {B}% 达标`（**SIG-COVERAGE**）
- 未达标：`❌ 覆盖率：行 {L}% / 分支 {B}% 未达阈值（行≥80% 分支≥70%）`（**SIG-COVERAGE-FAIL**）

### 7. 测试有效性检查（反模式，sanity gate）

跑 `node scripts/verify-test-effectiveness.mjs --project <project>`（扫 `*Test.java`，检测空断言/恒真/空 catch）。

- 无测试文件：跳过，不阻塞。
- 干净：`✅ 测试有效性：无空断言/废测试`（**SIG-TEST-EFF**）
- 有反模式：`❌ 测试有效性：{file}:{line} {反模式}`（**SIG-TEST-EFF-FAIL**），下一 turn 修复（补有意义断言）。

> §6/§7 是 AC-coverage（存在性）之后的**广度 + 深度**防线：AC-coverage 管「测试存在」，§6 管「代码被跑到」，§7 管「断言有意义」。
> 两者均 sanity gate（report/脚本不存在则跳过），不取代 §0 headline。

## 验证输出汇总模板

每个 turn 结束时，输出以下汇总（供 Haiku 评估器判断）。
判定逻辑见 `references/signal-glossary.md` 的「信号分组」：

```markdown
## 验证结果 - {F-ID}

| 检查项 | 结果 |
|--------|------|
| AC-coverage | ✅ AC-{a}~AC-{b} 全部 1:1 映射到存在的测试 |
| 编译 | ✅ 编译通过：BUILD SUCCESS |
| 测试 | ✅ 测试通过：Tests run: 12 (N ≥ 1), Failures: 0 |
| 字段同步 | ✅ 字段同步：全部通过 |
| 架构合规 | ✅ 架构合规：全部通过 |
| 覆盖率 | ✅ 覆盖率：行 {L}% / 分支 {B}% 达标（report 不存在则跳过） |
| 测试有效性 | ✅ 测试有效性：无空断言/废测试 |
| 验收条件 | ✅ AC-001~AC-004 全部通过 |
```

**整体结论**（按核心/次要 AC 分组判定，二选一 emit）：

- 全部 AC（P0+P1）通过 → emit：
  `✅ 所有验证通过`（**SIG-DONE**）

- 核心 AC（P0）全绿，但次要 AC（P1）有失败 → emit：
  `✅ 核心 AC 全部通过，次要 AC-{ids} 转 ⚠️ 留 checkpoint`（**SIG-DONE-CORE**）
  此时 goal 仍 achieved；失败的次要 AC 写入判断日志 ⚠️，交 /checkpoint 处理。

- 核心 AC 有任意失败 → 不 emit SIG-DONE/SIG-DONE-CORE（goal 未达成，继续下一 turn）。

> 评估器匹配：SIG-DONE 与 SIG-DONE-CORE 都算 goal achieved。
> 区别仅在于次要 AC 是否需要 checkpoint 介入。
> 测试一行**必须**显式 `Tests run: {N} (N ≥ 1)`——`Tests run: 0` 必须标 `❌ 测试不存在`。

## 前置条件

- 行为契约存在（且含「AC-测试映射」表）
- 代码文件已生成

## 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| --feature | Feature ID | 必须 |
| --skip-tests | 跳过测试运行 | false |
| --skip-analyze | 跳过架构合规检查 | false |
