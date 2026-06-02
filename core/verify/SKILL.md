---
name: verify
description: |
  验证动作集。在 /goal 循环内被 implement 每个 turn 调用。
  不再是独立的手动步骤，而是 AI 自主执行的验证动作：
  编译、测试、脚本检查。结果出现在会话中供 Haiku 评估器判断。

  触发场景：
  - /goal 循环内每个 turn 自动执行
  - 用户手动说"验证"、"检查"

  注意：验证结果必须输出到会话中（不只是文件中），
  因为 Haiku 评估器只能看会话内容来判断 goal 是否达成。
version: 2.0
author: HelmCode
tags: [verify, 验证, goal-loop, 验证动作]
---

# verify: 验证动作集（goal loop 内使用）

## 核心理念

verify 是一组验证动作，不是独立步骤。它在 `/goal` 循环内被反复调用：
- implement 生成代码后 → verify 检查 → 结果出现在会话中
- Haiku 评估器看会话内容 → 判断 goal 是否达成
- 验证失败 → 下一个 turn implement 自动修复 → 再次 verify

## 关键原则：结果必须在会话中可见

Haiku 评估器只能看会话内容。因此：
- 编译结果必须打印到会话（不只是 exit code）
- 测试结果必须打印到会话
- 脚本输出必须打印到会话
- 验收条件检查结果必须打印到会话

## 验证动作

### 1. 编译检查

```bash
# Java
mvn compile -pl {module} -q 2>&1 || echo "COMPILE FAILED"

# Node
npm run build 2>&1 || echo "COMPILE FAILED"
```

**会话输出要求**：
- 通过：输出 "✅ 编译通过：BUILD SUCCESS"
- 失败：输出 "❌ 编译失败" + 错误信息

### 2. 测试验证

```bash
# Java - 运行相关 domain 的测试
mvn test -pl {module} -Dtest={Domain}*Test 2>&1

# Node
npm test 2>&1
```

**会话输出要求(N ≥ 1 是硬约束)**：
- **通过**:输出 "✅ 测试通过:Tests run: {N}, Failures: 0"——**N 必须 ≥ 1**
- **失败 — 测试运行有错**:输出 "❌ 测试失败" + 失败的测试名和错误信息
- **失败 — 测试不存在**:`Tests run: 0` 即便 `Failures: 0`,**也视为失败**,
  输出 "❌ 测试不存在:本次 feature 未生成任何测试,Tests run: 0。
  下一 turn 必须先按 patterns/test.md 为新增 Facade 方法 / Domain Service / Handler
  生成对应测试用例(ACTS yaml 或 JUnit 单测),再重跑此检查"

**为什么硬约束 N ≥ 1**:
没有测试的"通过"是假阳性——`Tests run: 0, Failures: 0` 在文本匹配下会让 Haiku
评估器误判 goal achieved,代码上线时一旦回归就没人接得住。强约束 N ≥ 1 把
"测试生成"从可选项转为闭环硬步骤。

> **跨项目/类型例外**:纯文档/配置类 PR(不含 .java/.ts/.py 业务代码变更)可在
> goal 条件里显式排除测试验证(`--skip-tests`);其他场景 N ≥ 1 不可豁免。

### 3. 字段同步检查

```bash
node .claude/scripts/verify-field-sync.mjs \
  --contract .claude/contracts/{F-ID}.md --project . 2>&1
```

（脚本由 `helmcode install` 安装到 `.claude/scripts/`，如果不存在则跳过此检查）

**会话输出要求**：
- 通过：输出 "✅ 字段同步检查通过"
- 失败：输出 "❌ 字段同步失败" + 缺失字段详情

### 4. 架构合规检查

```bash
node .claude/scripts/verify-arch-rules.mjs --project . [--domain {domain}] 2>&1
```

（脚本由 `helmcode install` 安装到 `.claude/scripts/`，如果不存在则跳过此检查）

**会话输出要求**：
- 通过：输出 "✅ 架构合规检查通过"
- 失败：输出 "❌ 架构合规失败" + 违反的规则详情

### 5. 验收条件逐条检查

逐条检查行为契约中的验收条件：

```markdown
## 验收条件检查 - {F-ID}

- [x] AC-001: {描述} — ✅ 通过（{验证方式}：{具体结果}）
- [x] AC-002: {描述} — ✅ 通过（测试断言通过）
- [ ] AC-003: {描述} — ❌ 未通过（{原因}）
- [x] AC-004: {描述} — ✅ 通过（verify-field-sync 确认）
```

**这一步是 goal 达成的最终判定依据。**

## 验证输出汇总模板

每个 turn 结束时，输出以下汇总（供 Haiku 评估器判断）：

```markdown
## 验证结果 - {F-ID}

| 检查项 | 结果 |
|--------|------|
| 编译 | ✅ BUILD SUCCESS |
| 测试 | ✅ Tests run: 12 (N ≥ 1), Failures: 0 |
| 字段同步 | ✅ 全部通过 |
| 架构合规 | ✅ 全部通过 |
| 验收条件 | ✅ AC-001~AC-004 全部通过 |

整体结论：{F-ID} 所有验证通过 / {N} 项未通过，需要修复

> 测试一行**必须**显式写 `Tests run: {N} (N ≥ 1)` ——`Tests run: 0` 必须在整体
> 结论里标"❌ 测试不存在,本次 feature 未生成任何测试",Haiku 评估器据此判定
> goal 未达成,下一 turn 由 implement 补测试。
```

## 前置条件

- 行为契约存在
- 代码文件已生成

## 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| --feature | Feature ID | 必须 |
| --skip-tests | 跳过测试运行 | false |
| --skip-analyze | 跳过架构合规检查 | false |
