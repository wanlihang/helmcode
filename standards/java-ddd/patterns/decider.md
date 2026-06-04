# Decider Pattern(场景 × 功能 二维网格)

> **When to use**:同一个功能(feature)在不同业务场景(scene)下需要走不同 Handler 实现时,
> 用 Decider 显式表达 **scene × feature → Handler** 的二维网格。
>
> **核心原则**:
> 1. **显式 switch 网格,而非 Map 自动注册** —— 任何人读代码 10 秒内知道某 (scene, feature) 走哪个 Handler
> 2. **scene 由 SceneInferrer 从 ctx 推断,不由调用方传字符串** —— 避免 type 字段污染调用方
> 3. **决策代码即文档** —— 新增 scene 或 feature 时,编译器强制覆盖所有 switch case
>
> **配套**:`patterns/acceptor.md`(Acceptor 内调 Decider)、`patterns/handler.md`(Decider 返回的 Handler 类型)
>
> **审查规则**:`review-rules §J`(禁 Map<String, ?> + @PostConstruct 自注册路由 / 禁 BizAbility/RoutableHandler/HandlerLocator 类名 / Decider 必须 switch 不能 Map.get)

## 核心定位

```
┌──────────────────────────────────────────────────────────────────┐
│  FacadeImpl.submitMapping(command)                               │
│  └─ BizTemplate.doProcess(command, () -> {                       │
│       │   ┌────────────────────────────────────────────────┐     │
│       ├──>│ Acceptor.acceptSubmit(command)                 │     │
│       │   │  - 跨字段校验 / 状态前置 / 权限 / 幂等              │     │
│       │   │  - 组装 Context                                 │     │
│       │   └────────────────────────────────────────────────┘     │
│       │   ┌────────────────────────────────────────────────┐     │
│       ├──>│ Decider.decide({Bc}Feature.XXX, ctx)           │     │
│       │   │  1. SceneInferrer.infer(ctx.toSceneInput())    │     │
│       │   │  2. switch (scene) { case ...: chooseForXxx }  │     │
│       │   │  3. switch (feature) { case ...: return ... }  │     │
│       │   │  4. 返回具体 Handler 实例                         │     │
│       │   └────────────────────────────────────────────────┘     │
│       │   ┌────────────────────────────────────────────────┐     │
│       └──>│ handler.execute(ctx)                           │     │
│           │  HandlerTemplate.doHandle:                      │     │
│           │    run(action1, ctx); run(action2, ctx); ...   │     │
│           └────────────────────────────────────────────────┘     │
│     });                                                          │
└──────────────────────────────────────────────────────────────────┘
```

## BizScene 枚举(跨 BC 共享场景)

```java
package {PACKAGE}.application.shared.scene;

/**
 * 业务场景枚举。新增场景:在此枚举加值 + 改 SceneInferrer + 各 BC Decider 加 case。
 *
 * <p>这是跨 BC 共享的"业务场景"维度,不要把单 BC 的细分模式塞到这里。
 * 单 BC 内部的细分走 {Bc}Feature 枚举。
 */
public enum BizScene {

    /** 标准签约场景 —— 默认场景,所有功能首先支持这个场景。 */
    FORMAL_SIGN,

    // 后续可扩展:TRIAL_SIGN / OFFLINE_SIGN / BATCH_SIGN ...
}
```

## SceneInferrer — 从 Context 推断场景

```java
package {PACKAGE}.application.shared.scene;

/**
 * 场景推断器:根据上下文(签约类型 / 实例属性 / 操作来源等)推断当前业务场景。
 *
 * <p>调用方不传 scene 字符串 —— 避免每个 Facade 入参都多一个 scene 字段,
 * 也避免上游传错。scene 由系统从已有上下文推断。
 */
public interface SceneInferrer {

    /**
     * 推断当前场景。infer 失败应抛 MycmBizException(场景识别失败),不返回 null。
     */
    BizScene infer(SceneInput input);
}
```

```java
package {PACKAGE}.application.shared.scene;

import lombok.Builder;
import lombok.Getter;

/**
 * SceneInferrer 输入。各 BC Context 自己实现 toSceneInput() 提供必要字段,
 * SceneInferrer 不直接耦合任何 BC Context。
 */
@Getter
@Builder
public class SceneInput {

    /** 业务类目(如 FORMAL / TRIAL),可空 —— 推断器据此判断。 */
    private final String bizCategory;

    /** 创建来源(WEB / OPENAPI / BATCH),可空。 */
    private final String createType;

    /** 机构角色类型,可空。 */
    private final String instRoleType;
}
```

