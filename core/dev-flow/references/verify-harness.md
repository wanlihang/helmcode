# verify-harness：success predicate 核验（goal loop 内使用）

> 本文件定义 verify 的第 0 步——**AC-coverage 核验**。
> 它是 `/goal` 的 **success predicate**（借鉴 Kani proof harness 的思想），
> 取代旧的「N≥1 当 headline 防线」。

## 为什么需要 harness（治 D1）

旧防线 `Tests run: N ≥ 1` 是 **coverage criterion（采样代理）**：
只要该 domain 下有任何一个预存测试通过，N≥1 就满足——
即便 implement 根本没给新方法写测试。它防的是「全项目零测试」的极端，
**防不住「新方法裸奔」**——而这才是真正要防的。

能抓住「新代码有没有测试」的是 **success predicate**：
核验行为契约的 **AC-测试映射表** 里，每条 AC 都 1:1 映射到一个**存在**的测试。
这是「对所有 AC 成立」的判定，不是「采样过 N 次」。

> 借鉴：Kani 的 `#[kani::proof]` harness——harness 内的 assertion 是
> 「对所有输入成立」，不是「采样过」。harness 是 proof witness。
> verify-harness 把「新代码每个公开方法都有测试」从 implement 的自查
> （被监督者自证）变成 harness 的客观判定（监督者核验）。

## 执行步骤

### Step 0：AC-coverage 核验（headline 防线，N≥1 之前）

读行为契约的「AC-测试映射」表，对每条「验证方式: 测试」的 AC：

```bash
# 伪流程（实际由 AI 在 goal loop 内执行）
对 映射表 的每一行 {AC, TestClass, method}:
  1. 在项目里查找 TestClass（如 {Domain}FacadeTest.java）
  2. 在该类里查找 method（如 case01 / testXxx）
  3. 任一不存在 → 记录缺失
```

**emit 规则**（串见 `signal-glossary.md`）：

- 全部映射 1:1 命中 → emit：
  `✅ AC-coverage：AC-{a}~AC-{b} 全部 1:1 映射到存在的测试`（**SIG-ACCOV**）

- 任意 AC 映射的测试缺失 → emit：
  `❌ AC-coverage：AC-{id} 映射的 {TestClass} 不存在`（**SIG-ACCOV-FAIL**）
  并提示：「下一 turn 须先按 AC-测试映射表为 AC-{id} 生成 {TestClass}，
  再重跑此检查」

### 与 N≥1 的关系

| | 旧 N≥1 | 新 SIG-ACCOV |
|--|--------|-------------|
| 性质 | coverage criterion（采样数） | success predicate（1:1 成立关系） |
| 防什么 | 全项目零测试 | 新方法裸奔 |
| 定位 | **降级为 sanity gate**（verify §2 内） | **headline 防线**（verify §0） |

N≥1 不删——它仍是合理的 sanity gate（连一个测试都没有肯定不对），
但它不再是 headline。Headline 换成 SIG-ACCOV。

## 前置条件

- 行为契约含「AC-测试映射」表（clarify 守卫：缺表不算 approved）
- 测试代码已生成（implement Phase 3 按映射表生成）

## 输出

结果**必须打印到会话**（Haiku 评估器只能看会话内容），
串的措辞严格按 `signal-glossary.md` 的 `SIG-ACCOV` / `SIG-ACCOV-FAIL`。
