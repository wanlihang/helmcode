# 包结构约定

`init-java-ddd` 生成的所有 Java 文件,必须落在下表指定的包路径中。审查 PR 时按本表对照。

## 1. 模块 -> 顶层包前缀

| 模块            | 顶层包前缀                                     | 允许的 Spring 注解                                |
|---------------|--------------------------------------------|-----------------------------------------------|
| `bootstrap`   | `{basePackage}`                            | `@SpringBootApplication` 仅此一个类                |
| `web`         | `{basePackage}.web`                        | `@RestController`、`@ControllerAdvice`         |
| `application` | `{basePackage}.application`                | `@RpcProvider`、`@Component`、`@Configuration`  |
| `domain`      | `{basePackage}.domain`                     | `@Service`(领域服务),禁止持久化/HTTP 注解              |
| `infrastructure` | `{basePackage}.infrastructure`          | `@Repository`、`@Configuration`、`@Mapper`     |
| `facade`      | `{basePackage}.facade`                     | 禁止任何 Spring/SOFA 注解,只放 POJO + 接口            |

## 2. 子包细则

### 2.1 facade

```
{basePackage}.facade.<context>.{Request,Command,Vo}
{basePackage}.facade.<context>.Xxx{Facade}.java   <- 接口
```

- Request / Command 区分:Query 类用 Request,写操作用 Command;
- Command/Request 必须 `extends BaseRequest`(或显式标注 `@Valid`);
- VO 必须实现 `Serializable` 并写 `serialVersionUID`。

### 2.2 application

```
{basePackage}.application.<context>.{Context}FacadeImpl.java   <- @RpcProvider
{basePackage}.application.<context>.convert.*VoConvert.java    <- MapStruct,domain → VO
{basePackage}.application.<context>.event.*Listener.java       <- 领域事件订阅
```

application 不直接调 Mapper,必须通过 domain.service。

### 2.3 domain

```
{basePackage}.domain.<context>.model.*           <- 聚合根/实体/值对象
{basePackage}.domain.<context>.query.*Query.java <- 查询封装
{basePackage}.domain.<context>.repository.*Repository.java  <- 接口,实现位于 infrastructure
{basePackage}.domain.<context>.service.*Service.java         <- 接口
{basePackage}.domain.<context>.service.impl.*ServiceImpl.java <- @Service
```

### 2.4 infrastructure

```
{basePackage}.infrastructure.config.*                              <- @Configuration
{basePackage}.infrastructure.mybatis.MybatisConfiguration.java
{basePackage}.infrastructure.mybatis.mapper.*DOMapper.java         <- @Mapper
{basePackage}.infrastructure.mybatis.model.*DO.java                <- MyBatis DO
{basePackage}.infrastructure.repository.*RepositoryImpl.java       <- @Repository,实现 domain 仓储
{basePackage}.infrastructure.convert.*Convert.java                 <- MapStruct,domain ↔ DO
{basePackage}.infrastructure.integration.*Client.java              <- 外部 RPC 客户端封装
{basePackage}.infrastructure.log.*LoggerDef.java                   <- logger 名常量
```

### 2.5 bootstrap

```
{basePackage}.{AppName}Application.java     <- 唯一启动类
```

只放启动类。任何业务/配置类放进 bootstrap = 红线。

## 3. 资源路径约定

| 路径                                        | 用途                                  |
|-------------------------------------------|-------------------------------------|
| `src/main/resources/spring/*.xml`         | SOFABoot Spring beans(可放空文件,但目录必须存在) |
| `src/main/resources/mapper/*.xml`         | MyBatis Mapper 映射                   |
| `src/main/resources/mapper/command/*.xml` | mycm-common 自带 command 模块 Mapper    |
| `src/main/resources/application*.properties` | 环境配置(snake_case for mist/antkms,dot for sofa.*) |
| `src/main/resources/log4j2-spring.xml`    | 日志配置(必须放在 bootstrap 模块)            |