```java
package {PACKAGE}.application.shared.scene;

import org.springframework.stereotype.Component;
import com.mycm.common.model.exception.MycmBizException;
import com.mycm.common.model.exception.ErrorCodeEnum;

/**
 * 默认场景推断器。当前只支持 FORMAL_SIGN。
 *
 * <p>新增场景示例:
 * <pre>
 * if ("TRIAL".equals(input.getBizCategory())) {
 *     return BizScene.TRIAL_SIGN;
 * }
 * </pre>
 *
 * <p>推断逻辑变复杂时(>5 条分支),拆责任链:每个场景一个 SceneMatcher。
 */
@Component
public class DefaultSceneInferrer implements SceneInferrer {

    @Override
    public BizScene infer(SceneInput input) {
        if (input == null) {
            throw new MycmBizException(ErrorCodeEnum.ILLEGAL_ARGUMENT,
                "SceneInput must not be null");
        }
        // 当前只有 FORMAL_SIGN 场景,后续扩展时在此加分支
        return BizScene.FORMAL_SIGN;
    }
}
```

## {Bc}Feature 枚举 — 单 BC 的功能点清单

```java
package {PACKAGE}.application.{bc}.decider;

/**
 * {Bc} BC 的功能点枚举。新增功能 = 加一个 case + Decider 加 switch 分支。
 *
 * <p>命名规则:动词 + 名词(简短)。一个功能对应 Facade 上一个方法。
 */
public enum {Bc}Feature {

    /** 创建 {bc}。对应 Facade.create{Bc}。 */
    CREATE,

    /** 推进 {bc} 状态。对应 Facade.forward{Bc}。 */
    FORWARD,

    /** 回退 {bc} 状态。对应 Facade.back{Bc}。 */
    BACK,

    /** 删除 {bc}。对应 Facade.delete{Bc}。 */
    DELETE,
}
```

## {Bc}Decider — 接口

```java
package {PACKAGE}.application.{bc}.decider;

import {PACKAGE}.application.{bc}.context.{Bc}Context;
import {PACKAGE}.application.shared.handler.Handler;

/**
 * {Bc} BC 的决策器接口。给定 feature + ctx,返回对应 Handler。
 *
 * <p>实现必须用 switch 显式列出 scene × feature 网格,不能用 Map.get。
 */
public interface {Bc}Decider {

    Handler<{Bc}Context> decide({Bc}Feature feature, {Bc}Context ctx);
}
```

## Default{Bc}Decider — switch 网格实现

```java
package {PACKAGE}.application.{bc}.decider;

import javax.annotation.Resource;
import org.springframework.stereotype.Component;
import com.mycm.common.model.exception.MycmSysException;
import com.mycm.common.model.exception.ErrorCodeEnum;
import {PACKAGE}.application.{bc}.context.{Bc}Context;
import {PACKAGE}.application.{bc}.handler.*;
import {PACKAGE}.application.shared.handler.Handler;
import {PACKAGE}.application.shared.scene.BizScene;
import {PACKAGE}.application.shared.scene.SceneInferrer;

/**
 * {Bc} 决策器默认实现 —— scene × feature 二维网格。
 *
 * <p>读这个类等于读"业务全景":
 * <ul>
 *   <li>主 switch 列出当前支持的所有场景</li>
 *   <li>每个场景的 chooseForXxx 列出该场景下所有 feature 对应的 Handler</li>
 *   <li>新增场景:加 case + 新 chooseForYyy 方法</li>
 *   <li>新增 feature:在 {Bc}Feature 加值 + 各 chooseForXxx 加 case</li>
 * </ul>
 */
@Component
public class Default{Bc}Decider implements {Bc}Decider {

    @Resource
    private SceneInferrer sceneInferrer;

    // 各 Handler 显式 @Resource,IDE 跳转一目了然
    @Resource private Create{Bc}Handler create{Bc}Handler;
    @Resource private Forward{Bc}Handler forward{Bc}Handler;
    @Resource private Back{Bc}Handler back{Bc}Handler;
    @Resource private Delete{Bc}Handler delete{Bc}Handler;

    @Override
    public Handler<{Bc}Context> decide({Bc}Feature feature, {Bc}Context ctx) {
        BizScene scene = sceneInferrer.infer(ctx.toSceneInput());
        switch (scene) {
            case FORMAL_SIGN:
                return chooseForFormalSign(feature);
            // 新增场景在此加 case:
            // case TRIAL_SIGN:
            //     return chooseForTrialSign(feature);
            default:
                throw new MycmSysException(ErrorCodeEnum.SYSTEM_INNER_ERROR,
                    "Unsupported scene: " + scene + " for feature: " + feature);
        }
    }

    private Handler<{Bc}Context> chooseForFormalSign({Bc}Feature feature) {
        switch (feature) {
            case CREATE:  return create{Bc}Handler;
            case FORWARD: return forward{Bc}Handler;
            case BACK:    return back{Bc}Handler;
            case DELETE:  return delete{Bc}Handler;
            default:
                throw new MycmSysException(ErrorCodeEnum.SYSTEM_INNER_ERROR,
                    "Unsupported feature in FORMAL_SIGN scene: " + feature);
        }
    }

    // 新增场景对应的 chooseForXxx 在此加方法
}
```

