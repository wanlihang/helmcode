---
name: init-java-ddd
description: |
  Java DDD 应用冷启动生成器。把一个近乎空的 git 仓库（LEGAL.md + README.md）
  初始化为可直接 `mvn compile` 通过的 SOFABoot 4.7 / Java 21 / 7 模块 DDD 骨架
  (6 业务模块 + 1 集成测试模块),
  含 EmailBlacklist Demo 垂直切片 + 真实 zdal/mist 接入 + HelmCode 工作流。

  触发场景:
  - 用户说"初始化 java-ddd 应用"、"在这个空仓库起一个 SOFABoot DDD 骨架"
  - 当前目录是新建的 git 仓库,只有 LEGAL.md / README.md / .git/
  - 在已安装 HelmCode 的仓库中,通过对话调用本 skill(本 skill 由 Claude 主动加载执行,不通过 `helmcode` CLI 入口)

  核心价值:把 Linke SOFA 脚手架规范 + mycmbillmanage DDD 沉淀冻结成可复现配方,
  AI 在初始化后的工程上 coding 不需再做架构决策。
version: 1.0
author: HelmCode
tags: [init, java-ddd, sofaboot, scaffold, cold-start]
---

## Changelog

### v1.0 (2026-05-29)
- 首版发布。冷启动生成 SOFABoot 4.7 / Java 21 / 7 模块 DDD 骨架(6 业务 + 1 集成测试)
- Demo 切片 EmailBlacklist(5 facade 方法)统一走 `BizTemplate.doProcess` 惯用法
- 6 个 `@Configuration`(Zdal / Mybatis / Sequence / AntKms / CommonConfig / CMDConfiguration)全部真实接入,仅"应用绑定值"打 TODO
- `app/test` 模块对齐 mycmbillmanage:JUnit 5 (`AbstractTestBase`) + ACTS/TestNG (`{{AppName}}ActsTestBase`) 双支持,
  默认 `isSkipIntegrationTest=true` 不阻塞 CI
- 同步 HelmCode 工作流(clarify / dev-flow / implement / verify / analyze)到 `.claude/`

# init-java-ddd: Java DDD 应用冷启动生成器

## 核心理念

**冷启动,不是后处理。** 输入是接近空的 git 仓库,输出是开箱即编译的完整 SOFABoot DDD 骨架。

**Demo 是参考样板,可整体删除。** EmailBlacklist 切片让 AI 后续 coding 时有真实的层间调用范例可参考,
而不是面对空目录瞎猜。每个 Demo 文件头部都有 `// HelmCode Demo slice — safe to delete after onboarding` 标记。

**约定大于配置。** Application 入口的注解、5 套 profile 切分、Repository 倒置、MapStruct 转换、
`Result<T>` 返回、`ErrorCodeEnum` 错误码——全部固化为模板,不让用户/AI 重新决策。

**Missing-resource 显式失败,不靠 toggle 隐藏。** 凡是"外部资源未申请"导致的启动失败
(典型:DDS / mist 密钥 / buservice 密钥),技能**不会**生成 `@ConditionalOnProperty`、
`spring.autoconfigure.exclude` 之类的开关让代码静默跳过。理由:
  1. 即便加了开关,应用也跑不了真业务(切片整体被禁掉),只是把"启动报错"换成"运行报错";
  2. 开关一旦留下,90% 的用户会一直挂着 `=false` 不去申请资源,反而让骨架失去示范价值;
  3. 显式抛 `ZdalClientException` / `IllegalArgumentException` 比隐式 `NoSuchBeanDefinition` 更容易排查根因。

  正确做法 = `.helmcode-todo.md` 把申请清单列清楚 + Phase 10 终端打印同样的 checklist + 让启动期错误信息直接定位到缺哪个资源。
  详见反模式 #11。

---

## 启动前置依赖(冷启动后必须人工完成)

**冷启动只产出"代码骨架就绪"的状态,运行起来还需要 4 件外部资源**。
任何一件不到位,`mvn -pl app/bootstrap spring-boot:run` 都会在启动期硬挂——这是预期行为,不是 bug。
Phase 10 会把同样的清单同时写到 `.helmcode-todo.md` 与终端,确保用户看得到。

| # | 资源 | 申请入口 | 落地位置 | 不做会怎样 |
|---|---|---|---|---|
| 1 | **DDS 数据源**(必做) | 蚂蚁 DDS 控制台,申请 `{{appName}}_ds` | `app/infrastructure/.../config/ZdalConfiguration.java` 的 `.appDsName / .appName / .version("REPLACE_WITH_DDS_VERSION")` 三个字面量 | ZDAL `ConfKeeperFetcher` 远端拉取失败 + 本地 `${USER_HOME}/conf/zdal/{appName}_{version}_{dsName}/app.json` 也找不到 → `ZdalClientException` → `singleDataSource` bean 失败 → `sqlSessionFactoryBeanForSingle` 失败 → 整个 Spring context 启动失败 |
| 2 | **DBA 建表** | 找 DBA 在 DDS 库里建 `{{appName}}_sequence`(必)+ `email_blacklist`(demo 切片要用,删 demo 时一并清) | DDS 控制台关联的目标库 | sequence 取号失败 / demo facade 调 mapper 报 `Table doesn't exist` |
| 3 | **Mist 密钥**(用 AntKMS / buservice 时必做) | 蚂蚁 mist 平台申请租户与 secret | `app/bootstrap/.../config/application-{env}.properties` 的 `mist_tenant` / `antkms_tenant_id` / `secretcore_mist_email`,以及 `sofa.buservice.mistConfigKey` | `AntKmsBeanConfig` `@Value` 注入失败;`sofa.mist.enabled=false` / `sofa.buservice.enabled=false` 预置可暂时绕过,但 KMS / buservice 业务无法使用 |
| 4 | **跑 V001 SQL** | `mysql -h <dds-host> < sql/V001__init_email_blacklist.sql` | 同 #2 的库 | demo 集成测试(已默认注释)取消注释后跑不通 |

