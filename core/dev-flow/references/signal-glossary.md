# Signal Glossary（评估器信号唯一事实源）

> `/goal` 的 Haiku 评估器只能看会话内容判定 goal 是否达成。
> 本文件是所有「评估器会查找的字符串」的**唯一事实源**：
> `verify` 按本文件 emit、`compile-goal.mjs` 按本文件生成 goal 查找串、
> `goal-condition-builder.md` 引用本文件、README 指向本文件。
> **任何信号串的措辞只能在本文件修改**——改完必须跑 `node scripts/verify-glossary.mjs`
> 对账，确认 verify 实际 emit 的串与本文件一致，否则评估器会静默失效。

## 为什么需要这个文件

历史上同一批信号字符串散落在 `verify/SKILL.md`（emit 侧）、
`goal-condition-builder.md`（查找侧）、`README.md`（文档侧）三处，
是**隐式契约**。谁改了 verify 的输出措辞，已写进契约或已粘贴的 goal
就静默失效——Haiku 找不到串 → goal 永远不达成，或找到近似串误判达成，
且极难排查。本文件把这个隐式契约变成显式、可机器对账的单一事实源。

## 信号定义表

每个信号有唯一 ID（`SIG-*`）、规范字符串、由谁 emit、何时 emit、Haiku 如何用它。
`{N}`/`{a}`/`{b}`/`{desc}` 是运行时填入的占位符，评估器按「规范字符串前缀 +
通配」匹配。

| 信号 ID | 规范字符串 | 由谁 emit | 何时 emit | 评估器用法 |
|---------|-----------|----------|----------|-----------|
| **SIG-COMPILE** | `✅ 编译通过：BUILD SUCCESS` | verify §1 | `mvn compile` exit 0 | 必须出现 |
| **SIG-TEST** | `✅ 测试通过：Tests run: {N} (N ≥ 1), Failures: 0` | verify §2 | 测试全绿且 N≥1 | 必须 N≥1（sanity gate） |
| **SIG-TEST-EMPTY** | `❌ 测试不存在：Tests run: 0` | verify §2 | N=0 | 出现即 goal 未达成 |
| **SIG-ACCOV** | `✅ AC-coverage：AC-{a}~AC-{b} 全部 1:1 映射到存在的测试` | verify-harness | AC-测试映射核验通过 | **success predicate**，headline 防线 |
| **SIG-ACCOV-FAIL** | `❌ AC-coverage：AC-{id} 映射的 {TestClass} 不存在` | verify-harness | 某条 AC 映射的测试缺失 | 出现即 goal 未达成 |
| **SIG-FIELDSYNC** | `✅ 字段同步：全部通过` | verify §3 | `verify-field-sync.mjs` 全绿 | 脚本存在时必须出现 |
| **SIG-ARCH** | `✅ 架构合规：全部通过` | verify §4 | `verify-arch-rules.mjs` 全绿 | 脚本存在时必须出现 |
| **SIG-ACLINE** | `✅ AC-{id}：{desc} — 通过` | verify §5 | 逐条 AC 核验通过 | 核心 AC 全部必须通过 |
| **SIG-ACLINE-FAIL** | `❌ AC-{id}：{desc} — 未通过` | verify §5 | 逐条 AC 未通过 | 核心 AC 出现即未达成；次要 AC 转 ⚠️ |
| **SIG-COVERAGE** | `✅ 覆盖率：行 {L}% / 分支 {B}% 达标` | verify §6 | `verify-coverage.mjs` 解析 jacoco.csv 达 §1 阈值 | sanity gate（report 存在时） |
| **SIG-COVERAGE-FAIL** | `❌ 覆盖率：行 {L}% / 分支 {B}% 未达阈值（行≥80% 分支≥70%）` | verify §6 | 覆盖率未达 §1 阈值 | 出现即未达标（report 存在时） |
| **SIG-TEST-EFF** | `✅ 测试有效性：无空断言/废测试` | verify §7 | `verify-test-effectiveness.mjs` 未检出反模式 | sanity gate |
| **SIG-TEST-EFF-FAIL** | `❌ 测试有效性：{file}:{line} {反模式}` | verify §7 | 检出空断言/恒真/空 catch | 出现即未达标 |
| **SIG-DONE** | `✅ 所有验证通过` | verify 汇总 | 全部信号绿 | goal achieved 的最终判定串 |
| **SIG-DONE-CORE** | `✅ 核心 AC 全部通过，次要 AC-{ids} 转 ⚠️ 留 checkpoint` | verify 汇总 | 核心全绿+次要未绿 | 核心/次要分组时 goal achieved 的判定串 |

