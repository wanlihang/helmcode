---
name: analyze
description: |
  架构合规分析。基于编码标准和审查规则检查代码质量。
  用于 verify 步骤的自动验证，也可独立使用。

  触发场景：
  - verify 步骤自动调用
  - 用户说"分析代码"、"检查合规"、"review"
  - dev-flow 实现后自动调用

  注意：此技能基于 standards/review-rules.md 中的规则进行检查，
  而非硬编码的检查逻辑，因此可适配不同技术栈。
version: 1.1
author: HelmCode
tags: [analyze, 架构合规, 代码审查, 质量检查]
---

# analyze: 架构合规分析

## 上下文加载

| 内容 | 路径 | 加载方式 | 估算大小 |
|------|------|---------|---------|
| 审查规则 | `.claude/standards/review-rules.md` | 主会话 | 5KB |
| 行为契约 | `.claude/contracts/{F-ID}-{short-name}.md` | --feature 时加载 | 2-5KB |

**合计**：~5-10KB

## 输入

| 输入项 | 来源 | 必须 | 说明 |
|--------|------|------|------|
| 变更文件列表 | --feature 或 git diff | 是 | 要分析的代码范围 |
| review-rules.md | `.claude/standards/review-rules.md` | 是 | 检查规则定义 |
| 行为契约 | `.claude/contracts/{F-ID}-{short-name}.md` | --feature 时必须 | 用于行为契约合规检查 |

## 输出

分析报告格式遵循以下严格结构，verify 通过解析此结构判断通过/未通过：

```markdown
## 分析报告 - {F-ID}

### 错误（必须修复）
- ❌ [{类别}] {文件路径}:{行号} {问题描述}
  规则: {review-rules.md 中的具体条目}
  修复: {修复建议}

### 警告（建议修复）
- ⚠️ [{类别}] {文件路径}:{行号} {问题描述}
  规则: {review-rules.md 中的具体条目}
  建议: {修复建议}

### 通过
- ✅ {检查项描述}
```

**输出语义**：
- `❌` = error，必须修复才能通过 verify
- `⚠️` = warning，建议修复但不阻断 verify
- `✅` = passed，该检查项合规

## verify 调用约定

verify 通过以下方式调用 analyze：

1. **输入传递**：verify 将 Feature ID + 变更文件列表传递给 analyze
2. **结果解读**：
   - 有 ❌ error → verify Phase 1 "架构合规" 未通过
   - 仅有 ⚠️ warning → verify Phase 1 "架构合规" 通过，但警告需在判断日志中记录
   - 全部 ✅ → verify Phase 1 "架构合规" 通过
3. **warning 处理**：verify 将 analyze 的 warning 转为判断日志中的"已做判断"项

## 执行逻辑

### 1. 加载审查规则

读取 `.claude/standards/review-rules.md`，获取检查项列表。

### 2. 检查分类

**架构分层合规**：
- domain 层不依赖 infrastructure 层
- domain 层不使用 @Slf4j
- facade 实现使用 @RpcProvider 而非 @Service
- 依赖方向正确：bootstrap → facade → application → domain ← infrastructure

**编码规范合规**：
- Entity 使用 @Getter/@Setter，不使用 @Data
- DO 不继承基类，审计字段内联声明
- Request/Command 继承 BaseRequest
- VO 继承 BaseObject
- 异常使用 MycmBizException/MycmSysException，不使用 RuntimeException

**命名规范**：
- Facade 命名：{Business}Facade / {Business}ManageFacade
- Service 命名：{Business}Service
- Repository 命名：{Entity}Repository
- Command 命名：{Business}{Action}Command

**行为契约合规**：
- 状态机转换是否完整实现
- 业务规则是否编码
- API 契约是否匹配
- 验收条件是否覆盖

### 3. 输出报告

```markdown
## 分析报告 - {F-ID}

### 错误（必须修复）
- ❌ [架构] domain/model/ReconTask.java 使用了 @Slf4j
  规则: review-rules.md § 领域层不得使用日志
  修复: 移除 @Slf4j，将日志调用上移到 application 层

### 警告（建议修复）
- ⚠️ [命名] facade/ReconFacade.java 应使用 @RpcProvider
  规则: review-rules.md § Facade 注解
  建议: 将 @Service 替换为 @RpcProvider

### 通过
- ✅ 架构分层合规
- ✅ Entity Lombok 使用合规
- ✅ 异常处理合规
- ✅ 行为契约 BR-001 已实现
- ✅ 行为契约 BR-002 已实现
```

## 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| --feature | Feature ID（检查指定 Feature 的代码） | 全部变更 |
| --rules | 指定审查规则文件 | 从 CLAUDE.md 推断 |
| --scope | 检查范围: architecture/naming/contract/all | all |