> ⚠️ **顺序建议**:`1 → 2 → 4 → 3`。1+2 完成后 `mvn -pl app/bootstrap -am compile` 就能编译通过;
> 跑得起来还需 3(若启用 KMS/buservice)。

> ⚠️ **不要尝试"加 `@ConditionalOnProperty` 让它能空跑"**:技能本来就拒绝这种 escape hatch(详见反模式 #11)。

---

## 上下文加载

| 内容 | 路径 | 加载方式 | 估算大小 |
|------|------|---------|---------|
| 本 SKILL.md | `core/init-java-ddd/SKILL.md` | 主会话 | 12KB |
| 模板根目录 | `core/init-java-ddd/templates/` | 按需 Read | 单个模板 1-4KB |
| CLAUDE.md 模板 | `core/init-java-ddd/claude-md/CLAUDE.md.tmpl` | Phase 8 加载 | 4KB |
| 反模式清单 | `core/init-java-ddd/references/antipatterns.md` | 仅写 CLAUDE 时引用 | 3KB |
| Demo 业务参考 | `core/init-java-ddd/templates/app/*/blacklist/` + `templates/app/test/{BlacklistDemoSandbox,acts/blacklist/}` | Phase 7 按需 | 23 文件(19 业务含 1 xml + 1 web Controller + 1 联调沙箱 + 1 ACTS 测试类 + 1 caseObjs.yaml) |

**路径约定**:
- `templates/` 开头 → 相对**本 skill 目录**(随 skill 一起安装,执行时按 `<HELMCODE_HOME>/core/init-java-ddd/templates/` 解析)
- 写入目标 → **当前工作目录**(用户执行命令的位置)

---

## 入参

| 参数 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `--app-name` | ✅ | — | 应用名(kebab/lowercase),例:`mycmdeliverhub`。若未传,先检查 cwd 名称是否符合 kebab-case,否则交互式追问 |
| `--base-package` | ✅ | — | 根包名,例:`com.mycm.deliverhub`。若未传,从 `--app-name` 推断为 `com.mycm.{appName去横线}` 并向用户确认 |
| `--group-id` | ❌ | 取 `--base-package` 的前两段,例:`com.mycm` | Maven groupId |
| `--java-version` | ❌ | `21` | 全部 6 模块统一 21,**不区分 facade**(沿用 billmanage 现状) |
| `--sofaboot-version` | ❌ | `4.7.0` | 父 pom 继承的 `sofaboot-alipay-dependencies` 版本 |
| `--with-demo` | ❌ | `true` | 是否生成 EmailBlacklist Demo 切片(含 `app/test/` 下手工沙箱 `BlacklistDemoSandbox.java` + STANDARD 主推的 `acts/blacklist/checkEmail/` ACTS 样例) |
| `--with-workflow` | ❌ | `true` | 是否同步注入 HelmCode `.claude/` + `CLAUDE.md` + `memory/` |
| `--with-web` | ❌ | `true` | 是否生成 `app/web` 模块;关掉则做纯 RPC 应用 |
| `--with-test` | ❌ | `true` | 是否生成 `app/test` 集成测试模块(JUnit 5 + ACTS/TestNG 双轨基类);关掉则不产出 test 模块 |
| `--force` | ❌ | `false` | 跳过 pre-flight 中的"工作区干净"检查 |

---

## 前置条件

1. 当前目录是 git 仓库(`git rev-parse --is-inside-work-tree` 成功)
2. 工作区干净(`git status --porcelain` 输出为空) —— `--force` 可跳过
3. **未初始化过**:根目录无 `pom.xml`、无 `app/` 目录、无 `.claude/init-java-ddd.lock`
4. 用户当前在工程根目录(`.git/` 与 cwd 同级)

任一不满足:打印明确错误 + 修复建议,然后退出,不做任何写入。

---

## 执行逻辑

### Phase 0: 参数解析与 pre-flight

1. 解析所有入参,推断默认值
2. 衍生变量:
   - `{{AppName}}` = `appName` 首字母大写(其余保留原样,处理含横线时拆词大驼峰,如 `mycm-deliver-hub` → `MycmDeliverHub`)
   - `{{APP_NAME}}` = `appName` 全大写、横线变下划线
   - `{{basePackagePath}}` = `basePackage.replace('.', '/')`
3. **appName 含横线时给出警告**:横线会污染 MySQL 表名(`{{appName}}_sequence`)和 Zdal `appDsName`,
   建议改为纯小写无横线(如 `mycmdeliverhub`)。仅警告不阻断,用户可继续。
4. 执行 pre-flight 4 项检查,不通过即退出
5. 向用户**一次性**展示即将生成的目录树和 TODO 项,等用户确认(`--force` 跳过)

### Phase 1: 根目录基础文件(3 个)

从 `templates/root/` 拷贝并替换占位符:

| 源 | 目标 |
|---|---|
| `templates/root/pom.xml.tmpl` | `pom.xml` |
| `templates/root/gitignore` | `.gitignore`(注意源文件名是 `gitignore` 无前导点,避免被 git 忽略) |
| `templates/root/helmcode-suggested-commit.txt.tmpl` | `.helmcode-suggested-commit.txt` |

### Phase 2: `conf/` 配置(4 个,Linke 平台必需)

| 源 | 目标 |
|---|---|
| `templates/conf/iac/meta-default.yml.tmpl` | `conf/iac/{{appName}}/meta/default.yml` |
| `templates/conf/iac/ci-default.yml.tmpl` | `conf/iac/{{appName}}/ci/default.yml` |
| `templates/conf/iac/database-default.yml` | `conf/iac/{{appName}}/database/default.yml` |
| `templates/conf/bin/hook.sh` | `conf/bin/hook.sh`(模式 0755) |

### Phase 3: 模块 pom.xml(6 业务 + 1 测试) + web 模块强制性资源(5 个,仅 `--with-web=true`)

| 源 | 目标 |
|---|---|
| `templates/app/bootstrap/pom.xml.tmpl` | `app/bootstrap/pom.xml` |
| `templates/app/web/pom.xml.tmpl` | `app/web/pom.xml`(仅 `--with-web=true`) |
| `templates/app/application/pom.xml.tmpl` | `app/application/pom.xml` |
| `templates/app/domain/pom.xml.tmpl` | `app/domain/pom.xml` |
| `templates/app/infrastructure/pom.xml.tmpl` | `app/infrastructure/pom.xml` |
| `templates/app/facade/pom.xml.tmpl` | `app/facade/pom.xml` |
| `templates/app/test/pom.xml.tmpl` | `app/test/pom.xml`(仅 `--with-test=true`) |

若 `--with-web=false`:从根 `pom.xml.tmpl` 里**移除** `<module>app/web</module>` 行,bootstrap 模块的 `web` 依赖也跳过。
若 `--with-test=false`:从根 `pom.xml.tmpl` 里**移除** `<module>app/test</module>` 行,跳过 Phase 5b。

**`--with-web=true` 时必须额外生成的 5 个 stub 资源**(否则启动报 `BeanDefinitionStoreException: FileNotFoundException [config/alipay-security-core-*.properties]`,详见反模式 #8):

| 源 | 目标 |
|---|---|
| `templates/app/web/resources/config/alipay-security-core-cors-config.properties` | `app/web/src/main/resources/config/alipay-security-core-cors-config.properties` |
| `templates/app/web/resources/config/alipay-security-core-redirect-config.properties` | `app/web/src/main/resources/config/alipay-security-core-redirect-config.properties` |
| `templates/app/web/resources/config/alipay-security-core-referer-config.properties` | `app/web/src/main/resources/config/alipay-security-core-referer-config.properties` |
| `templates/app/web/resources/config/alipay-security-core-fileupdate-config.properties` | `app/web/src/main/resources/config/alipay-security-core-fileupdate-config.properties` |
| `templates/app/web/resources/security/security-home.acl` | `app/web/src/main/resources/security/security-home.acl` |

> 这 5 个文件不含 `.tmpl` 后缀,内容也无 `{{...}}` 占位符,可直接复制(不走变量替换)。
> 默认值来自蚂蚁参考骨架 `mycmdeliverhub2`,`whiteHostList` 等业务字段后续按本应用真实域名调整即可。

### Phase 4: bootstrap 模块代码与配置(10 个)

| 源 | 目标 |
|---|---|
| `templates/app/bootstrap/Application.java.tmpl` | `app/bootstrap/src/main/java/{{basePackagePath}}/{{AppName}}Application.java` |
| `templates/app/bootstrap/application.properties.tmpl` | `app/bootstrap/src/main/resources/config/application.properties` |
| `templates/app/bootstrap/application-default.properties` | `app/bootstrap/src/main/resources/config/application-default.properties` |
| `templates/app/bootstrap/application-{env}.properties` ×5 | `app/bootstrap/src/main/resources/config/application-{env}.properties` |
| `templates/app/bootstrap/log4j2-spring.xml.tmpl` | `app/bootstrap/src/main/resources/log4j2-spring.xml` |
| `templates/app/bootstrap/example.xml` | `app/bootstrap/src/main/resources/spring/example.xml` |

env ∈ {dev, test, sim, prepub, prod}。Application + 1 主 properties + 1 default + 5 env-properties + log4j2 + example = 10 个文件。

### Phase 5: 5 业务模块的 DDD 包结构骨架(空目录 + `.gitkeep`)

为以下每个目录创建 `.gitkeep`(在 cwd 下,路径含 `{{basePackagePath}}`):

```
app/application/src/main/java/{{basePackagePath}}/application/{facade,service,scheduler,handler,convert}/.gitkeep
app/domain/src/main/java/{{basePackagePath}}/domain/{model,repository,service,enums,event,command,query,strategy,constant}/.gitkeep
app/infrastructure/src/main/java/{{basePackagePath}}/infrastructure/{repository,mybatis/mapper,mybatis/model,integration,convert,config,log}/.gitkeep
app/infrastructure/src/main/resources/mapper/.gitkeep
app/facade/src/main/java/{{basePackagePath}}/facade/{facade,vo,request,command,enums}/.gitkeep
```

若 `--with-web=true`:额外创建 `app/web/src/main/java/{{basePackagePath}}/web/.gitkeep`。

> Demo 切片(Phase 7)会向这些目录写文件,与 `.gitkeep` 共存,**不要删 `.gitkeep`**——用户删 Demo 后空目录还在。
> 注意:Demo 切片采用 **`<module>.blacklist.<x>`** 包结构(垂直切片),与 `.gitkeep` 创建的 **`<module>.<x>`** 水平骨架并存,
> 两种风格都可,用户后续 coding 时按团队偏好任选其一。

### Phase 5b: app/test 集成测试模块(`--with-test=true` 时,7 个基础文件)

对齐 mycmbillmanage 现状:JUnit 5 与 ACTS/TestNG 双轨支持。`AbstractTestBase` 走 JUnit 5,
`{{AppName}}ActsTestBase` 走 TestNG + ACTS yaml 用例。surefire 默认 `<skipTests>${isSkipIntegrationTest}</skipTests>`,
本地/CI 默认跳过(`isSkipIntegrationTest=true`),需要回归时本地 `mvn -pl app/test test -DisSkipIntegrationTest=false` 强制执行。

| 源 | 目标 |
|---|---|
| `templates/app/test/pom.xml.tmpl` | `app/test/pom.xml`(已在 Phase 3 列出) |
| `templates/app/test/SOFABootTestApplication.java.tmpl` | `app/test/src/main/java/{{basePackagePath}}/servicetest/base/SOFABootTestApplication.java` |
| `templates/app/test/AbstractTestBase.java.tmpl` | `app/test/src/main/java/{{basePackagePath}}/servicetest/base/AbstractTestBase.java` |
| `templates/app/test/ActsTestBase.java.tmpl` | `app/test/src/main/java/{{basePackagePath}}/servicetest/base/{{AppName}}ActsTestBase.java`(执行时按 `{{AppName}}` 重命名) |
| `templates/app/test/acts-config.properties` | `app/test/src/main/resources/config/acts-config.properties` |
| `templates/app/test/testng-all.xml` | `app/test/src/main/resources/actsSuite/{{appName}}-testng-all.xml`(执行时按 `{{appName}}` 重命名) |
| `templates/app/test/example.xml` | `app/test/src/main/resources/spring/example.xml` |

> **关键约定**:
> - `SOFABootTestApplication` 与运行时 `{{AppName}}Application` 完全独立,使用 `VelocityXmlBeanDefinitionReader` 加载 `classpath*:spring/*.xml`
> - 测试代码统一放在 `{{basePackage}}.servicetest.<biz>` 包下(JUnit 5 用例)与 `{{basePackage}}.acts.test.<biz>` 包下(ACTS yaml 用例)
> - `acts-config.properties` 的 `ds_singleDataSource = *_{{appName}},{{appName}}_*` 表名 pattern 影响 ACTS 反填 SQL,
>   appName 含横线时仍生效(由数据源 bean 名称统一)
> - `pom.xml.tmpl` 中默认两个 surefire execution:默认走 junit-platform 接口扫 `**/*Test.java`,
>   `-P test-testng` 切换 TestNG provider 跑 `actsSuite/{{appName}}-testng-all.xml`

### Phase 6: 基础设施真实接入(`@Configuration` × 6 + 共享工具 × 1,无条件生成,**不受 `--with-demo` 影响**)

| 源 | 目标 |
|---|---|
| `templates/app/infrastructure/config/ZdalConfiguration.java.tmpl` | `app/infrastructure/src/main/java/{{basePackagePath}}/infrastructure/config/ZdalConfiguration.java` |
| `templates/app/infrastructure/config/MybatisConfiguration.java.tmpl` | `app/infrastructure/src/main/java/{{basePackagePath}}/infrastructure/config/MybatisConfiguration.java` |
| `templates/app/infrastructure/config/SequenceConfiguration.java.tmpl` | `app/infrastructure/src/main/java/{{basePackagePath}}/infrastructure/config/SequenceConfiguration.java` |
| `templates/app/infrastructure/config/AntKmsBeanConfig.java.tmpl` | `app/infrastructure/src/main/java/{{basePackagePath}}/infrastructure/config/AntKmsBeanConfig.java` |
| `templates/app/infrastructure/config/CommonConfig.java.tmpl` | `app/infrastructure/src/main/java/{{basePackagePath}}/infrastructure/config/CommonConfig.java` |
| `templates/app/infrastructure/config/CMDConfiguration.java.tmpl` | `app/infrastructure/src/main/java/{{basePackagePath}}/infrastructure/config/CMDConfiguration.java` |
| `templates/app/infrastructure/log/MycmLoggerDef.java.tmpl` | `app/infrastructure/src/main/java/{{basePackagePath}}/infrastructure/log/MycmLoggerDef.java` |
| `templates/sql/V000__init_sequence.sql` | `sql/V000__init_sequence.sql`(infra 级,**不属于 demo**,删 demo 时保留) |

> **关键**:6 个 `@Configuration` 全部生效(非占位)。仅在"应用绑定值"打 TODO:
> - `ZdalConfiguration.singleDataSource` 的 `appDsName` / `appName` / `version`
> - `SequenceConfiguration.zdalSequence` 的 `tableName`
> - `AntKmsBeanConfig` 依赖的 properties(`mist_tenant` / `antkms_tenant_id` / `secretcore_mist_email`)
> - `CMDConfiguration` 注册 12 个 Bean 完成异步命令基础设施装配:
>   `asynCmdThreadPool` → `asynCmdRepository` → `cmdExecuteTemplate` → `asynCommandExecutor` → `asynCommandService`;
>   另含 `AsynCmdConfigDRMResource`(DRM 推送配置,appName 占位 `{{appName}}`)及
>   `AsynCmdLoader`/`AsynCmdExecutor`/`AsynCmdSplitHandler`/`AsynCmdLoadHandler`/`AsynCmdExecuteHandler` 调度链。
>   对齐 mycmbillmanage 的 `CMDConfiguration.java`(单库版);mycmbill 的分库分景版需用户自行扩展。
>
> `MycmLoggerDef` 继承 `com.mycm.common.model.constants.LoggerDef`,新增 `FACADE_SERVICE_LOGGER`
> 常量供 `@FacadeIntercept(loggerName = ...)` 使用。Demo 切片依赖此类,即便 `--with-demo=false`
> 也生成,因为后续业务代码大概率会用到。

### Phase 7: EmailBlacklist Demo 切片(`--with-demo=true` 时)

从 `templates/app/<module>/blacklist/` 拷贝 19 个业务文件
(facade 7 + application 2 + domain 5 + infrastructure 5,其中 infra 含 1 个 `*Mapper.xml`);
若 `--with-web=true`,再加 1 个 `BlacklistController.java`;
若 `--with-test=true`,再从 `templates/app/test/` 额外拷贝 3 个测试 Demo 文件
(1 个手工联调沙箱 + 1 个 ACTS 测试类 + 1 个 caseObjs.yaml)。
默认(`--with-web=true`+`--with-test=true`)共 23 个 Demo 文件,
仅核心 5 模块(无 web/test)时 19 个。**每个 Demo 文件头部必须保留**
`// HelmCode Demo slice — safe to delete after onboarding` 标记(yaml 用 `#` 前缀),便于一键清盘。

> **测试 Demo 双轨说明**(对齐 mycmbillmanage 现状 + STANDARD `patterns/test.md` 主推):
> - 手工联调沙箱 `BlacklistDemoSandbox.java`:对齐 `mycmbillmanage.PengPengDaWang` 风格——
>   类名**不**以 `Test.java` 结尾(不会被 surefire `**/*Test.java` 抓到),无 JUnit/TestNG 注解,
>   方法上挂 `//@Test` 占位,IDE 右键单跑;方法体只 `System.out.println(JSON.toJSONString(result))`,
>   纯联调脚手架。
> - ACTS 集成测试 `CheckEmailActsTest.java` + `case01_success/caseObjs.yaml`:STANDARD 主推方式,
>   类名 = `{MethodName}ActsTest`,继承 `{{AppName}}ActsTestBase`,数据用 7 段式 yaml 驱动。
>   严格遵循 STANDARD 路径约定 `src/test/java/{{basePackagePath}}/acts/test/{facade}/{method}/`。

切片业务:邮箱黑名单管理,5 个 facade 方法:
- `Result<Boolean> checkEmail(BlacklistCheckRequest)` — 读
- `Result<Void> addBlacklist(@Valid BlacklistAddCommand)` — 写,带幂等
- `Result<Void> removeBlacklist(@Valid BlacklistRemoveCommand)` — 软删
- `Result<Paginator<BlacklistVO>> listByPage(BlacklistQueryRequest)` — 分页查询
- `Result<Void> batchAddBlacklist(@Valid BlacklistBatchAddCommand)` — 批量写,用 `TransactionTemplate`

涉及文件目录(垂直切片,统一在 `.blacklist.` 包下):
```
app/facade/src/main/java/{{basePackagePath}}/facade/blacklist/BlacklistFacade.java
app/facade/src/main/java/{{basePackagePath}}/facade/blacklist/request/BlacklistCheckRequest.java
app/facade/src/main/java/{{basePackagePath}}/facade/blacklist/request/BlacklistQueryRequest.java
app/facade/src/main/java/{{basePackagePath}}/facade/blacklist/command/BlacklistAddCommand.java
app/facade/src/main/java/{{basePackagePath}}/facade/blacklist/command/BlacklistRemoveCommand.java
app/facade/src/main/java/{{basePackagePath}}/facade/blacklist/command/BlacklistBatchAddCommand.java
app/facade/src/main/java/{{basePackagePath}}/facade/blacklist/vo/BlacklistVO.java

app/application/src/main/java/{{basePackagePath}}/application/blacklist/BlacklistFacadeImpl.java
app/application/src/main/java/{{basePackagePath}}/application/blacklist/convert/BlacklistVoConvert.java

app/domain/src/main/java/{{basePackagePath}}/domain/blacklist/model/EmailBlacklist.java
app/domain/src/main/java/{{basePackagePath}}/domain/blacklist/query/EmailBlacklistQuery.java
app/domain/src/main/java/{{basePackagePath}}/domain/blacklist/repository/EmailBlacklistRepository.java
app/domain/src/main/java/{{basePackagePath}}/domain/blacklist/service/EmailBlacklistService.java
app/domain/src/main/java/{{basePackagePath}}/domain/blacklist/service/impl/EmailBlacklistServiceImpl.java

app/infrastructure/src/main/java/{{basePackagePath}}/infrastructure/blacklist/repository/EmailBlacklistRepositoryImpl.java
app/infrastructure/src/main/java/{{basePackagePath}}/infrastructure/blacklist/mybatis/model/EmailBlacklistDO.java
app/infrastructure/src/main/java/{{basePackagePath}}/infrastructure/blacklist/mybatis/mapper/EmailBlacklistDOMapper.java
app/infrastructure/src/main/resources/mapper/EmailBlacklistDOMapper.xml
app/infrastructure/src/main/java/{{basePackagePath}}/infrastructure/blacklist/convert/EmailBlacklistConvert.java

app/web/src/main/java/{{basePackagePath}}/web/blacklist/BlacklistController.java   ← 若 --with-web

app/test/src/main/java/{{basePackagePath}}/servicetest/base/BlacklistDemoSandbox.java                                          ← 若 --with-test
app/test/src/test/java/{{basePackagePath}}/acts/test/blacklist/checkEmail/CheckEmailActsTest.java                              ← 若 --with-test
app/test/src/test/java/{{basePackagePath}}/acts/test/blacklist/checkEmail/case01_success/caseObjs.yaml                          ← 若 --with-test

sql/V001__init_email_blacklist.sql
```

> 测试 Demo 文件源(共 3 个):
> - `templates/app/test/BlacklistDemoSandbox.java.tmpl` —— 手工联调沙箱,5 个 `//@Test` 占位方法
>   覆盖 5 个 facade 方法,需 dev DDS + email_blacklist 表就绪后取消注释。
> - `templates/app/test/acts/blacklist/checkEmail/CheckEmailActsTest.java.tmpl` —— STANDARD 主推
>   ACTS 集成测试样例,演示 `@TestBean` + `@AutoFill` + `@PrepareCase` 三件套。
> - `templates/app/test/acts/blacklist/checkEmail/case01_success/caseObjs.yaml.tmpl` —— 7 段式
>   ACTS 用例数据(Case Desc / Arguments / Flags / Result / Message Event / User-defined Params /
>   Virtual Mocks),覆盖"邮箱不在黑名单"成功路径。
>
> ⚠️ 严格遵循 STANDARD `patterns/test.md`:
> - ACTS 测试位于 `src/test/java/`(非 `src/main/java/`),走 `-P test-testng` 跑
> - 手工沙箱位于 `src/main/java/.../servicetest/base/` 下,**不**以 `Test.java` 结尾,
>   surefire 默认不会抓到执行(避免 CI 因 DDS 缺失而红)
> - 测试方法名遵循 `test{MethodName}_{Scenario}` 格式(如 `testCheckEmail_Success`),
>   **禁止** `test1` / `test2` 这种数字后缀

> 说明:Demo 不生成 `BlacklistAppService` —— FacadeImpl 直接编排 `EmailBlacklistService`(domain service),
> 这是 billmanage 当前现状。后续业务复杂到需要"应用服务"层时,用户自行新增 `application/<biz>/service/`。
> Convert 命名遵循 **`xxxVoConvert`**(小驼峰 `Vo`),与 billmanage 现状对齐,不要写成 `BlacklistVOConvert`。

### Phase 8: CLAUDE.md(工程级宪法)

从 `claude-md/CLAUDE.md.tmpl` 拷贝替换 → `CLAUDE.md`。

### Phase 9: 注入 HelmCode 工作流(`--with-workflow=true`)

复用 `loader/SKILL.md` 已有逻辑(若 HELMCODE_HOME 可解析则直接调用其 bash 段;否则按下表手工拷贝):

```
core/{clarify,dev-flow,implement,verify,analyze}/   → .claude/skills/{skill}/
core/*/references/                                  → 随各 skill 一起带过去(在 .claude/skills/{skill}/references/)
core/init-java-ddd/references/*.md                  → .claude/references/  (CLAUDE.md link 这里,工程级常驻知识)
commands/*                                          → .claude/commands/
standards/java-ddd/*.md                             → .claude/standards/
standards/java-ddd/patterns/*                       → .claude/standards/patterns/
```

> **关于 `templates/contract-template.md`**:loader v3.0 已把模板内嵌到 `core/clarify/references/contract-template.md`,
> 故 init-java-ddd **不再**单独写入 `.claude/templates/contract-template.md`(运行期 clarify skill 自带)。
> HelmCode 顶层的 `templates/` 目录是历史快照,会随 loader 治理一起清理。

并创建:
- `.claude/contracts/registry.md`(空注册表头)
- `.claude/briefs/` `.claude/judgment-logs/`(空目录 + `.gitkeep`)
- `memory/.gitkeep` + `MEMORY.md`(空索引)
- `.helmcode-version`:**必须**写入真实 HelmCode 版本。读取顺序 ——
  1. `<HELMCODE_HOME>/package.json` 的 `version` 字段(`HELMCODE_HOME` 由 install.sh 默认导出为 `~/.helmcode`,亦可 env 覆盖)
  2. 若上一步失败,退到 `node -p "require('<HELMCODE_HOME>/package.json').version"` 或 `grep -m1 '"version"' <HELMCODE_HOME>/package.json | sed -E 's/.*"version": *"([^"]+)".*/\1/'`
  3. 仍读不到 → **必须**在终端打 `WARNING: cannot resolve HELMCODE_HOME version, fallback to "unknown"` 红字告警(不要静默),再写入字面量 `unknown`

### Phase 10: 收尾

1. 写 `.claude/init-java-ddd.lock`,内容:
   ```yaml
   timestamp: <ISO8601>
   helmcodeVersion: <Phase 9 解析出的同一个值;读不到时也写 "unknown" 但必须同步在终端打告警>
   skillVersion: 1.0
   args:
     appName: ...
     basePackage: ...
     # 全部入参快照
   ```

   > **注意**:`helmcodeVersion` 与 `.helmcode-version` 来源同一处(Phase 9 已解析)。
   > 不要在 Phase 10 重新读 package.json —— 二者不一致就是 bug。

2. `git add -A` 但**不自动 commit**。

3. 终端打印 **TODO checklist**(同步写到 `.helmcode-todo.md` 供用户后续查阅):
   ```
   ✅ {{appName}} 骨架已生成

   ⚠️  以下 4 件事需要你手动完成才能跑通:

   [1] 申请 DDS 数据源,把 app/infrastructure/.../config/ZdalConfiguration.java 里:
         - appDsName("{{appName}}_ds")
         - appName("{{appName}}")
         - version("REPLACE_ME_DDS_VERSION")
       替换为 DDS 控制台分配的真实值

   [2] 让 DBA 在目标库建表(参考 sql/V001 末尾):
         - {{appName}}_sequence  (sequence 元数据表)
         - email_blacklist        (demo 切片表,后续删 demo 时一并删)

   [3] 申请 mist key,把 app/bootstrap/.../config/application.properties 里:
         - mist_tenant
         - antkms_tenant_id
         - secretcore_mist_email
       填上真实值

   [4] 跑 sql/V001__init_email_blacklist.sql 在测试库建 demo 表

   ✓ 验证编译:       mvn -pl app/bootstrap -am compile
   ✓ 验证集成测试:    mvn -pl app/test -am test -DisSkipIntegrationTest=false -P test-junit
                     (TODO[1][2][4] 完成后再跑;默认 isSkipIntegrationTest=true 跳过,
                     CI 不会因 DDS 缺失而红)
   ✓ 读约定:         cat CLAUDE.md
   ✓ 查命令:         ls .claude/commands/

   清 demo 时:
     grep -rl "HelmCode Demo slice" . | xargs rm -f
     rm sql/V001__init_email_blacklist.sql
   ```

---

## 变量替换规则

技能执行时,对每个 `.tmpl` 文件做以下字符串替换,然后写到目标位置(去掉 `.tmpl` 后缀):

| 占位符 | 计算方式 | 示例 |
|---|---|---|
| `{{appName}}` | `--app-name` | `mycmdeliverhub` |
| `{{AppName}}` | 大驼峰化(横线拆词,首字母大写) | `Mycmdeliverhub` 或 `MycmDeliverHub` |
| `{{APP_NAME}}` | 全大写,横线变下划线 | `MYCMDELIVERHUB` |
| `{{basePackage}}` | `--base-package` | `com.mycm.deliverhub` |
| `{{basePackagePath}}` | `basePackage.replace('.', '/')` | `com/mycm/deliverhub` |
| `{{groupId}}` | `--group-id` 或 `basePackage` 前两段 | `com.mycm` |
| `{{javaVersion}}` | `--java-version` | `21` |
| `{{sofaBootVersion}}` | `--sofaboot-version` | `4.7.0` |

**重要**:`{{AppName}}` 的大驼峰处理与 billmanage 现状对齐——
billmanage 的 `MycmBillManageApplication` / mycmdeliverhub 的 `MycmdeliverhubApplication`
都是单段不拆词。本技能默认采用**单段保留**策略:`mycmdeliverhub` → `Mycmdeliverhub`,
除非 appName 显式含横线(如 `mycm-deliver-hub`)才拆词,这与 Linke 当前行为一致。

非 `.tmpl` 文件(如 `hook.sh`、`gitignore`)中也可能含占位符,
**所有 templates/ 下的文件**都先做字符串替换再写出。

> 历史教训:`log4j2-spring.xml` 早期未带 `.tmpl` 后缀,某些执行器实现忽略了"全量替换"规则,
> 导致生成的 `log4j2-spring.xml` 残留字面量 `{{basePackage}}`,启动报
> `Unable to locate appender ... for logger config "{{basePackage}}"`。
> 当前版本已重命名为 `log4j2-spring.xml.tmpl`,让 `.tmpl` 后缀成为唯一可靠的替换信号。

---

## 后置条件

- ✅ 根目录有 `pom.xml`、`CLAUDE.md`、`.gitignore`、`.helmcode-todo.md`
- ✅ `app/{bootstrap,application,domain,infrastructure,facade}` 5 个核心模块齐(`web` 视 `--with-web`,`test` 视 `--with-test`)
- ✅ pom.xml 数量:5 核心 + (web ? 1 : 0) + (test ? 1 : 0) + 1 根 = 默认 8 个
- ✅ 6 个 `@Configuration`(Zdal/Mybatis/Sequence/AntKms/CommonConfig/CMDConfiguration)全部存在
- ✅ Application 入口含 `@ComponentScan({"{{basePackage}}", "com.mycm.common.command"})` + `@EnableAspectJAutoProxy` + 双 `@ImportResource`
- ✅ `--with-demo=true` 时:19 个 demo 业务文件存在(facade 7 + application 2 + domain 5 + infrastructure 5,含 `EmailBlacklistDOMapper.xml`);`--with-web=true` 再 +1(Controller);`--with-test=true` 再 +3(沙箱 + ACTS 测试类 + caseObjs.yaml)。每个文件头有 `HelmCode Demo slice` marker
- ✅ `--with-test=true` 时:`app/test/` 7 个基础文件齐,`SOFABootTestApplication` + `AbstractTestBase` + `{{AppName}}ActsTestBase` 编译通过
- ✅ `--with-workflow=true` 时:`.claude/skills/` `.claude/commands/` `.claude/standards/` 全部就位
- ✅ `.claude/init-java-ddd.lock` 写入完整入参快照

**编译验证**(非阻塞,失败也不回滚——告知用户):
```bash
mvn -pl app/bootstrap -am compile -DskipTests
```
此命令应通过(前提是 DDS/mist TODO 不影响编译期——6 个 `@Configuration` 的字段值都在运行期才生效)。

---

## 反模式硬约束(写入 CLAUDE.md,执行期也要遵守)

详见 `references/antipatterns.md`。生成的模板内容中**不允许**出现以下:

1. `spring.main.allow-bean-definition-overriding=true`
2. env 专属值出现在 `application-default.properties`
3. `BeanUtils.copyProperties` 调用(强制用 MapStruct)
4. `Result.fail("STRING_CODE", ...)` 硬编码字符串(强制走 `ErrorCodeEnum`)
5. 注释掉的代码常驻
6. 类头 `@author xxx` / `@version xxx` 标签
7. 在 `application.properties` 里混用 sofa 命名空间 + 业务 snake_case 不加分组注释
8. `web` 模块引入 `com.alipay.security:alipay-security-core` 却**不带** 4 个配套 stub `.properties`。
   该包内 `CorsFilterConfig` / `RedirectFilterConfig` / `RefererFilterConfig` / `FileUpdateFilterConfig`
   四个 `@PropertySource("classpath:config/alipay-security-core-*.properties")` 的 `@Configuration` 类,
   会在 bean factory 阶段逐个强加载 4 个配置文件,任一缺失即
   `BeanDefinitionStoreException: FileNotFoundException [config/alipay-security-core-*-config.properties]`。
   **正确做法**(与参考骨架 `mycmdeliverhub2` 一致):
   - `web/pom.xml` 把 `alipay-security-core` 作为**直接** dependency 显式声明(不靠传递,也不 exclude)
   - `web/src/main/resources/config/` 下同步落地 4 个 stub:
     `alipay-security-core-cors-config.properties` /
     `alipay-security-core-redirect-config.properties` /
     `alipay-security-core-referer-config.properties` /
     `alipay-security-core-fileupdate-config.properties`
   - 额外落 1 个 `web/src/main/resources/security/security-home.acl`(BUService ACL,同源参考骨架)
   - 历史踩坑:曾经尝试用 `<exclusion>` 把 `alipay-security-core` 从 `web-alipay-sofa-boot-starter`
     传递链上摘掉以绕开报错。能跑通,但丢失了 Ant 平台标配的 Web 安全过滤(CORS / Redirect / Referer /
     FileUpload),与平台规范背离。**禁止再走 exclusion 路径**——按 stub 模式补齐配置才是正解
9. `logging.path=/home/admin/logs` 硬编码无 fallback(本地 Mac/Linux dev 启动会刷一屏 mkdir 失败)。
   正确写法:`logging.path=${LOG_PATH:${java.io.tmpdir}/logs/{{appName}}}` —— 本地默认走
   `${java.io.tmpdir}` (Mac=`/var/folders/...`,Linux=`/tmp`,Windows=`%TEMP%`,任何 JVM 都可写),
   生产由发布平台注入 `LOG_PATH=/home/admin/logs` 覆盖。仅写 `${LOG_PATH:/home/admin/logs}` 还不够——
   IntelliJ Run Configuration 默认不导 `LOG_PATH`,仍会刷 mkdir 噪音
10. **`sofa.mist.*` 与业务 `mist_tenant` 不是同一组 key,模板必须双写,不要混淆**。
    - `sofa.mist.tenant` / `sofa.mist.appName` / `sofa.mist.enabled` 由 **SOFA 框架**
      (`com.alipay.sofa:mist-alipay-sofa-boot-starter` 内 `MistAutoConfiguration`)装配,
      是 Ant 平台通用 SDK 客户端参数,**与具体业务无关**。`ALIPAY` 是平台默认租户,
      任何新应用都可用,**不属于敏感值,模板必须硬编码** `sofa.mist.tenant=ALIPAY`,
      不能留 TODO——否则 `--with-web=true` 工程启动即崩(详见下条历史踩坑)。
    - `mist_tenant` / `antkms_tenant_id` / `secretcore_mist_email` 由本应用的
      `AntKmsBeanConfig` 通过 `@Value("${mist_tenant}")` 读取,**每个应用申请的真实租户**,
      属于敏感值,保持 TODO 让运维填,不能入仓。
    - 历史踩坑:`mycmbillmanage` 只有 `mist_tenant` 没有 `sofa.mist.tenant`,但它**没有 web 模块**,
      `MistAutoConfiguration` 从来不被触发,bean factory 的 `Assert.hasText(sofa.mist.tenant)`
      校验绕过去了。一旦带 web,`buservice → mistBuserviceInitConfigCustomizer → mistClientService →
      mistConfigService` 整条链路强制实例化 `MistSDKConfig`,缺 `sofa.mist.tenant` 直接
      `IllegalArgumentException: Config [sofa.mist.tenant] must has text, such like
      [sofa.mist.tenant=Alipay]` 把 Tomcat 启动炸掉。**`--with-web=true` 的工程,
      `sofa.mist.tenant=ALIPAY` 必须由模板写死,不能依赖用户后续补**。
    - 同理 `sofa.mist.enabled=false` / `sofa.buservice.enabled=false` 这一对**运行时开关**也要预置,
      新应用申请密钥之前 mist/buservice 整体处于关闭态,启动才能走通;申请到密钥后由用户改 true。
    - 排查同类问题的方法:看 SDK 内部用的是 `@Value("${xxx}")` 还是 `@ConfigurationProperties("yyy")`,
      把 SDK 实际读的 key 写到模板,**不要拿业务命名习惯反推 SDK 的 key**
11. **不要用 `@ConditionalOnProperty` / `spring.autoconfigure.exclude` 给"外部资源未申请"造 escape hatch**。
    - **触发场景**:DDS 没申请 → `ZdalClientException`;mist 密钥没申请 → `AntKmsBeanConfig` 注入失败;
      buservice 密钥没申请 → `buservice` 链路抛 `IllegalArgumentException`。
      第一反应不应该是"给 `@Configuration` / `@Service` / `@RpcProvider` 加一个 `@ConditionalOnProperty(name="app.xxx.enabled", havingValue="true")`,默认 `false`,先让它空跑过去"。
    - **为什么不行**:
      (1) 应用其实跑不了任何真业务——demo 切片整体被禁掉,新业务也写不下去,只是把"启动报错"换成"调接口报 `NoSuchBeanDefinitionException`",**没有任何 production 价值**;
      (2) 90% 的用户会一直挂着 `=false` 不去申请资源,反而让骨架彻底失去示范作用;
      (3) 报错信号被掩盖——以后真正出问题时排查路径反而更长。
    - **正确做法**:让启动期错误**显式抛出**,在 `.helmcode-todo.md` + Phase 10 终端打印 + 本文档"启动前置依赖"章节,
      把"申请 DDS → 填 version"、"申请 mist key → 填 tenant"这些 checklist 高亮告诉用户。
      `ZdalConfiguration.java` 里 `.version("REPLACE_WITH_DDS_VERSION")` **必须**留字面量,
      让 ZDAL 在 init 时硬抛错——这是设计,不是 bug。
    - **区分"平台默认值" vs "应用绑定值"**:
      - 平台默认值(如 `sofa.mist.tenant=ALIPAY`、`sofa.mist.enabled=false`、`sofa.buservice.enabled=false`)
        所有应用都一样,**应该硬编码进模板**;反模式 #10 已经讲过。
      - 应用绑定值(如 DDS `version`、`mist_tenant`、`antkms_tenant_id`)每个应用独占,
        **必须留 TODO 占位符**,不能塞默认值"先让它跑起来"。
    - **历史踩坑**:本技能在 2026-05-29 短暂走过一次错路——为了让 `mycmdeliverhub` 在用户没申请 DDS 时也能启动,
      在 6 个 `@Configuration` / `@Service` / `@RpcProvider` 上加了 `@ConditionalOnProperty(name="app.dds.enabled")`,
      默认 `=false`。用户立刻指出:"这算是过度修改吗?你就算改了,是不是也没法启动?" 完全正确——
      应用没了 DDS 什么都干不了,toggle 只是把启动期错误延后到运行期。立即回滚,改为本反模式约束所有未来 case。
    - **唯一例外**(允许 toggle 的场景):*同一份代码*在不同部署形态下行为不同(如灰度/AB 实验/feature flag),
      与"资源是否申请"无关。这种情况开关本身就是产品需求,不在本约束范围内。

---

## 调用方式

本 skill **不通过 `helmcode` CLI 入口暴露**——`helmcode` 只负责把 skill 安装到工程的 `.claude/skills/`,
冷启动初始化由 Claude(或本地 Agent)在对话中按需加载并执行,以便交互式确认入参与 TODO。

典型调用(在已安装 HelmCode 的空仓库中,与 Claude 对话):

```
你是 init-java-ddd 技能,请帮我初始化一个 SOFABoot DDD 应用,
appName=mycmdeliverhub, basePackage=com.mycm.deliverhub,
带 demo + workflow + web 模块。
```

技能在缺必填参数(`--app-name` / `--base-package`)时会主动追问,确认后再写盘。

---

## 错误恢复

任何 phase 失败:
- 不自动回滚(让用户看到已生成的部分,便于排查)
- 打印 `已完成: phase 1..N-1, 失败: phase N, 原因: ...`
- 提示用户:`git clean -fdx && git checkout .` 可还原到执行前

---

## 输出

- 完整 SOFABoot DDD 工程骨架(见后置条件)
- `.helmcode-todo.md` —— 用户后续手动 4 件事 checklist
- `.helmcode-suggested-commit.txt` —— 建议的首次 commit message
- `.claude/init-java-ddd.lock` —— 入参快照,防止重复执行
