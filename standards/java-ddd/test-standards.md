# Java Spring Boot DDD 测试标准

> 纯约束规则。测试代码模式与编码模式一致，参见 patterns/ 目录。

## 1. 覆盖率要求

| 层 | 行覆盖率 | 分支覆盖率 |
|---|---------|-----------|
| Facade | >= 85% | >= 75% |
| Service | >= 80% | >= 70% |
| Manager | >= 75% | >= 65% |
| Domain Logic | >= 90% | - |
| 总体 | >= 80% | >= 70% |

分支覆盖率补充：if/else >= 70%，switch/case >= 80%，try/catch >= 60%。

## 2. 6 种必测场景

| 优先级 | 场景 | 方法后缀 | 要求 |
|--------|------|---------|------|
| P0 | 正常路径 | _Success | 必须 |
| P1 | 边界值 | _EdgeCase_{Condition} | 必须 |
| P1 | 参数校验 | _InvalidParam_{Param}{Condition} | 必须 |
| P1 | 外部依赖失败 | _DependencyFail_{Service}{Error} | 必须 |
| P1 | 业务规则错误 | _BusinessError_{Condition} | 必须 |
| P2 | 降级 | _Degrade_SwitchOn | 可选 |

## 3. 命名规范

- 测试类：{TargetClass}Test（继承 AbstractTestBase）
- 测试方法：test{MethodName}_{Scenario}_{Condition}
- Mock 数据方法：mock{Type}(), mock{Type}Empty(), mock{Type}Exception()
- 测试数据类：{Entity}TestData
- 位置：src/test/java/com/xxx/unittest/{module}/
- 禁止：test1(), testDemo(), 缺少场景描述的方法名

## 4. Mock 规则

- 框架：JUnit 5 + Mockito 4.x
- 基类：AbstractTestBase
- 必须 Mock：外部 RPC/HTTP 调用、Repository 层（单元测试）、Redis、配置中心
- Mock 方式：MockitoUtil.in(target).mock("field", Client.class) 或 @Mock + @InjectMocks
- 必须清理：try-finally 中 MockitoUtil.unmock()
- Mock 数据：使用真实数据结构，避免 null 返回（除非测试 null 场景）
- 时间值：使用 new Date()、DateUtil.addDays()，禁止硬编码日期

## 5. 测试结构

- 必须使用 Given-When-Then（Arrange-Act-Assert）模式
- 每个测试方法必须有 Javadoc 说明场景和预期结果
- 每个测试方法只测一个场景
- 测试方法间必须独立，不依赖执行顺序

## 6. 边界值

| 类型 | 边界值 |
|------|--------|
| 数值 | 0, -1, MAX, MIN |
| 字符串 | 空串, 超长串 |
| 集合 | 空, 单元素, 大集合 |
| 金额 | 0.01（最小单位）, 99999999.99（最大） |
| 时间 | 00:00:00, 23:59:59 |

## 7. 测试类型选择

| 代码类型 | 测试类型 | 框架 |
|---------|---------|------|
| Entity/DomainService | 单元测试 | JUnit 5 + Mockito |
| Repository | 集成测试 | Spring Boot Test + H2 |
| Service | 集成测试 | Spring Boot Test |
| FacadeImpl | ACTS 测试 | ACTS + Mockito |

## 8. 降级测试

当开关关闭时：
- 外部服务不被调用：Mockito.verify(client, Mockito.never()).call(any())
- 返回降级错误码

## 9. 豁免规则

以下代码可申请覆盖率豁免（需技术负责人审批）：
- 配置类（仅开发环境使用）
- 第三方库封装
- 已进入维护模式的历史代码

豁免必须使用 @coverage 注解说明原因。

## 10. CI/CD 质量门禁

- mvn clean test jacoco:check 必须通过
- 覆盖率低于阈值构建失败
- 覆盖率报告：target/site/jacoco/index.html