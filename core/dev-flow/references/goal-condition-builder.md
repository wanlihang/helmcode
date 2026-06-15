# Goal 条件构建器

将行为契约的验收条件编译为 `/goal` 可用的完成条件文本。

## 机制变更（v2）

旧版（v1）是「LLM 按 Step 1-3 主观推导 goal」——分类、定档每步都是 LLM 判断，
非确定、不可复现。

新版（v2）改为**确定性编译器**：

```
行为契约（结构化 AC）→  compile-goal.mjs  →  /goal 文本
                         （确定性脚本）
```

LLM 仍负责「写契约」（创造性工作），但「契约 → goal」变成确定性函数，
可复现、可单测。本文件只描述契约需满足什么结构才能被编译器解析。

## 原则

1. `/goal` 评估器（Haiku）只能看会话内容，不能读文件、不能跑命令
2. 因此 goal 条件必须引用"会在会话中出现的东西"——所有信号串的措辞以
   `signal-glossary.md` 为**唯一事实源**，本文件不重写串的具体措辞
3. goal 条件一条写完，不超过 4000 字符
4. **用 `compile-goal.mjs` 生成，不要手写**——除非契约结构不满足解析前提（见下方排错）

## 怎么生成 goal

```bash
node scripts/compile-goal.mjs --contract .claude/contracts/{F-ID}-{name}.md
```

编译器自动完成：
1. 解析契约的 AC（验证方式 / 优先级）
2. **客观定档**（确定性闸门，替代 LLM 的简单/标准/复杂感觉）：
   - 含「命令」或「脚本」类 AC → `complex`
   - 否则「测试」类 AC > 3 → `standard`
   - 否则 → `simple`
3. 按档位 + 信号 glossary 填模板，输出 `/goal` 文本

## 契约需满足的解析前提

编译器要求 AC 是机器可解析的结构化格式（由 `clarify` 守卫产出）：

```
- [ ] AC-001: {描述} — 验证方式: 测试 — 优先级: P0
```

- **验证方式**：必须从 `编译 / 测试 / 脚本 / 命令` 四选一（不是自由文本）
- **优先级**：必须 `P0`（核心，必须达成）或 `P1`（次要，失败转 ⚠️ 不阻塞）
- **AC-测试映射**：所有「测试」类 AC 必须在契约「AC-测试映射」节登记对应测试类

## AC 验证方式分类（编译器据此定档）

| 类别 | 验证方式 | 会话中出现的信号（见 glossary） |
|------|---------|------------------------------|
| 编译类 | `编译` | SIG-COMPILE：BUILD SUCCESS |
| 测试类 | `测试` | SIG-TEST（N≥1 sanity gate）+ SIG-ACCOV（1:1 success predicate，headline） |
| 字段同步 | `脚本` | SIG-FIELDSYNC：字段同步：全部通过 |
| 架构合规 | `脚本` | SIG-ARCH：架构合规：全部通过 |
| 功能/集成 | `命令` | 对应命令的输出满足条件（编译器会把命令类 AC 显式列进 goal） |

> **headline 防线已从「N≥1」升级为「SIG-ACCOV（AC-coverage 1:1）」**。
> N≥1 降级为 sanity gate——它只防「全项目零测试」，防不住「新方法裸奔」。
> SIG-ACCOV 核验契约 AC-测试映射表里每条 AC 都 1:1 映射到存在的测试，
> 这才是 success predicate。详见 `verify-harness.md` 与 `signal-glossary.md`。

## 核心/次要 AC 分组（治复杂 feature 卡死）

编译器按 AC 优先级生成两组判定语：

- **全部 P0** → goal 写「核心 AC 全部达成」，全绿 emit SIG-DONE
- **有 P1** → goal 写「核心 AC 全绿即完成；次要 AC 失败转 ⚠️ 留 checkpoint」，
  核心 P0 全绿即 goal achieved（emit SIG-DONE-CORE），次要失败不阻塞

这样避免 1 条难啃的次要 AC 卡死整个 feature。

## goal 条件示例（compile-goal 产物，参考用）

### 简单 Feature（simple，纯测试类 AC ≤3）

```
/goal F001-recon-task 编译零错误（BUILD SUCCESS），
覆盖对账相关测试 全绿且非空（Tests run: {N} (N ≥ 1), Failures: 0），
AC-coverage 核验通过（AC-coverage 全部 1:1 映射），
核心 AC（AC-001~AC-003）全部达成。
完成后展示验收条件逐条检查结果。
```

### 标准 Feature（standard，测试类 AC >3）

```
/goal F002-daily-report 编译零错误（BUILD SUCCESS），
覆盖日报相关测试 全绿且非空（Tests run: {N} (N ≥ 1), Failures: 0），
AC-coverage 核验通过（AC-coverage 全部 1:1 映射），
架构合规（架构合规：全部通过）+ 字段同步（字段同步：全部通过），
核心 AC（AC-001~AC-004）全部达成。
完成后展示验收条件逐条检查结果。
```

### 复杂 Feature（complex，含命令/脚本类 AC + P1 次要）

```
/goal F003-payment 编译零错误（BUILD SUCCESS），
覆盖支付相关测试 全绿且非空（Tests run: {N} (N ≥ 1), Failures: 0），
AC-coverage 核验通过（AC-coverage 全部 1:1 映射），
架构合规（架构合规：全部通过）+ 字段同步（字段同步：全部通过），
AC-007（支付创建和回调集成）通过对应命令验证，
核心 AC（AC-001~AC-006）全部达成即视为完成；次要 AC（AC-007,AC-008）失败转 ⚠️ 留 checkpoint。
完成后展示验收条件逐条检查结果。
```

> 不要手抄上面的例子——跑 `compile-goal.mjs` 生成。这里只展示产物形态。

## 排错：compile-goal 报「契约结构不满足」

编译器会列出具体哪条 AC 不合规：

| 报错 | 修法 |
|------|------|
| `验证方式 "xxx" 不在枚举内` | 改 AC 验证方式为 编译/测试/脚本/命令 之一 |
| `优先级 "xxx" 不在 {P0,P1} 内` | 标 P0 或 P1 |
| `未解析到任何 AC` | AC 行格式不符，检查破折号 `—` 与字段顺序 |

## 注意事项

- goal 条件中**不包含**"判断日志 ⚠️ 项已确认"——这是 goal achieved 后 /checkpoint 的事
- goal 条件中**不包含**主观判断——评估器无法判断
- 如果某个 AC 无法程序验证，在契约中标 `人工确认` 并从验收条件移除，留给 checkpoint
- 信号串的措辞**永远不在本文件定义**——一律引 `signal-glossary.md` 的 `SIG-xxx`
