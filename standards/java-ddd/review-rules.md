# 审查规则

> 代码审查和 AI 生成验证规则。每条规则有明确的通过/失败标准。

## A. 架构分层

- [ ] 领域层不依赖基础设施层（import 检查：domain/ 目录下无 infrastructure/ 的 import）
- [ ] 领域层不使用 @Slf4j（禁止日志）
- [ ] Facade 实现使用 @RpcProvider 或 @SofaService 发布服务
- [ ] 依赖方向正确：bootstrap → facade → application → domain
- [ ] Repository 接口在 domain 层，实现在 infrastructure 层

## A0. 包内聚（按业务功能点 `{context}` 分包，硬约束，直接打回）

> 详见 standards.md §0。一条业务需求,通过包路径 10 秒内定位到所有相关代码。
>
> **机器执行**:本节 A0-1/A0-2/A0-3/A0-4 已由 `app/test/.../servicetest/architecture/ArchitectureRulesTest.java` 在
> `mvn test` 阶段强制(`acceptor_must_be_in_context_subpackage` / `handler_*` / `action_*` / `context_class_*`),
> strict execution 失败即挂,不挂 `isSkipIntegrationTest`。

- [ ] 同一功能点的 Facade + Acceptor + Handler + Action + Context **必须在同一 `{context}` 包下**
      （如 `application/mapping/{acceptor,handler,action,context}/`）
- [ ] 严禁水平分包：`application/handler/`、`application/action/`、`application/acceptor/` 各自独立顶层 → 直接打回
- [ ] `application/decider/`、`application/shared/handler/` 只放跨功能点共享代码；
      若某个 Action/Handler 仅一个 `{context}` 用，必须下沉到该 `{context}` 包
- [ ] `infrastructure/<context>/` 必须与 `domain.<context>` / `application.<context>` 命名一一对应
      （Repository/Mapper/DO/Convert 同一功能点收敛在 `infrastructure.<context>` 下）
- [ ] `facade/<context>/model/{command,query,vo}/` 与 `application/<context>/` 命名对齐
- [ ] 严禁发明项目专有元数据（如 `@HelmFlow`、`@StageStep` 等业务编排注解）；
      `doHandle()` 内"代码顺序即执行顺序"是唯一编排方式

## B. Lombok 使用

- [ ] Entity 使用 @Getter/@Setter，不使用 @Data
- [ ] Entity 不使用 @AllArgsConstructor、@NoArgsConstructor
- [ ] ValueObject/VO/DTO 可以使用 @Data
- [ ] 继承 BaseRequest 时加 @EqualsAndHashCode(callSuper = true)

## C. 注解

- [ ] Facade 方法有 @FacadeIntercept
- [ ] Domain Service 不使用 @Slf4j
- [ ] Acceptor / Handler / Action / Decider / Builder 使用 @Component(不用 @Service)
- [ ] Repository 使用 @Repository
- [ ] Facade 方法返回 Result<T>

## D. 异常处理

- [ ] 使用 MycmBizException 而非 RuntimeException
- [ ] Facade 方法有双重 catch（MycmBizException + Exception）
- [ ] 无空 catch 块
- [ ] 错误码格式正确：{MODULE}_{BUSINESS}_{ERROR_DESC}

## E. 命名

- [ ] 类名符合命名规范（见 standards.md §5）
- [ ] 包路径符合规范（见 standards.md §2）
- [ ] 方法名使用强动词开头
- [ ] 常量使用 UPPER_SNAKE_CASE

## F. 事务

- [ ] **业务代码不允许出现 `@Transactional` 注解**
- [ ] 事务边界由 `HandlerTemplate.run(action, ctx)` 内部 `TransactionTemplate.executeWithoutResult` 控制 —— 单 Action 单事务
- [ ] 跨 Action 失败不会自动回滚已写入的 Action,需在 Action 内做幂等检查或补偿
- [ ] 事务内禁止调用外部系统(RPC / MQ)
- [ ] 禁止嵌套事务

## G. 测试

- [ ] 每个 Facade 方法有 ACTS 集成测试
- [ ] ACTS 测试覆盖 4 种必测场景（case01 正常路径、case02 参数校验、case03 依赖失败、case04 业务错误）
- [ ] caseObjs.yaml 包含完整 7 个 section
- [ ] Domain / 工具类有 TestNG + Mockito 单元测试
- [ ] Mock 在 afterActsTest() 中清理
- [ ] 分支覆盖达标（JaCoCo BRANCH，见 test-standards §1；阈值 行≥80% 分支≥70%）
- [ ] 无空断言/恒真断言/吞异常（见 test-standards §8）

## H. 代码质量

- [ ] 方法不超过 20 行
- [ ] 类不超过 500 行
- [ ] 参数不超过 4 个（超过使用 Parameter Object）
- [ ] 嵌套不超过 3 层（超过使用 Guard Clause）
- [ ] 无魔法数字（使用命名常量）
- [ ] 无 System.out.println（使用日志）
- [ ] 无 printStackTrace（使用日志）
- [ ] 无尾随空格和 Tab 缩进
- [ ] 业务代码不内联全限定类名（如 `com.foo.Bar` 当类型/静态调用），必须 `import` 后用简名；
      全限定名仅允许：① 同文件 import 同名类需消歧（如 `java.util.Date` vs `java.sql.Date`）
      ② ACTS/序列化 yaml（`!!com.xxx.Class`，见 test-standards.md §3.3）

