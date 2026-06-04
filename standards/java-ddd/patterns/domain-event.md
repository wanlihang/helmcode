# Domain Event Pattern

> When to use: Define a Domain Event when a state change in one aggregate needs to trigger actions in other aggregates or external systems. Events decouple producers from consumers, enabling cross-aggregate consistency without direct coupling.

## Domain Event Interface (Domain Layer)

```java
package {PACKAGE}.domain.event;

import java.util.Date;

/**
 * Base interface for all domain events.
 * Defined in the domain layer, implemented by specific events.
 */
public interface DomainEvent {

    /**
     * When this event occurred.
     */
    Date getOccurredOn();
}
```

## Domain Event Publisher Interface (Domain Layer)

```java
package {PACKAGE}.domain.event;

/**
 * Domain event publisher interface — defined in domain layer.
 * Implementation lives in infrastructure layer (dependency inversion).
 */
public interface DomainEventPublisher {

    /**
     * Publish a domain event to all registered listeners.
     */
    void publish(DomainEvent event);
}
```

## Concrete Domain Event

```java
package {PACKAGE}.domain.{MODULE}.model.event;

import {PACKAGE}.domain.event.DomainEvent;
import lombok.Getter;
import java.util.Date;

/**
 * Event fired when a {Business} status changes.
 */
@Getter
public class {Business}StatusChangedEvent implements DomainEvent {

    private final Long {business}Id;
    private final String fromStatus;
    private final String toStatus;
    private final Date occurredOn;

    public {Business}StatusChangedEvent(Long {business}Id, String fromStatus, String toStatus) {
        this.{business}Id = {business}Id;
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.occurredOn = new Date();
    }

    @Override
    public Date getOccurredOn() {
        return this.occurredOn;
    }
}
```

## Spring Domain Event Publisher (Infrastructure Layer)

```java
package {PACKAGE}.infrastructure.event;

import {PACKAGE}.domain.event.DomainEvent;
import {PACKAGE}.domain.event.DomainEventPublisher;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/**
 * Domain event publisher implementation using Spring's event mechanism.
 */
@Slf4j
@Component
public class SpringDomainEventPublisher implements DomainEventPublisher {

    @Autowired
    private ApplicationEventPublisher applicationEventPublisher;

    @Override
    public void publish(DomainEvent event) {
        log.info("BIZ-SERVICE-LOGGER|DomainEventPublished|type={}|occurredOn={}",
            event.getClass().getSimpleName(), event.getOccurredOn());
        applicationEventPublisher.publishEvent(event);
    }
}
```

## Event Listener (Application Layer)

```java
package {PACKAGE}.application.{MODULE}.handler;

import {PACKAGE}.domain.{MODULE}.model.event.{Business}StatusChangedEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Listener for {Business} status change events.
 * Lives in the application layer.
 */
@Slf4j
@Component
public class {Business}StatusChangedHandler {

    @EventListener
    public void on{Business}StatusChanged({Business}StatusChangedEvent event) {
        log.info("BIZ-SERVICE-LOGGER|{Business}StatusChanged|id={}|from={}|to={}",
            event.get{Business}Id(), event.getFromStatus(), event.getToStatus());
        // Handle status change: notify downstream, update related aggregates, etc.
    }
}
```

## Usage in Aggregate

```java
// Inside an aggregate method, after state transition:
public void complete() {
    if (this.status != {Business}StatusEnum.PROCESSING) {
        throw new MycmBizException(ErrorCodeEnum.BIZ_ERROR,
            "Cannot complete from status: " + this.status.getCode());
    }
    String fromStatus = this.status.getCode();
    this.status = {Business}StatusEnum.COMPLETED;
    // Event is published by a dedicated Publish*Event Action AFTER persistence
}
```

## Usage in Handler / Action

> 事件**不能在 Action 内 Repository.save 完之后立刻发布** —— 那个事务还没提交,事件已经飞出去,
> 一旦事务回滚就会出现"事件已发但数据未落"的不一致。正确做法:**把"发事件"单独抽一个 Action**,
> 放在 SaveAction 之后,这样发事件的事务边界与持久化事务边界分离,持久化失败后续 Action 不会执行。

```java
package {PACKAGE}.application.{MODULE}.handler;

import javax.annotation.Resource;
import org.springframework.stereotype.Component;
import {PACKAGE}.application.shared.handler.HandlerTemplate;
import {PACKAGE}.application.{MODULE}.context.{Business}Context;
import {PACKAGE}.application.{MODULE}.action.LoadAndCompleteAggregatorAction;
import {PACKAGE}.application.{MODULE}.action.SaveAggregatorAction;
import {PACKAGE}.application.{MODULE}.action.Publish{Business}StatusChangedEventAction;

@Component
public class Complete{Business}Handler extends HandlerTemplate<{Business}Context> {

    @Resource private LoadAndCompleteAggregatorAction loadAndCompleteAction;
    @Resource private SaveAggregatorAction saveAction;
    @Resource private Publish{Business}StatusChangedEventAction publishEventAction;

    @Override
    protected void doHandle({Business}Context ctx) {
        run(loadAndCompleteAction, ctx);   // 事务1:加载 + 领域方法 aggregator.complete()
        run(saveAction, ctx);              // 事务2:持久化新状态
        run(publishEventAction, ctx);      // 事务3:发布事件(独立事务边界)
    }
}
```

```java
package {PACKAGE}.application.{MODULE}.action;

import javax.annotation.Resource;
import org.springframework.stereotype.Component;
import {PACKAGE}.application.shared.handler.Action;
import {PACKAGE}.application.{MODULE}.context.{Business}Context;
import {PACKAGE}.domain.{MODULE}.model.event.{Business}StatusChangedEvent;
import {PACKAGE}.domain.event.DomainEventPublisher;

@Component
public class Publish{Business}StatusChangedEventAction implements Action<{Business}Context> {

    @Resource
    private DomainEventPublisher domainEventPublisher;

    @Override
    public void process({Business}Context ctx) {
        domainEventPublisher.publish(new {Business}StatusChangedEvent(
            ctx.get{Business}Id(),
            ctx.getFromStatus(),
            ctx.getToStatus()
        ));
    }
}
```

> **注**:本项目不存在 ApplicationService 层,事件发布由 Action 承担,
> 一个 Action 一件事 —— PublishEventAction 只负责发事件,不做其他副作用。
