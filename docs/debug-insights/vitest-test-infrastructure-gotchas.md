# Vitest Test Infrastructure Gotchas

Three distinct problems surfaced while adding unit tests for services and context reducers. Each had a different root cause.

## 1. React Native Flow Syntax Breaking Vite

### Problem

Any test importing a module that transitively imported `react-native` failed with a parse error:

```
/node_modules/react-native/index.js:14:35: Expected "from" but found "typeof"
import typeof AccessibilityInfo from ...
```

### Root Cause

React Native's source uses Flow type syntax (`import typeof`). Vite/Rollup tries to parse all resolved modules as standard JS/TS and chokes on Flow syntax. This only happens when Vite attempts to bundle `react-native` into the test module graph.

### Fix

Tell Vite to treat `react-native` as an external dependency (skip bundling) in `vitest.config.ts`:

```typescript
server: {
  deps: {
    external: ["react-native"],
  },
},
```

Combined with `vi.mock("react-native", ...)` in each test file, this prevents Vite from ever parsing the real module.

## 2. Arrow-Function Mocks Are Not Constructable

### Problem

Tests for `sync-context` failed with `SyncEngine is not a constructor` when the source code used `new SyncEngine(...)`.

### Root Cause

The mock was defined as:

```typescript
vi.mock("@/services/sync", () => ({
  SyncEngine: vi.fn(() => ({ initialize: vi.fn() })),
}));
```

Arrow functions and `vi.fn()` wrappers are not constructable — `new` throws. The source code does `new SyncEngine()` and `new RealTimeSync()`, so the mocks must support the `new` operator.

### Fix

Use class-based mocks:

```typescript
vi.mock("@/services/sync", () => ({
  SyncEngine: class {
    initialize = vi.fn();
    setAuthContext = vi.fn();
    // ...
  },
  RealTimeSync: class {
    subscribe = vi.fn();
    unsubscribeAll = vi.fn();
  },
}));
```

Classes are always constructable and behave identically to the real classes from the mock consumer's perspective.

## 3. `require()` vs `import` Creates Separate Module References

### Problem

`notification-service.ts` used `require("expo-notifications")` inside a try/catch for Expo Go compatibility. Tests using `vi.mock("expo-notifications", ...)` with a standard `import` got a *different* module reference than the service's `require()`, so mock assertions failed.

### Root Cause

Vitest (via Vite) transforms source to ESM. `vi.mock()` intercepts the ESM module namespace. But a `require()` call in the source may resolve to a different namespace object than the test's `import`. The mock factory creates one object, but the service and the test each get their own reference to it.

### Fix (Applied)

Two approaches were used:

**Approach A** (from `vitest-require-mock-interception.md`): Refactor the source to use static `import` with runtime feature detection instead of `require()`.

**Approach B** (test-side): Use `vi.importMock()` in the test to get the same reference the source gets:

```typescript
let mocks: Record<string, ReturnType<typeof vi.fn>>;
beforeEach(async () => {
  vi.clearAllMocks();
  mocks = await vi.importMock<Record<string, ReturnType<typeof vi.fn>>>("expo-notifications");
});
```

Approach A is preferred because it eliminates the mismatch at the source level.

## General Takeaways

- Always add `react-native` to `server.deps.external` in vitest config for React Native projects
- When mocking classes, use `class {}` syntax, not `vi.fn(() => ({}))`
- Avoid `require()` in source files that need test mocking — use static `import` with runtime checks
- When `require()` can't be avoided, use `vi.importMock()` in tests to get the matching reference
