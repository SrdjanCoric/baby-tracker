import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useAuth } from "@/contexts/auth-context";
import { useSync } from "@/contexts/sync-context";
import {
  isObservabilityEnabled,
  setObservabilityTag,
  setObservabilityUser,
} from "@/services/observability";
import {
  CLOCK_SKEW_WARN_MS,
  clockSkewBucket,
  computeClockSkew,
} from "@/utils/clock-skew";
import { recordBreadcrumb, reportIssue, setContextTag } from "@/utils/observability-sink";

const CLOCK_SKEW_PROBE_TIMEOUT_MS = 5_000;
/** Re-probe at most this often; the clock rarely changes while the app is open. */
const CLOCK_SKEW_PROBE_INTERVAL_MS = 30 * 60_000;

let lastClockSkewProbeAt = 0;

/**
 * Compare the device clock to the Supabase edge via an HTTP `Date` header.
 * Diagnostics only: tags the session and reports an issue when the device is
 * more than a minute off. Silent on any failure.
 */
async function probeClockSkew(): Promise<void> {
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!baseUrl || typeof fetch !== "function") return;
  const now = Date.now();
  if (now - lastClockSkewProbeAt < CLOCK_SKEW_PROBE_INTERVAL_MS) return;
  lastClockSkewProbeAt = now;

  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeout = setTimeout(() => controller?.abort(), CLOCK_SKEW_PROBE_TIMEOUT_MS);
  try {
    const start = Date.now();
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/auth/v1/health`, {
      method: "HEAD",
      cache: "no-store",
      signal: controller?.signal,
    });
    const end = Date.now();
    const sample = computeClockSkew(start, end, response.headers.get("date"));
    if (!sample) return;
    const bucket = clockSkewBucket(sample.skewMs);
    setContextTag("clock_skew", bucket);
    recordBreadcrumb({
      category: "device",
      message: "clock skew probe",
      data: { skewSeconds: Math.round(sample.skewMs / 1000), roundTripMs: sample.roundTripMs, bucket },
    });
    if (Math.abs(sample.skewMs) >= CLOCK_SKEW_WARN_MS) {
      reportIssue({
        name: "device.clock_skew",
        area: "device",
        level: "warning",
        tags: { bucket, behind: sample.skewMs > 0 },
        extra: { skewSeconds: Math.round(sample.skewMs / 1000), roundTripMs: sample.roundTripMs },
      });
    }
  } catch {
    // Diagnostics only.
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Mirrors auth and sync state into crash-report tags. Renders nothing and
 * never gates children, so it cannot affect what the user sees.
 */
export function ObservabilityScope() {
  const { user } = useAuth();
  const { isInitialized } = useSync();

  useEffect(() => {
    setObservabilityUser(
      user ? { id: user.id, householdId: user.householdId, isOwner: user.isOwner } : null
    );
  }, [user?.householdId, user?.id, user?.isOwner, user]);

  useEffect(() => {
    setObservabilityTag("sync_initialized", isInitialized);
  }, [isInitialized]);

  useEffect(() => {
    if (!isObservabilityEnabled()) return;
    void probeClockSkew();
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") void probeClockSkew();
    });
    return () => subscription.remove();
  }, []);

  return null;
}
