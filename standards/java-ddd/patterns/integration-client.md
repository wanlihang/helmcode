# Integration Client Pattern

> When to use: Define an Integration Client when calling external RPC services. The pattern centralizes error handling, result validation, and audit logging for all outbound calls. Never inject the raw RPC facade directly — always go through the client abstraction.

## IntegrationConfig (Infrastructure Layer)

```java
package {PACKAGE}.infrastructure.integration;

import com.alipay.sofa.runtime.api.annotation.RpcConsumer;
import {PACKAGE}.facade.external.{ExternalService}Facade;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;

/**
 * Centralized RPC consumer configuration.
 * All @RpcConsumer references are declared here with explicit timeouts.
 */
@Configuration
public class IntegrationConfig {

    @RpcConsumer(timeout = 5000)
    {ExternalService}Facade {externalService}Facade;

    // Add more RPC consumers as needed
}
```

## FacadeClient Interface (Infrastructure Layer)

```java
package {PACKAGE}.infrastructure.integration.{MODULE};

import com.mycm.common.model.Result;
import {PACKAGE}.facade.external.model.{ExternalDTO};

/**
 * Client interface for calling external {ExternalService}.
 * Decouples application layer from direct RPC facade dependency.
 */
public interface {ExternalService}FacadeClient {

    /**
     * Query {external data} by id.
     */
    Result<{ExternalDTO}> queryById(Long id);

    /**
     * Batch query {external data}.
     */
    Result<List<{ExternalDTO}>> batchQuery(List<Long> ids);
}
```

## FacadeClientImpl (Infrastructure Layer)

```java
package {PACKAGE}.infrastructure.integration.{MODULE}.impl;

import com.mycm.common.model.Result;
import com.mycm.common.model.exception.MycmBizException;
import com.mycm.common.model.exception.ErrorCodeEnum;
import com.mycm.common.component.log.annotation.SalLog;
import com.mycm.common.model.constants.LoggerDef;
import {PACKAGE}.facade.external.{ExternalService}Facade;
import {PACKAGE}.facade.external.model.{ExternalDTO};
import {PACKAGE}.infrastructure.integration.{MODULE}.{ExternalService}FacadeClient;
import com.google.common.base.Preconditions;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * External {ExternalService} client implementation.
 * Wraps RPC calls with result validation and @SalLog audit.
 */
@Slf4j
@Service
public class {ExternalService}FacadeClientImpl implements {ExternalService}FacadeClient {

    @Autowired
    private {ExternalService}Facade {externalService}Facade;

    @Override
    @SalLog(loggerName = LoggerDef.SAL_DETAIL_LOGGER)
    public Result<{ExternalDTO}> queryById(Long id) {
        Result<{ExternalDTO}> result = {externalService}Facade.queryById(id);

        Preconditions.checkNotNull(result, "{ExternalService} returned null result");
        Preconditions.checkState(result.isSuccess(),
            "{ExternalService} call failed: %s", result.getResultMsg());

        return result;
    }

    @Override
    @SalLog(loggerName = LoggerDef.SAL_DETAIL_LOGGER)
    public Result<List<{ExternalDTO}>> batchQuery(List<Long> ids) {
        Result<List<{ExternalDTO}>> result = {externalService}Facade.batchQuery(ids);

        Preconditions.checkNotNull(result, "{ExternalService} returned null result");
        Preconditions.checkState(result.isSuccess(),
            "{ExternalService} batch call failed: %s", result.getResultMsg());

        return result;
    }
}
```

## Usage in Action

```java
package {PACKAGE}.application.{MODULE}.action;

import javax.annotation.Resource;
import org.springframework.stereotype.Component;
import com.mycm.common.model.Result;
import {PACKAGE}.application.shared.handler.Action;
import {PACKAGE}.application.{MODULE}.context.{Business}Context;
import {PACKAGE}.facade.external.model.{ExternalDTO};
import {PACKAGE}.infrastructure.integration.{MODULE}.{ExternalService}FacadeClient;

/**
 * Action 内通过 FacadeClient 调外部 RPC,不直接持有原始 Facade。
 * Client 已经包了 Preconditions + @SalLog,Action 内拿到的是已校验过的 Result。
 *
 * 注意:HandlerTemplate.run() 会把这个 Action 包进一个事务边界 —— RPC 调用进入事务
 * 是危险的(请求慢导致连接被占用),严禁。如果一定要调 RPC,Action 不能与 DB 写 Action
 * 放在同一个 Handler 里被 run 包事务;改用 check(action, ctx) 调,或单独的 Handler 路径。
 */
@Component
public class Fetch{External}DataAction implements Action<{Business}Context> {

    @Resource
    private {ExternalService}FacadeClient {externalService}FacadeClient;

    @Override
    public void process({Business}Context ctx) {
        Result<{ExternalDTO}> result = {externalService}FacadeClient.queryById(ctx.getExternalId());
        // Client 已校验:result 非空且 success
        ctx.set{External}Data(result.getData());
    }
}
```

> **注**:本项目不存在 ApplicationService 层,FacadeClient 由 Action 调用。
> Action 在 Handler.doHandle 里被 `run(action, ctx)` 或 `check(action, ctx)` 触发。
> **如果 Action 内有 RPC 调用,务必用 `check()` 不用 `run()`** —— RPC 不能进事务。

## Rules

- RPC consumer declarations only in IntegrationConfig
- Never use @RpcConsumer outside IntegrationConfig
- Every client method must have @SalLog for audit trail
- Use Preconditions to validate RPC result (null check + success check)
- **Application 层 Action 注入 FacadeClient,不直接注入原始 RPC Facade**
- **Action 内调 RPC 必须用 `check(action, ctx)` 触发,不用 `run()`** —— RPC 不能进事务
- Client 接口和实现位于 `infrastructure/integration/{module}/`

> **项目约定覆盖**:
> - 命名可能是 FacadeClient/FacadeClientImpl 或 Adapter/AdapterImpl，由 project-conventions.md 确定
> - Preconditions 可能使用 Guava (`com.google.common.base.Preconditions`) 或项目自定义工具类
> - 部分项目不使用 @SalLog，而是手写日志或无审计日志
