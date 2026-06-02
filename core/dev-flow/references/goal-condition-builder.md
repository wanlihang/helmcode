# Goal 条件构建器

将行为契约的验收条件翻译为 `/goal` 可用的完成条件文本。

## 原则

1. `/goal` 评估器（Haiku）只能看会话内容，不能读文件、不能跑命令
2. 因此 goal 条件必须引用"会在会话中出现的东西"：编译输出、测试结果、脚本输出
3. goal 条件要一条写完，不超过 4000 字符

## 从验收条件推导 goal 条件

### Step 1: 分类验收条件

对行为契约中每条 AC-xxx，归入以下类别：

| 类别 | 验证方式 | 会话中出现的信号 |
|------|---------|----------------|
| 编译类 | `mvn compile` / `npm run build` | "BUILD SUCCESS" / exit code 0 |
| 测试类 | `mvn test` / `npm test` / `mvn acts:test` | "Tests run: N (**N ≥ 1**), Failures: 0" |
| 字段同步 | `node .claude/scripts/verify-field-sync.mjs` | 脚本输出全部 ✅ |
| 架构合规 | `node .claude/scripts/verify-arch-rules.mjs` | 脚本输出全部 ✅ |
| 功能验证 | 运行测试并检查断言 | 测试通过 + 特定断言输出 |
| 自定义命令 | 项目特有的验证命令(如 `mvn acts:test`、`curl` 健康检查) | 命令输出满足条件 |

> **测试类硬约束**:`Tests run: 0, Failures: 0` 视为失败(没测试的"通过"是假阳性)。
> goal 条件里必须显式写 `Tests run ≥ 1`,否则 Haiku 评估器会把"零测试"误判为达成。
> 详见 `core/verify/SKILL.md` §2。

### Step 2: 合并为 goal 条件模板

```
/goal 行为契约 {F-ID} 的所有验收条件满足:
- 编译零错误(mvn compile 输出 BUILD SUCCESS)
- 测试全绿且非空(mvn test 输出 Tests run: N ≥ 1, Failures: 0,覆盖 {domain} 相关测试)
- 架构合规(verify-arch-rules 输出全部 ✅)
- 字段同步(verify-field-sync 输出全部 ✅)
- AC-001~AC-00{N} 对应的测试断言全部通过
完成后输出验收条件逐条检查结果。
```

### Step 3: 简化条件

根据实际情况裁剪：

- **简单 CRUD**：编译 + 测试 + 字段同步 足够
- **标准业务流**：编译 + 测试 + 字段同步 + 架构合规
- **复杂业务**：编译 + 测试 + 字段同步 + 架构合规 + 特定 AC 的功能验证

不需要在 goal 条件中逐条列出 AC — "测试全绿"已经覆盖了大部分以测试断言为验证方式的 AC。
只需额外补充"非测试类"验证（编译、脚本、shell）。

## goal 条件示例

### 简单 Feature

```
/goal F001-recon-task 编译零错误,mvn test 输出 Tests run: N ≥ 1, Failures: 0,
verify-field-sync 全部 ✅,完成后展示验收条件检查结果
```

### 标准 Feature

```
/goal F002-daily-report 编译零错误,mvn test 输出 Tests run: N ≥ 1, Failures: 0,
verify-field-sync 全部 ✅,verify-arch-rules 全部 ✅,
完成后展示验收条件逐条检查结果
```

### 复杂 Feature(含集成验证)

```
/goal F003-payment 编译零错误,mvn test 输出 Tests run: N ≥ 1, Failures: 0,
verify-field-sync 全部 ✅,verify-arch-rules 全部 ✅,
支付创建和回调的集成测试通过,
完成后展示验收条件逐条检查结果
```

> 三个示例都显式写 `Tests run: N ≥ 1` — 这是关键反假阳性约束。
> 没有这一条,implement 跳过测试生成时 Haiku 会把 `Tests run: 0, Failures: 0`
> 误判为通过,goal achieved 但实际代码无任何测试覆盖。

## 注意事项

- goal 条件中不包含"判断日志 ⚠️ 项已确认" — 这是 goal achieved 后 /checkpoint 的事
- goal 条件中不包含主观判断（"代码质量好"）— 评估器无法判断
- 如果某个 AC 无法程序验证，在行为契约中标注并从 goal 条件中排除，留给 checkpoint 人工确认
- goal 条件要具体：用实际的命令和预期的输出格式，不要模糊描述