## Acceptor 内的调用范式

```java
package {PACKAGE}.application.{bc}.acceptor;

import javax.annotation.Resource;
import org.springframework.stereotype.Component;
import com.mycm.common.model.exception.MycmBizException;
import com.mycm.common.model.exception.ErrorCodeEnum;
import {PACKAGE}.application.{bc}.context.{Bc}Context;
import {PACKAGE}.application.{bc}.decider.{Bc}Decider;
import {PACKAGE}.application.{bc}.decider.{Bc}Feature;
import {PACKAGE}.facade.{bc}.request.Create{Bc}Command;

/**
 * {Bc} 业务受理。Acceptor 内统一通过 Decider 选 Handler,不直接 @Resource 注入 Handler。
 *
 * <p>这样 Acceptor 只关心 "我属于哪个 feature",不关心 scene 维度的分发。
 */
@Component
public class {Bc}Acceptor {

    @Resource
    private {Bc}Decider decider;

    public void acceptCreate(Create{Bc}Command command) {
        // 1. 跨字段校验 / 状态前置 / 权限 / 幂等
        validateCreate(command);

        // 2. 组装 Context
        {Bc}Context ctx = {Bc}Context.builder()
            .bizNo(command.getBizNo())
            .operator(command.getOperator())
            // ... 其他字段
            .build();

        // 3. Decider 选 Handler → 执行
        decider.decide({Bc}Feature.CREATE, ctx).execute(ctx);
    }

    private void validateCreate(Create{Bc}Command command) {
        // ...
    }
}
```

## Context 实现 SceneInput 提供

```java
package {PACKAGE}.application.{bc}.context;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import {PACKAGE}.application.shared.handler.HandlerContext;
import {PACKAGE}.application.shared.scene.SceneInput;

/**
 * {Bc} 上下文。toSceneInput 把 ctx 内的场景判定字段封装给 SceneInferrer。
 */
@Getter
@Setter
public class {Bc}Context extends HandlerContext {

    private final String bizCategory;
    private final String createType;
    private final String instRoleType;
    // ... 其他字段

    @Builder
    public {Bc}Context(String bizNo, String operator,
                       String bizCategory, String createType, String instRoleType) {
        super(bizNo, operator);
        this.bizCategory = bizCategory;
        this.createType = createType;
        this.instRoleType = instRoleType;
    }

    /**
     * 提供给 SceneInferrer 的输入。SceneInferrer 不直接耦合 {Bc}Context。
     */
    public SceneInput toSceneInput() {
        return SceneInput.builder()
            .bizCategory(this.bizCategory)
            .createType(this.createType)
            .instRoleType(this.instRoleType)
            .build();
    }
}
```

## 扩展指南

### 加新功能(feature)

```
1. {Bc}Feature 枚举加 case(如 PUBLISH)
2. 写 Publish{Bc}Handler extends HandlerTemplate<{Bc}Context>
3. Default{Bc}Decider:
   - @Resource private Publish{Bc}Handler publish{Bc}Handler;
   - chooseForFormalSign 内加 case PUBLISH: return publish{Bc}Handler;
   - 编译器会强制其他 chooseForXxx 也加这个 case(default 兜底也算)
4. Acceptor 加 acceptPublish(Publish{Bc}Command command) 方法
5. Facade 加 publish{Bc} 方法,内部 acceptor.acceptPublish(command)
```

