# Test Pattern

> When to use: Generate unit tests following the 6 mandatory scenarios. Each test method covers one scenario using Given-When-Then structure.

## Unit Test Template

```java
package {PACKAGE}.servicetest;

import com.mycm.common.model.base.Result;
import com.mycm.common.model.exception.MycmBizException;
import com.mycm.common.model.exception.ErrorCodeEnum;
import {PACKAGE}.AbstractTestBase;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;

public class {ClassName}Test extends AbstractTestBase {

    @Autowired
    private {ClassName} {className};

    // ==================== P0: 正常路径 ====================

    @Test
    public void test{MethodName}_Success() {
        // Given
        {RequestType} request = build{RequestType}();
        mockDependencies();

        try {
            // When
            {ResultType} result = {className}.{methodName}(request);

            // Then
            Assertions.assertTrue(result.isSuccess());
        } finally {
            MockitoUtil.unmock();
        }
    }

    // ==================== P1: 边界值 ====================

    @Test
    public void test{MethodName}_EdgeCase_{BoundaryCondition}() {
        // Given
        {RequestType} request = build{RequestType}();
        request.set{Field}({boundaryValue});

        try {
            // When
            {ResultType} result = {className}.{methodName}(request);

            // Then
            Assertions.assertNotNull(result);
        } finally {
            MockitoUtil.unmock();
        }
    }

    // ==================== P1: 参数校验 ====================

    @Test
    public void test{MethodName}_InvalidParam_{Param}Null() {
        // Given
        {RequestType} request = build{RequestType}();
        request.set{Param}(null);

        // When & Then
        Assertions.assertThrows(IllegalArgumentException.class, () -> {
            {className}.{methodName}(request);
        });
    }

    // ==================== P1: 外部依赖失败 ====================

    @Test
    public void test{MethodName}_DependencyFail_{ExternalService}Exception() {
        // Given
        {ExternalClient} client = MockitoUtil
            .in({className})
            .mock("{clientField}", {ExternalClient}.class);
        Mockito.when(client.{method}(Mockito.any()))
            .thenThrow(new RuntimeException("连接超时"));

        try {
            // When & Then
            Assertions.assertThrows(MycmBizException.class, () -> {
                {className}.{methodName}(build{RequestType}());
            });
        } finally {
            MockitoUtil.unmock();
        }
    }

    // ==================== P1: 业务规则错误 ====================

    @Test
    public void test{MethodName}_BusinessError_{Condition}() {
        // Given
        {RequestType} request = build{RequestType}();
        // 设置触发业务异常的条件

        try {
            // When & Then
            {className}.{methodName}(request);
            Assertions.fail("应该抛出业务异常");
        } catch (MycmBizException e) {
            Assertions.assertEquals(ErrorCodeEnum.BIZ_ERROR, e.getErrorCode());
        }
    }

    // ==================== P2: 降级 ====================

    @Test
    public void test{MethodName}_Degrade_SwitchOn() {
        // Given: Mock 配置返回降级开启

        try {
            // When
            {ResultType} result = {className}.{methodName}(build{RequestType}());

            // Then
            Assertions.assertNotNull(result);
        } finally {
            MockitoUtil.unmock();
        }
    }

    // ==================== 辅助方法 ====================

    private {RequestType} build{RequestType}() {
        {RequestType} request = new {RequestType}();
        // 设置默认值
        return request;
    }

    private void mockDependencies() {
        // Mock 外部依赖
    }
}
```

## Mock Data Templates

```java
// 简单对象
private Result<{DataType}> mock{DataType}() {
    Result<{DataType}> result = new Result<>();
    {DataType} data = new {DataType}();
    data.setId(1L);
    result.setData(data);
    return result;
}

// 列表
private Result<List<{ItemType}>> mock{ItemType}List() {
    Result<List<{ItemType}>> result = new Result<>();
    List<{ItemType}> list = new ArrayList<>();
    {ItemType} item = new {ItemType}();
    item.setId(1L);
    list.add(item);
    result.setData(list);
    return result;
}

// 空数据
private Result<{DataType}> mock{DataType}Empty() {
    Result<{DataType}> result = new Result<>();
    result.setData(null);
    return result;
}

// 异常
private void mock{Client}Exception({ServiceType} service) {
    {ClientType} client = MockitoUtil
        .in(service)
        .mock("{clientField}", {ClientType}.class);
    Mockito.when(client.{method}(Mockito.any()))
        .thenThrow(new RuntimeException("模拟异常"));
}

// 时间相关
private {DataType} mock{DataType}WithTime() {
    Date now = new Date();
    return {DataType}.builder()
        .validFrom(DateUtil.addDays(now, 0))
        .validTo(DateUtil.addDays(now, 30))
        .build();
}

// 金额相关
private {DataType} mock{DataType}WithAmount() {
    return {DataType}.builder()
        .amount(new BigDecimal("100.00"))
        .minAmount(new BigDecimal("0.01"))
        .maxAmount(new BigDecimal("99999999.99"))
        .build();
}
```
