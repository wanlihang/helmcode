# Facade Pattern

> When to use: Define a Facade at the module boundary to expose business capabilities to external consumers (RPC clients, other modules). Every external call enters through a Facade that wraps results in `Result<T>` and applies interceptors.
>
> **跨项目数据**: 6/7 项目使用 BizTemplate 模式，1/7 使用手动 try-catch。
> 以下展示 BizTemplate 作为默认模式。项目约定可覆盖为手动模式。

## Facade Interface

```java
package {PACKAGE}.facade.{MODULE};

import {PACKAGE}.facade.{MODULE}.model.command.{Business}CreateCommand;
import {PACKAGE}.facade.{MODULE}.model.command.{Business}UpdateCommand;
import {PACKAGE}.facade.{MODULE}.model.query.{Business}Query;
import {PACKAGE}.facade.{MODULE}.model.vo.{Business}VO;
import {PACKAGE}.common.model.Result;
import {PACKAGE}.common.model.Paginator;

public interface {Business}ManageFacade {

    Result<{Business}VO> create{Business}({Business}CreateCommand command);

    Result<{Business}VO> update{Business}({Business}UpdateCommand command);

    Result<Void> cancel{Business}(Long id);
}
```

```java
package {PACKAGE}.facade.{MODULE};

import {PACKAGE}.facade.{MODULE}.model.query.{Business}Query;
import {PACKAGE}.facade.{MODULE}.model.vo.{Business}VO;
import {PACKAGE}.common.model.Result;
import {PACKAGE}.common.model.Paginator;

public interface {Business}QueryFacade {

    Result<{Business}VO> query{Business}(Long id);

    Result<Paginator<{Business}VO>> list{Business}({Business}Query query);
}
```

## FacadeImpl — BizTemplate 模式（默认）

```java
package {PACKAGE}.application.{MODULE}.facade;

import com.alipay.sofa.rpc.api.annotation.RpcProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import {PACKAGE}.facade.{MODULE}.{Business}ManageFacade;
import {PACKAGE}.facade.{MODULE}.model.command.{Business}CreateCommand;
import {PACKAGE}.facade.{MODULE}.model.command.{Business}UpdateCommand;
import {PACKAGE}.facade.{MODULE}.model.vo.{Business}VO;
import {PACKAGE}.application.{MODULE}.service.{Business}ManageService;
import {PACKAGE}.common.model.Result;
import {PACKAGE}.common.component.log.annotation.FacadeIntercept;
import {PACKAGE}.common.model.constants.LoggerDef;
import {PACKAGE}.common.component.template.BizTemplate;
import {PACKAGE}.common.component.template.BizCallback;

/**
 * {Business} manage facade implementation.
 * Uses @RpcProvider for SOFARPC exposure + BizTemplate for Result wrapping.
 */
@Slf4j
@RpcProvider
public class {Business}ManageFacadeImpl implements {Business}ManageFacade {

    @Autowired
    private {Business}ManageService {business}ManageService;

    @Autowired
    private BizTemplate bizTemplate;

    @Override
    @FacadeIntercept(loggerName = LoggerDef.BIZ_SERVICE_LOGGER)
    public Result<{Business}VO> create{Business}({Business}CreateCommand command) {
        return bizTemplate.doProcess(request, new BizCallback<{Business}VO>() {
            @Override
            public void validate() {
                Assert.notNull(command.get{Business}No(), "{business}No is required");
            }

            @Override
            public {Business}VO execute() {
                return {business}ManageService.create{Business}(command);
            }
        });
    }

    @Override
    @FacadeIntercept(loggerName = LoggerDef.BIZ_SERVICE_LOGGER)
    public Result<{Business}VO> update{Business}({Business}UpdateCommand command) {
        return bizTemplate.doProcess(request, () -> {
            return {business}ManageService.update{Business}(command);
        });
    }

    @Override
    @FacadeIntercept(loggerName = LoggerDef.BIZ_SERVICE_LOGGER)
    public Result<Void> cancel{Business}(Long id) {
        return bizTemplate.doProcess(request, () -> {
            {business}ManageService.cancel{Business}(id);
            return null;
        });
    }
}
```

> **项目约定覆盖**: RPC 发布注解可能是 @RpcProvider 或 @SofaService，由 project-conventions.md 确定。
> Logger 常量名可能是 LoggerDef.BIZ_SERVICE_LOGGER 或 MycmLoggerDef.FACADE_SERVICE_LOGGER。

## Command Class

```java
package {PACKAGE}.facade.{MODULE}.model.command;

import lombok.Data;
import lombok.EqualsAndHashCode;
import {PACKAGE}.common.model.BaseRequest;
import java.io.Serializable;

@Data
@EqualsAndHashCode(callSuper = true)
public class {Business}CreateCommand extends BaseRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    private String {business}No;
    private String type;
    private Long amount;
    private String currency;
    private String remark;
}
```

```java
package {PACKAGE}.facade.{MODULE}.model.command;

import lombok.Data;
import lombok.EqualsAndHashCode;
import {PACKAGE}.common.model.BaseRequest;
import java.io.Serializable;

@Data
@EqualsAndHashCode(callSuper = true)
public class {Business}UpdateCommand extends BaseRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    private Long id;
    private String remark;
}
```

## Query Class

```java
package {PACKAGE}.facade.{MODULE}.model.query;

import lombok.Data;
import lombok.EqualsAndHashCode;
import {PACKAGE}.common.model.BaseRequest;
import java.io.Serializable;

@Data
@EqualsAndHashCode(callSuper = true)
public class {Business}Query extends BaseRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    private String {business}No;
    private String status;
    private String type;
    private Integer pageNum;
    private Integer pageSize;
}
```

## VO Class

```java
package {PACKAGE}.facade.{MODULE}.model.vo;

import lombok.Data;
import java.io.Serializable;

@Data
public class {Business}VO implements Serializable {

    private static final long serialVersionUID = 1L;

    private Long id;
    private String {business}No;
    private String type;
    private String status;
    private String statusDescription;
    private Long amount;
    private String currency;
    private String remark;
    private String gmtCreate;
    private String gmtModified;
}
```
