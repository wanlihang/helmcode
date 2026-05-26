---
name: verify
description: |
  验证与判断审查。验证代码正确性，帮人聚焦审查 AI 的关键判断。
  替代传统的代码审查和测试审查，人审的是"AI 的判断对不对"。

  触发场景：
  - dev-flow Step 3 自动调用
  - 用户说"审查代码"、"验证"、"review"
  - 用户指向判断日志

  注意：此技能的核心是让人聚焦于关键判断，而不是审查整个 diff。
version: 1.1
author: HelmCode
tags: [verify, 验证, 判断审查, 代码审查]
---

# verify: 验证与判断审查

## 核心理念

人审查 400 行 diff 的效率很低。审查 5 个关键判断点的效率很高。
verify 做两件事：1) AI 自动验证正确性；2) 帮人聚焦于关键判断。

## 上下文加载

| 内容 | 路径 | 加载方式 | 估算大小 |
|------|------|---------|---------|
| 行为契约 | `.claude/contracts/{F-ID}-{short-name}.md` | 主会话 | 2-5KB |
| 判断日志 | `.claude/judgment-logs/{F-ID}-{short-name}.md` | 主会话 | 1-3KB |
| 测试标准 | `.claude/standards/test-standards.md` | 主会话 | 2KB |
| 审查规则 | `.claude/standards/review-rules.md` | analyze 子调用 | 5KB |

**禁止加载**：
- ❌ `patterns/`（验证阶段不生成代码）
- ❌ `standards.md`（已在 implement 阶段使用，验证只需 test-standards + review-rules）
- ❌ `.claude/briefs/`（项目简报不参与验证）

**合计**：~5-10KB

## 执行逻辑

### Phase 1: 自动验证

1. **编译检查**：
   - 运行项目编译命令
   - 确认零编译错误

2. **字段同步检查**（可执行脚本）：
   - 运行 `node .claude/scripts/verify-field-sync.mjs --contract .claude/contracts/{F-ID}.md --project .`
   - 脚本自动解析行为契约的 Schema 变更，检查新增字段在 Entity/DO/VO/Command/MapperXML/Convert 中的同步情况
   - 输出 ❌/✅ 结果，有 ❌ 则字段同步未通过

3. **架构规则检查**（可执行脚本）：
   - 运行 `node .claude/scripts/verify-arch-rules.mjs --project . [--domain {domain}]`
   - 脚本检查 5 条架构规则：
     - ARCH-001: Domain 层不依赖 Infrastructure
     - ARCH-002: Domain 层不使用 @Slf4j
     - ARCH-003: Entity 使用 @Getter/@Setter 不使用 @Data
     - ARCH-004: Facade 实现使用 @RpcProvider
     - ARCH-005: 不使用 RuntimeException
   - 输出 ❌/✅ 结果，有 ❌ 则架构合规未通过

4. **测试验证**：
   - 运行相关 domain 的测试
   - 确认测试通过
   - 检查覆盖率是否符合 test-standards 的目标

5. **行为契约验收**：
   - 逐条检查行为契约中的验收条件
   - 验证状态机转换是否实现
   - 验证业务规则是否编码
   - 验证 API 契约是否匹配

### Phase 2: 变更摘要

生成变更摘要，不是 400 行 diff，而是人可理解的摘要：

```markdown
## 变更摘要 - {F-ID}

### 新增文件
- {domain}/facade/{Xxx}Facade.java — Facade 接口定义
- {domain}/facade/{Xxx}FacadeImpl.java — Facade 实现
- {domain}/domain/model/{Xxx}Entity.java — 聚合根
- ...

### 修改文件
- {domain}/domain/model/{Xxx}Entity.java — 新增 confirm/reject 方法
- ...

### 核心实现
- 状态机：实现了 INIT → PROCESSING → WAIT_CONFIRM → COMPLETED/FAILED 全部转换
- 幂等：基于唯一索引 (bill_month + provider_id)
- 策略模式：多渠道数据处理使用策略工厂
```

### Phase 3: 判断日志审查

读取 `.claude/judgment-logs/{F-ID}-{short-name}.md`，向用户展示：

**已做判断**（供确认，非必须全部审查）：
- [JD-001] 使用策略模式处理多渠道数据源 ✓/✗
- [JD-002] 幂等基于唯一索引 ✓/✗
- [JD-003] gmt_create 命名遵循约定 ✓/✗

**需要确认**（必须审查）：
- [JD-004] ⚠️ PROCESSING→FAILED 超时误差 5-10 分钟是否可接受？
- [JD-005] ⚠️ confirm 是否需要 @SalLog 操作日志？

### Phase 4: 验收条件检查

逐条检查行为契约中的验收条件：

```markdown
## 验收条件 - {F-ID}

- [x] 创建任务返回 taskId — 通过
- [x] 状态机转换符合上述定义 — 通过
- [ ] 超时任务自动失败 — 未验证（需要集成测试环境）
- [x] 批量查询上限 100 条 — 通过
```

### Phase 5: 提交或回退

- 全部通过 + 判断确认 → 建议用户使用 git-commit 提交
- 有未通过项 → 标记问题，建议回到 implement 修复
- 有需要确认的判断未确认 → 等待用户确认后继续

## 前置条件

- 行为契约存在且状态为 `implementing`（检查 registry.md）
- 判断日志存在（`.claude/judgment-logs/{F-ID}-{short-name}.md`）
- 代码文件已生成

**若前置条件不满足**：
- 行为契约不存在 → 提示先执行 clarify
- 状态不为 implementing → 提示先执行 implement
- 判断日志不存在 → 提示先执行 implement
- 代码未生成 → 提示先执行 implement

## 后置条件

- 编译检查结果已记录
- 测试验证结果已记录
- 架构合规检查结果已记录（如未跳过）
- 验收条件逐条检查结果已记录
- 判断日志审查结果已记录
- 更新 `.claude/contracts/registry.md`：
  - 全部通过 + 判断确认 → 状态: done
  - 有未通过项 → 状态保持 implementing

## 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| --feature | Feature ID | 必须 |
| --skip-tests | 跳过测试运行 | false |
| --skip-analyze | 跳过架构合规检查 | false |
| --auto-commit | 验证通过后自动提交 | false（需确认） |

## 输出

- 验证报告（在会话中展示）
- 判断日志确认状态更新
- 行为契约状态更新（implementing → done 或保持 implementing）