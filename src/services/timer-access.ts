import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { errorCode } from "@/utils/observability-sink";

import { TimerAccessUnavailableError } from "./timer-access-error";

const ACCESS_CACHE_MS = 60_000;
const babyAccessChecks = new Map<
  string,
  { flight: Promise<void>; expiresAt: number }
>();
let accessCacheSubscribed = false;

let refreshFlight: Promise<void> | undefined;
async function refreshTimerSession(): Promise<void> {
  if (!refreshFlight) {
    refreshFlight = (async () => {
      const { data, error } = await supabase.auth.refreshSession();
      if (error && isAuthRetryableFetchError(error)) throw error;
      if (error || !data.session)
        throw new TimerAccessUnavailableError("signed_out");
    })();
  }
  const flight = refreshFlight;
  try {
    await flight;
  } finally {
    if (refreshFlight === flight) refreshFlight = undefined;
  }
}

async function requireTimerAccess(
  babyId: string,
  expectedUserId?: string
): Promise<void> {
  if (!accessCacheSubscribed) {
    supabase.auth.onAuthStateChange(() => {
      babyAccessChecks.clear();
    });
    accessCacheSubscribed = true;
  }
  // getSession waits for SDK initialization and refreshes locally expired sessions.
  const { data, error } = await supabase.auth.getSession();
  if (error && (data.session || isAuthRetryableFetchError(error))) throw error;
  const session = data.session;
  if (!session || session.user.is_anonymous) {
    throw new TimerAccessUnavailableError("signed_out");
  }
  if (expectedUserId && session.user.id !== expectedUserId) {
    throw new TimerAccessUnavailableError("signed_out", true);
  }
  const key = `${session.user.id}:${babyId}`;
  let check = babyAccessChecks.get(key);
  if (check && check.expiresAt <= Date.now()) {
    babyAccessChecks.delete(key);
    check = undefined;
  }
  if (!check) {
    // RLS checks current membership; cache only a short-lived successful result.
    const flight = (async () => {
      const { data: baby, error: babyError } = await supabase
        .from("babies")
        .select("id")
        .eq("id", babyId)
        .eq("deleted", false)
        .maybeSingle();
      // Preserve PostgREST fields because retry classification depends on code and message.
      if (babyError) throw { ...babyError, timerResource: "babies" };
      if (!baby) throw new TimerAccessUnavailableError("revoked");
    })();
    check = { flight, expiresAt: Infinity };
    babyAccessChecks.set(key, check);
  }
  try {
    await check.flight;
    if (babyAccessChecks.get(key) === check && check.expiresAt === Infinity) {
      check.expiresAt = Date.now() + ACCESS_CACHE_MS;
    }
  } catch (error) {
    if (babyAccessChecks.get(key) === check) babyAccessChecks.delete(key);
    throw error;
  }
}

export async function withTimerAccess<T>(
  babyId: string,
  request: () => PromiseLike<T & { error: unknown }>,
  expectedUserId?: string,
  resource = "active_timers"
): Promise<T & { error: unknown }> {
  try {
    await requireTimerAccess(babyId, expectedUserId);
    const result = await request();
    if (errorCode(result.error) !== "PGRST303")
      return annotateTimerError(result, resource);
  } catch (error) {
    if (errorCode(error) === "42501") babyAccessChecks.clear();
    if (errorCode(error) !== "PGRST303") throw error;
  }
  await refreshTimerSession();
  await requireTimerAccess(babyId, expectedUserId);
  return annotateTimerError(await request(), resource);
}

function annotateTimerError<T extends { error: unknown }>(
  result: T,
  resource: string
): T {
  if (errorCode(result.error) !== "42501") return result;
  babyAccessChecks.clear();
  return {
    ...result,
    error: { ...(result.error as object), timerResource: resource },
  };
}
