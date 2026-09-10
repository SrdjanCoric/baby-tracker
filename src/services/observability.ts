/**
 * Crash and error observability (Sentry).
 *
 * Reporting only. Nothing here changes app behavior: when no DSN is
 * configured the SDK stays disabled, and every hook below is best-effort.
 *
 * Privacy: `sendDefaultPii` is off, screenshots and view hierarchies are never
 * attached, and `scrubEvent` / `scrubBreadcrumb` strip emails and credential
 * shaped values before anything leaves the device.
 */
import * as Sentry from "@sentry/react-native";
import type { Breadcrumb } from "@sentry/react-native";
import { scrubBreadcrumb, scrubEvent } from "@/utils/observability-scrub";

export { scrubBreadcrumb, scrubEvent, scrubString, scrubValue } from "@/utils/observability-scrub";

export const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";

export function isObservabilityEnabled(): boolean {
  return SENTRY_DSN.length > 0;
}

let initialized = false;

/**
 * Initialize crash reporting. Safe to call at module evaluation time and
 * idempotent. No-op when `EXPO_PUBLIC_SENTRY_DSN` is unset (E2E, local dev).
 */
export function initObservability(): void {
  if (initialized) return;
  initialized = true;
  if (!isObservabilityEnabled()) return;

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: __DEV__ ? "development" : "production",
      sendDefaultPii: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      enableNativeNagger: false,
      // Release health: crash-free sessions per version.
      enableAutoSessionTracking: true,
      // Native crashes (SIGSEGV etc.), 0xdead10cc / OOM style terminations,
      // and main-thread hangs all become events.
      enableNativeCrashHandling: true,
      enableWatchdogTerminationTracking: true,
      enableAppHangTracking: true,
      appHangTimeoutInterval: 2,
      maxBreadcrumbs: 100,
      // Low sampling: we want navigation breadcrumbs and route context on
      // errors, not a performance product.
      tracesSampleRate: 0.05,
      integrations: [Sentry.expoRouterIntegration()],
      beforeSend: scrubEvent,
      beforeBreadcrumb: scrubBreadcrumb,
    });
  } catch {
    // Reporting must never take the app down.
  }
}

export interface ObservabilityUser {
  id: string;
  householdId: string | null;
  isOwner: boolean;
}

/** Attach the opaque user id plus account-shape tags. Never PII. */
export function setObservabilityUser(user: ObservabilityUser | null): void {
  if (!isObservabilityEnabled()) return;
  try {
    Sentry.setUser(user ? { id: user.id } : null);
    Sentry.setTag("signed_in", user ? "true" : "false");
    Sentry.setTag("has_household", user ? String(user.householdId != null) : "false");
    Sentry.setTag("is_owner", user ? String(user.isOwner) : "false");
  } catch {
    // ignore
  }
}

export function setObservabilityTag(key: string, value: string | boolean | null): void {
  if (!isObservabilityEnabled()) return;
  try {
    Sentry.setTag(key, value == null ? undefined : String(value));
  } catch {
    // ignore
  }
}

export function addObservabilityBreadcrumb(breadcrumb: Breadcrumb): void {
  if (!isObservabilityEnabled()) return;
  try {
    Sentry.addBreadcrumb(breadcrumb);
  } catch {
    // ignore
  }
}

export function captureObservabilityException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (!isObservabilityEnabled()) return;
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    // ignore
  }
}

/** Wrap the root component so touch and render breadcrumbs are collected. */
export const wrapRootComponent: typeof Sentry.wrap = (component, options) =>
  isObservabilityEnabled() ? Sentry.wrap(component, options) : component;
