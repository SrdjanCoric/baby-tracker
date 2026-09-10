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
import {
  errorCode,
  errorText,
  reportIssue,
  setObservabilitySink,
  type ObservabilityBreadcrumbInput,
  type ObservabilityIssue,
  type ObservabilitySink,
} from "@/utils/observability-sink";

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
    setObservabilitySink(sentrySink);
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
  context?: Record<string, unknown>,
  tags?: Record<string, string>
): void {
  if (!isObservabilityEnabled()) return;
  try {
    Sentry.captureException(error, {
      ...(context ? { extra: context } : {}),
      ...(tags ? { tags } : {}),
    });
  } catch {
    // ignore
  }
}

export type {
  ObservabilityIssue,
  ObservabilityIssueLevel,
  ObservabilityBreadcrumbInput,
} from "@/utils/observability-sink";
export { resetObservabilityIssueLimiter } from "@/utils/observability-sink";

/**
 * Report a non-crash failure the user would perceive as the app being broken
 * (sync stuck, remote timer stop not applied, realtime channel dead, ...).
 * Events group by `name`, carry `area` and `issue` tags plus the current auth
 * and sync tags, and never throw. Services should call `reportIssue` from
 * `@/utils/observability-sink` instead so they never import the SDK.
 */
export const reportObservabilityIssue = reportIssue;

function sendIssueToSentry(issue: ObservabilityIssue): void {
  const tags: Record<string, string> = { issue: issue.name, area: issue.area };
  for (const [key, value] of Object.entries(issue.tags ?? {})) {
    if (value != null) tags[key] = String(value);
  }
  const extra: Record<string, unknown> = { ...(issue.extra ?? {}) };
  const text = errorText(issue.error);
  if (text) extra.error = text;
  const code = errorCode(issue.error);
  if (code && !tags.code) tags.code = code;
  Sentry.captureMessage(issue.name, {
    level: issue.level ?? "error",
    tags,
    extra,
    fingerprint: [issue.name],
  });
}

function sendBreadcrumbToSentry(breadcrumb: ObservabilityBreadcrumbInput): void {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(breadcrumb.data ?? {})) {
    if (value != null) data[key] = value;
  }
  Sentry.addBreadcrumb({
    category: breadcrumb.category,
    message: breadcrumb.message,
    level: breadcrumb.level ?? "info",
    data,
  });
}

const sentrySink: ObservabilitySink = {
  reportIssue: sendIssueToSentry,
  addBreadcrumb: sendBreadcrumbToSentry,
  setTag: (key, value) => Sentry.setTag(key, value == null ? undefined : String(value)),
};

/** Wrap the root component so touch and render breadcrumbs are collected. */
export const wrapRootComponent: typeof Sentry.wrap = (component, options) =>
  isObservabilityEnabled() ? Sentry.wrap(component, options) : component;
