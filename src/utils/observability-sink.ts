/**
 * Dependency-free reporting sink for non-crash failures.
 *
 * Services and contexts import this module instead of the Sentry SDK so the
 * SDK never enters unit-test bundles and reporting stays a no-op until
 * `initObservability` registers the Sentry-backed sink. Every function here
 * is best-effort and never throws.
 */

export type ObservabilityIssueLevel = "warning" | "error";

export type ObservabilityTagValue = string | number | boolean | null | undefined;

export interface ObservabilityIssue {
  /** Stable, dotted identifier, e.g. `sync.push_exhausted`. Groups events. */
  name: string;
  /** Product area, becomes the `area` tag: sync, realtime, timers, auth, live_activity, push, widget, watch, device. */
  area: string;
  level?: ObservabilityIssueLevel;
  /** Underlying error, if any. Its message is attached; the event still groups by `name`. */
  error?: unknown;
  /** Low-cardinality values worth filtering on. */
  tags?: Record<string, ObservabilityTagValue>;
  /** Free-form diagnostics. Scrubbed before send. */
  extra?: Record<string, unknown>;
}

export interface ObservabilityBreadcrumbInput {
  category: string;
  message: string;
  level?: "info" | "warning" | "error";
  data?: Record<string, ObservabilityTagValue>;
}

export interface ObservabilitySink {
  reportIssue(issue: ObservabilityIssue): void;
  addBreadcrumb(breadcrumb: ObservabilityBreadcrumbInput): void;
  setTag(key: string, value: ObservabilityTagValue): void;
}

let activeSink: ObservabilitySink | null = null;

export function setObservabilitySink(sink: ObservabilitySink | null): void {
  activeSink = sink;
}

export function isObservabilitySinkActive(): boolean {
  return activeSink !== null;
}

const ISSUE_WINDOW_MS = 60_000;
const ISSUE_MAX_PER_WINDOW = 5;
const issueCounters = new Map<string, { windowStart: number; count: number }>();

/** Drop repeats of the same issue beyond a few per minute so a stuck loop cannot flood Sentry. */
export function shouldReportIssue(name: string, now = Date.now()): boolean {
  const entry = issueCounters.get(name);
  if (!entry || now - entry.windowStart >= ISSUE_WINDOW_MS) {
    issueCounters.set(name, { windowStart: now, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= ISSUE_MAX_PER_WINDOW;
}

/** Test hook. */
export function resetObservabilityIssueLimiter(): void {
  issueCounters.clear();
}

export function errorText(error: unknown): string | undefined {
  if (error == null) return undefined;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error).slice(0, 500);
  } catch {
    return String(error);
  }
}

/** Best-effort error code from Supabase/Postgrest style errors, for low-cardinality tagging. */
export function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && code.length > 0 && code.length <= 32) return code;
  if (typeof code === "number") return String(code);
  const status = (error as { status?: unknown }).status;
  if (typeof status === "number") return String(status);
  return undefined;
}

/**
 * Report a non-crash failure the user would perceive as the app being broken
 * (sync stuck, remote timer stop not applied, realtime channel dead, ...).
 * No-op until a sink is registered. Rate limited per `name`.
 */
export function reportIssue(issue: ObservabilityIssue): void {
  const sink = activeSink;
  if (!sink) return;
  try {
    if (!shouldReportIssue(issue.name)) return;
    sink.reportIssue(issue);
  } catch {
    // Reporting must never take the app down.
  }
}

/** Record a user-flow or system event so crash reports carry context. No-op until a sink is registered. */
export function recordBreadcrumb(breadcrumb: ObservabilityBreadcrumbInput): void {
  const sink = activeSink;
  if (!sink) return;
  try {
    sink.addBreadcrumb(breadcrumb);
  } catch {
    // ignore
  }
}

/** Set a low-cardinality tag on every subsequent event. No-op until a sink is registered. */
export function setContextTag(key: string, value: ObservabilityTagValue): void {
  const sink = activeSink;
  if (!sink) return;
  try {
    sink.setTag(key, value);
  } catch {
    // ignore
  }
}