## I. 装配风险（启动期才暴露的问题，必须在 PR 阶段拦住）

> 这一节专治"`mvn compile` / `mvn package` 通过、`mvn test` 跑 BootContextSmokeTest 才炸 / IDE 启动才炸"的问题。
> 详见 `patterns/stub-and-bean-naming.md` 与 `core/init-java-ddd/templates/app/test/BootContextSmokeTest.java.tmpl`。
>
> **机器执行**:
> - I-1 由 `ArchitectureRulesTest#domain_service_interface_must_have_impl` 强制(自定义 ArchCondition 扫 domain..service interface)
> - I-3 由 `ArchitectureRulesTest#no_*_exception_in_business_code` 强制(IllegalState/Argument/Unsupported 三类)
> - I-5 BootContextSmokeTest 存在性由 `pom.xml.tmpl` strict execution 的 `<include>**/servicetest/smoke/*Test.java</include>` 隐式强制(缺则 strict 跑 0 个测试)
> - I-6 错误码字符串硬编码会被编译期发现(`Result.fail(String, ...)` 静态方法不存在)
> - I-2 / I-4 静态分析难表达,留给 PR 人工 review

- [ ] **I-1** 每个新增 / 修改的 Spring 管理 `interface`(`*Service` / `*Repository` 等),同一 commit
      内必须有对应的 `@Service` / `@Repository` 实现 —— 即使 stub 也要落,内容是
      `throw new MycmSysException(SYSTEM_INNER_ERROR, "{Class}#{method} 待对接")`
- [ ] **I-2** 跨 `{context}` 重名风险的 `@Component` / `@Service`(类名是常见动词、或同名出现在多个 context、
      或被多个 context 引用),必须显式命名 `@Component("{context}{ShortClassName}")`,
      且引用方必须 `@Resource(name = "{context}{ShortClassName}")` —— **禁止**依赖默认 bean 名 + 字段名匹配
- [ ] **I-3** **严禁**抛 `IllegalStateException` / `IllegalArgumentException` / `UnsupportedOperationException` /
      `RuntimeException` —— 必须走 `MycmBizException` / `MycmSysException` + `ErrorCodeEnum`
      (见 `core/init-java-ddd/references/error-codes.md`)
- [ ] **I-4** Stub / 待对接占位**只允许一种写法**:
      `throw new MycmSysException(ErrorCodeEnum.SYSTEM_INNER_ERROR, "{Class}#{method} 待对接")`,
      不允许返回 `null` / 抛 JDK 异常 / 接口干脆不写实现
- [ ] **I-5** `app/test` 必须存在 `BootContextSmokeTest`(`@SpringBootTest` + `contextLoads()`),
      并且**不挂 isSkipIntegrationTest**(冒烟测试每次都跑,不能跳过)
- [ ] **I-6** 错误码必须出自 `ErrorCodeEnum` 枚举值,**不允许**写 `Result.fail("STRING_CODE", ...)`
      (该静态方法不存在,编译过不了)或自定义不在 enum 里的 code 字符串

## J. 决策与分发反模式(强制 switch 网格,禁 Map 自注册)

> 这一节钉死"路由层黑盒"。任何让 dispatch 不可读、不可静态分析的写法都打回。
> 详见 `patterns/decider.md` 与 `standards.md §0.5`。
>
> **机器执行**:
> - J-1 / J-2 可由 ArchUnit 类名检查
> - J-3 / J-4 / J-5 静态分析难表达,留给 PR 人工 review

- [ ] **J-1** 严禁 `Map<String, ?>` + `@PostConstruct` 自注册式路由(strategy auto-register / handler factory 等);
      scene × feature 分发统一走 `patterns/decider.md` 的 switch 网格
- [ ] **J-2** 严禁出现命名 `BizAbility` / `RoutableHandler` / `HandlerLocator` / `*Factory.get(type)` 类(deliver 教训)
- [ ] **J-3** Decider 实现内必须用 `switch` 显式列出 (scene, feature) → Handler 的映射,**不允许** `Map.get(feature)` /
      `Map.get(scene + ":" + feature)` 等查表式 dispatch
- [ ] **J-4** Handler 上不允许出现 `supportScene()` / `supportFeature()` / `getType()` 等"自报家门"方法;
      Handler 不应该知道自己被分发的规则
- [ ] **J-5** Acceptor 不允许直接 `@Resource` 注入 Handler 调用;必须通过 `decider.decide(feature, ctx).execute(ctx)`
      (无 scene 维度的项目此条豁免,但仍鼓励走 Decider 留扩展空间)
- [ ] **J-6** Facade Command/Query 入参里不允许加 `scene` / `mode` / `type` 等"路由字段";
      scene 由 `SceneInferrer` 从 ctx 推断,Facade 不应承担路由决策