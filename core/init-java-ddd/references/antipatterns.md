# 反模式速查

`init-java-ddd` 在生成模板时已主动剔除以下 8 类反模式。审查 PR / 接入新代码时,请对照确认。

| #   | 反模式                                                         | 为什么不要                                                                | 正确做法                                                        |
|-----|-------------------------------------------------------------|----------------------------------------------------------------------|-------------------------------------------------------------|
| 1   | facade 里手写 `try/catch + new Result<>(false, ...)` | 失去 BizTemplate 对 `MycmBizException` 的 `errorCode/msg` 精确转换,日志被 `@FacadeIntercept` 重复打印 | 用 `bizTemplate.doProcess(req, () -> domainService.xxx())`,业务错抛 `MycmBizException(ErrorCodeEnum.X, msg)` |
| 2   | `BeanUtils.copyProperties(src, target)`                     | 反射,字段不匹配运行时才发现;无法 IDE 重构                                          | 使用 MapStruct(`@Mapper` + `INSTANCE`)                       |
| 3   | `spring.main.allow-bean-definition-overriding=true`         | 把"Bean 重名"问题藏起来,下次升级或新加 starter 直接炸                              | 排查 Bean 来源,改名 / 移除冲突注册                                   |
| 4   | `application-default.properties` 写真实环境敏感值(tnt_inst_id 等) | dev/test/sim/prod 全用同一个 fallback,生产泄漏数据库地址、KMS Tenant            | 把环境差异留给 application-<profile>.properties;敏感值走 KMS/SecretCore |
| 5   | 在 `application.properties` 中硬编码 `mist_tenant`、`antkms_tenant_id`、`secretcore_mist_*` | 凭证入仓 = 泄漏                                                          | 走 KMS 注入或运维平台环境变量,模板仅保留 `TODO:`                          |
| 6   | 每个 Java 类顶部一段 `@author wb-xxxx / @version Xxx.java, v 0.1 ...` | 99% 是模板留下来的,作者已离职;git blame 是更权威的 SoT                              | 不写 `@author` / `@version`                                  |
| 7   | Facade 内 `try { ... } catch (Exception e) { return ...; }` 把 MycmBizException 也吃掉 | 业务异常被吞,调用方拿到模糊的"SYSTEM_ERROR"无从排查;BizTemplate 已统一兜底,手写 catch 是绕开规范 | facade 不写 try/catch,统一走 `bizTemplate.doProcess(req, () -> ...)`,业务异常抛 `MycmBizException(ErrorCodeEnum.X, msg)` 透传 |
| 8   | Repository 实现里 `throw e;` 或直接 `throw new RuntimeException(e)` | 业务/系统异常类型丢失,Facade 层无法做差异化兜底                                     | 业务校验抛 `MycmBizException`,IO/SQL 异常抛 `MycmSysException` |

## 红线之外的"软性建议"

- **不要在 domain.service.impl 里 import infrastructure.* / facade.\***。domain 只依赖自身 model/repository 接口。
- **不要在 web/application 里直接调 Mapper**。一定要走 `domain.service` -> `domain.repository` 这条链。
- **Mapper.xml 中禁止 `SELECT *`**,必须用 `<sql id="Base_Column_List">` + `<include refid=.../>`,新加字段时一处修改。
- **Mapper 中 `selectByPage` 类查询必须显式 `ORDER BY`**,否则分页结果跨页可能重复 / 漏数据。
- **`@DalLog` 必须放在 Mapper 接口方法上,不是 Repository 实现方法上**。aspect 织入位置不同,放错就不打日志。
- **MapperScan 包路径必须与实际 mapper 包路径一致**。`com.mycm.common.command.mapper` 是公共组件包,不要删。

## 强制执行机制

1. CI 中接入 `scripts/verify-arch-rules.mjs`,对反模式 #1、#2、#3、#6 做静态扫描。
2. PR 模板的"Self-check"区块罗列 8 条,要求 reviewer 与 author 各打钩。
3. CLAUDE.md §2 把 #1~#10 列为红线,违反 = block-merge。
