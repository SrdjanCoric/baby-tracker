/**
 * Device clock skew versus the server, derived from an HTTP `Date` header.
 *
 * Timers and sync ordering trust `Date.now()` on every device in a household,
 * so a phone that is minutes off produces wrong durations and misordered
 * writes. This is diagnostics only: nothing corrects the clock.
 */

export interface ClockSkewSample {
  /** Server time minus device time, positive when the device runs behind. */
  skewMs: number;
  roundTripMs: number;
}

/**
 * Compute skew from a request window and the server `Date` header. The header
 * has one second resolution, so callers should treat anything under a few
 * seconds as noise. Returns null when the header is unusable.
 */
export function computeClockSkew(
  requestStartMs: number,
  requestEndMs: number,
  dateHeader: string | null | undefined
): ClockSkewSample | null {
  if (!dateHeader) return null;
  const serverMs = Date.parse(dateHeader);
  if (!Number.isFinite(serverMs)) return null;
  const roundTripMs = Math.max(0, requestEndMs - requestStartMs);
  const deviceMidpointMs = requestStartMs + roundTripMs / 2;
  return { skewMs: serverMs - deviceMidpointMs, roundTripMs };
}

/** Skew beyond this is worth an issue, not just a tag. */
export const CLOCK_SKEW_WARN_MS = 60_000;

/** Bucket skew into a low-cardinality tag value. */
export function clockSkewBucket(skewMs: number): string {
  const abs = Math.abs(skewMs);
  if (abs < 5_000) return "ok";
  if (abs < CLOCK_SKEW_WARN_MS) return "minor";
  if (abs < 15 * 60_000) return "minutes";
  return "severe";
}
