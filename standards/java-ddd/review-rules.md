# 审查规则

> 代码审查和 AI 生成验证规则。每条规则有明确的通过/失败标准。

## A. 架构分层

- [ ] 领域层不依赖基础设施层（import 检查：domain/ 目录下无 infrastructure/ 的 import）
- [ ] 领域层不使用 @Slf4j（禁止日志）
- [ ] Facade 实现使用 @RpcProvider 或 @SofaService 发布服务
- [ ] 依赖方向正确：bootstrap → facade → application → domain
- [ ] Repository 接口在 domain 层，实现在 infrastructure 层

## B. Lombok 使用

- [ ] Entity 使用 @Getter/@Setter，不使用 @Data
- [ ] Entity 不使用 @AllArgsConstructor、@NoArgsConstructor
- [ ] ValueObject/VO/DTO 可以使用 @Data
- [ ] 继承 BaseRequest 时加 @EqualsAndHashCode(callSuper = true)

## C. 注解

- [ ] Facade 方法有 @FacadeIntercept
- [ ] Domain Service 不使用 @Slf4j
- [ ] Application Service 使用 @Service
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

- [ ] @Transactional 只在 Application Service 层
- [ ] 写操作使用 rollbackFor = Exception.class
- [ ] 读操作使用 readOnly = true
- [ ] 事务内无外部调用

## G. 测试

- [ ] 每个 Facade 方法有 ACTS 集成测试
- [ ] ACTS 测试覆盖 4 种必测场景（case01 正常路径、case02 参数校验、case03 依赖失败、case04 业务错误）
- [ ] caseObjs.yaml 包含完整 7 个 section
- [ ] Domain / 工具类有 TestNG + Mockito 单元测试
- [ ] Mock 在 afterActsTest() 中清理

## H. 代码质量

- [ ] 方法不超过 20 行
- [ ] 类不超过 500 行
- [ ] 参数不超过 4 个（超过使用 Parameter Object）
- [ ] 嵌套不超过 3 层（超过使用 Guard Clause）
- [ ] 无魔法数字（使用命名常量）
- [ ] 无 System.out.println（使用日志）
- [ ] 无 printStackTrace（使用日志）
- [ ] 无尾随空格和 Tab 缩进