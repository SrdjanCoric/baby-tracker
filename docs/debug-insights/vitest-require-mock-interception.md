# Vitest `vi.mock` Not Intercepting `require()` Calls

## Problem

All 12 tests in `notification-service.test.ts` that expected `expo-notifications` to be functional were failing. The service logged `[Notifications] Module not available (Expo Go)`, meaning the `Notifications` variable was `null` despite `vi.mock("expo-notifications", ...)` being set up correctly in the test file.

## Root Cause

`notification-service.ts` used a dynamic `require()` inside a try/catch to handle environments where `expo-notifications` isn't available (Expo Go):

```typescript
let Notifications: typeof import("expo-notifications") | null = null;
try {
  Notifications = require("expo-notifications");
} catch {
  console.log("[Notifications] Module not available (Expo Go)");
}
```

Vitest uses Vite under the hood, which transforms all source files as ESM. While `vi.mock()` is hoisted and intercepts standard ESM `import` statements reliably, the CJS `require()` call inside a try/catch was not being intercepted by the mock system. The `require()` hit the real module resolution, failed in the Node test environment (no native module), caught the error silently, and left `Notifications = null`.

The test's `vi.mock("expo-notifications", () => ({...}))` worked perfectly for the test file's own `import * as ExpoNotifications from "expo-notifications"` (ESM import), but not for the service's `require()` (CJS).

## Fix

Replaced the `require()` pattern with a static ESM `import` plus a runtime availability check function:

```typescript
import * as Notifications from "expo-notifications";

function isNotificationsAvailable(): boolean {
  try {
    return typeof Notifications?.setNotificationHandler === "function";
  } catch {
    return false;
  }
}
```

All `if (!Notifications)` guards were changed to `if (!isNotificationsAvailable())`.

This preserves the same runtime behavior:
- In development builds: the module imports successfully, `setNotificationHandler` is a function, availability returns `true`
- In Expo Go: the module JS imports but native functions are undefined/stubs, availability returns `false`
- In tests: `vi.mock` intercepts the static import, mock functions are present, availability returns `true`

## Key Takeaway

In vitest (Vite-based), prefer static `import` over dynamic `require()` for modules that need mocking. Vitest's mock system reliably intercepts ESM imports but may not intercept CJS `require()` calls, especially inside try/catch blocks. When you need runtime feature detection for native modules, check function availability after import rather than wrapping the import itself.