### 加新场景(scene)

```
1. BizScene 枚举加值(如 TRIAL_SIGN)
2. DefaultSceneInferrer.infer 加判定分支
   (>5 条分支时,拆责任链:每个场景一个 SceneMatcher)
3. 各 BC 的 Default{Bc}Decider:
   - 主 switch 加 case TRIAL_SIGN: return chooseForTrialSign(feature);
   - 新增 private chooseForTrialSign(feature) 方法
   - 把该场景下每个 feature 对应的 Handler 列出来
4. 该场景下专属的 Handler 子类(如 TrialCreate{Bc}Handler)
5. 不影响 Facade / Acceptor —— 它们对 scene 无感
```

## 反模式(review 时直接打回)

```java
// ❌ 反模式 1: Map<String, ?> + @PostConstruct 自注册路由
//   - 违反 standards.md §0.4「代码顺序即执行顺序」(dispatch 黑盒)
//   - 不能表达二维 scene × feature
//   - IDE 找实现要去看 getType() / supports() / 字符串常量
@Component
public class {Bc}HandlerFactory {
    @Autowired private List<{Bc}Handler> handlers;
    private Map<String, {Bc}Handler> map = new HashMap<>();
    @PostConstruct void init() {
        handlers.forEach(h -> map.put(h.getType(), h));
    }
    public {Bc}Handler get(String type) { return map.get(type); }  // ❌ 黑盒
}

// ❌ 反模式 2: BizAbility / RoutableHandler / HandlerLocator 命名族
//   - 这是 ① 的同义异形,review 见这些类名直接打回
public interface RoutableHandler { String getAbility(); }
public class HandlerLocator { ... }       // ❌
public enum BizAbility { ... }            // ❌

// ❌ 反模式 3: Handler 上加 supportXxx 自报家门
//   - Handler 不应该知道自己被分发的规则
//   - 决策权应该集中在 Decider,Handler 只负责执行
public class Create{Bc}Handler extends HandlerTemplate<{Bc}Context> {
    public boolean supportScene(BizScene scene) { ... }   // ❌
    public {Bc}Feature supportFeature() { ... }            // ❌
}

// ❌ 反模式 4: Decider 用 Map.get 而非 switch
@Component
public class Default{Bc}Decider {
    private Map<{Bc}Feature, Handler<{Bc}Context>> table;  // ❌
    public Handler<{Bc}Context> decide({Bc}Feature f, {Bc}Context ctx) {
        return table.get(f);   // ❌ 失去 scene 维度,也失去编译期 case 完整性检查
    }
}

// ❌ 反模式 5: Acceptor 跳过 Decider 直接 @Resource Handler
@Component
public class {Bc}Acceptor {
    @Resource private Create{Bc}Handler create{Bc}Handler;  // ❌ 跳过 Decider
    public void acceptCreate(Create{Bc}Command cmd) {
        // ...
        create{Bc}Handler.execute(ctx);  // ❌ scene 维度永远进不来
    }
}

// ❌ 反模式 6: Facade 入参带 scene 字段
public class Create{Bc}Command extends BaseRequest {
    private String scene;   // ❌ 上游传错就完蛋;scene 应由 SceneInferrer 推断
}
```

## 与 strategy.md 的关系

**`patterns/strategy.md` 已废弃** —— 它的"Map auto-register + getStrategy(type)"模式
是 BizAbility 路由的同义异形,违反 §0.4,且只能表达单维 type → Strategy,不能表达 scene × feature。
所有原本用 Strategy Factory 的场景一律改用 Decider。

## 关联

- **审查规则**:`review-rules.md §J`(Decider 反模式)
- **包结构**:
  - `application/shared/scene/{BizScene,SceneInferrer,SceneInput,DefaultSceneInferrer}.java`
  - `application/{bc}/decider/{{Bc}Decider,{Bc}Feature,Default{Bc}Decider}.java`
- **上游**:`patterns/acceptor.md`(Acceptor 内调 Decider)
- **下游**:`patterns/handler.md`(Decider 返回的 Handler 类型)