## 信号分组

评估器判定 goal 是否达成，只看以下两组：

- **headline 防线（必须全绿）**：`SIG-ACCOV`（新代码测试 1:1，success predicate）、
  `SIG-COMPILE`、`SIG-TEST`（N≥1 sanity gate）。
  —— `SIG-ACCOV` 取代了旧的「N≥1 当 headline」。
  N≥1 降级为 sanity gate：它只防「全项目零测试」的极端，
  防不住「新方法裸奔」（旧方法的旧测试照样让 N≥1 满足）。
  能真正抓住「新方法有没有测试」的是 `SIG-ACCOV`——
  它核验契约 AC-测试映射表里每条 AC 都 1:1 映射到存在的测试。

- **逐条 AC（按优先级判定）**：`SIG-ACLINE`。
  - **P0 核心 AC**：全部必须 `SIG-ACLINE` 通过。
  - **P1 次要 AC**：失败转判断日志 ⚠️，不阻塞 goal。
  - 全部 P0 通过 + 任意 P1 失败 → emit `SIG-DONE-CORE`（goal achieved，次要留 checkpoint）。
  - 全部 AC 通过 → emit `SIG-DONE`。

- **质量 sanity gate（脚本/report 存在时必须绿，不存在则跳过不阻塞）**：
  `SIG-FIELDSYNC`、`SIG-ARCH`（已有）；**`SIG-COVERAGE`、`SIG-TEST-EFF`（新增）**。
  覆盖率（JaCoCo）+ 测试有效性（反模式）是 AC-coverage 之后的「广度 + 深度」防线——
  AC-coverage 管「测试存在」，覆盖率管「代码被跑到」，有效性管「断言有意义」。
  无 mvn/JaCoCo 环境（report 不存在）时 SIG-COVERAGE 跳过；测试文件不存在时 SIG-TEST-EFF 跳过。

## 历史 drift 记录（本文件修正的不一致）

下列 drift 在引入本文件后被统一，作为迁移说明保留：

| 信号 | 旧 emit 侧（verify/SKILL） | 旧查找/文档侧（builder/README） | 统一为 |
|------|--------------------------|-------------------------------|--------|
| 字段同步 | `✅ 字段同步检查通过` | README: `verify-field-sync all ✅` | `SIG-FIELDSYNC` |
| 架构合规 | `✅ 架构合规检查通过` | README: `verify-arch-rules all ✅` | `SIG-ARCH` |
| 测试 | `✅ 测试通过：Tests run: {N}, Failures: 0` | README: `Tests run: N (N ≥ 1), Failures: 0` | `SIG-TEST`（显式带 N≥1） |
| 整体结论 | `整体结论：...所有验证通过` | builder: `验收条件逐条检查结果` | `SIG-DONE` / `SIG-DONE-CORE` |

## 维护规则

1. **改措辞只在本文件改**，改完跑 `node scripts/verify-glossary.mjs` 对账。
2. 评估器匹配规则：前缀精确 + 占位符通配。新增信号时同时给出「通过」与「失败」成对串。
3. 任何 skill 文档引用信号时，写「见 signal-glossary.md 的 `SIG-XXX`」，
   不要在引用处重写串的具体措辞。
4. 本文件与 `compile-goal.mjs` 的 `SIGNALS` 常量、`verify-glossary.mjs` 的校验集
   **必须三者一致**——`verify-glossary.mjs` 负责保证。
