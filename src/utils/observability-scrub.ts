/**
 * PII scrubbing for crash reports. Pure functions, no SDK import, so they can
 * be unit tested without React Native.
 */
import type { Breadcrumb, ErrorEvent } from "@sentry/core";

const SENSITIVE_KEY_PATTERN =
  /(email|password|passwd|secret|token|authorization|cookie|session|credential|api[-_]?key|refresh|jwt)/i;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BEARER_PATTERN = /bearer\s+[a-z0-9\-._~+/]+=*/gi;
const JWT_PATTERN = /eyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}/g;
const REDACTED = "[redacted]";
const MAX_DEPTH = 8;

export function scrubString(value: string): string {
  return value
    .replace(JWT_PATTERN, REDACTED)
    .replace(BEARER_PATTERN, `bearer ${REDACTED}`)
    .replace(EMAIL_PATTERN, REDACTED);
}

export function scrubValue(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (typeof value === "string") return scrubString(value);
  if (typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return REDACTED;
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : scrubValue(entry, depth + 1);
  }
  return out;
}

export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
  if (event.user) {
    // Keep only the opaque Supabase user id. Never email, name, or IP.
    event.user = event.user.id ? { id: event.user.id } : undefined;
  }
  if (event.message) event.message = scrubString(event.message);
  if (event.extra) event.extra = scrubValue(event.extra) as ErrorEvent["extra"];
  if (event.contexts) event.contexts = scrubValue(event.contexts) as ErrorEvent["contexts"];
  if (event.tags) event.tags = scrubValue(event.tags) as ErrorEvent["tags"];
  if (event.request) {
    event.request = {
      url: event.request.url ? scrubString(event.request.url) : undefined,
      method: event.request.method,
    };
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map((crumb) => scrubBreadcrumb(crumb))
      .filter((crumb): crumb is Breadcrumb => crumb != null);
  }
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubString(exception.value);
  }
  return event;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  const next: Breadcrumb = { ...breadcrumb };
  if (next.message) next.message = scrubString(next.message);
  if (next.data) next.data = scrubValue(next.data) as Breadcrumb["data"];
  return next;
}
