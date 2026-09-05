import { buildLiveActivityEndRequest } from "../_shared/apns.ts";

export interface EndedTimer {
  baby_id: string;
  started_at: string;
  timer_data?: Record<string, unknown> | null;
}

interface ActivityToken {
  id: string;
  device_token: string;
  is_sandbox: boolean;
}

interface EndDependencies {
  findTokens(babyId: string, timerInstanceId: string): Promise<ActivityToken[]>;
  removeTokens(ids: string[]): Promise<void>;
  getJwt(): Promise<string>;
  fetch: typeof fetch;
  now(): number;
}

// No active_timers FK: its asynchronous DELETE webhook still needs these tokens.
export async function endTimerLiveActivities(
  timer: EndedTimer,
  deps: EndDependencies
) {
  const data = timer.timer_data;
  const instance = data?.timerInstanceId;
  if (typeof instance !== "string" || !instance) return { sent: 0, total: 0 };
  const tokens = await deps.findTokens(timer.baby_id, instance);
  if (!tokens.length) return { sent: 0, total: 0 };

  const now = deps.now();
  const timestamp = Math.floor(now / 1000);
  const pausedAt =
    data?.isPaused === true && typeof data.pausedAt === "string"
      ? Date.parse(data.pausedAt)
      : now;
  const totalPausedMs = Number(data?.totalPausedMs ?? 0);
  const elapsed = Math.floor(
    (pausedAt - Date.parse(timer.started_at) -
      (Number.isFinite(totalPausedMs) ? Math.max(0, totalPausedMs) : 0)) / 1000
  );
  const detail = data?.sleepType ?? data?.side ?? data?.type;
  const contentState = {
    elapsedSeconds: Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0,
    context: typeof detail === "string" ? detail : null,
    isPaused: true,
    effectiveStartTimeISO: null,
  };

  let sent = 0;
  const jwt = await deps.getJwt();
  let next = 0;
  const attempted: string[] = [];
  const deadline = performance.now() + 10000;
  async function deliver() {
    while (next < tokens.length) {
      const remaining = Math.floor(deadline - performance.now());
      if (remaining <= 0) return;
      const token = tokens[next++];
      attempted.push(token.id);
      try {
        const request = buildLiveActivityEndRequest({
          deviceToken: token.device_token, jwt, isSandbox: token.is_sandbox,
          timestamp, dismissalDate: timestamp - 1, contentState,
        });
        const response = await deps.fetch(request.url, {
          ...request.init, signal: AbortSignal.timeout(remaining),
        });
        if (response.status === 200) sent++;
      } catch {
        // Best effort per device; foreground reconciliation remains the fallback.
      }
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.min(8, tokens.length) }, deliver));
  } finally {
    // Preserve rows that could not be attempted within this invocation's budget.
    if (attempted.length) await deps.removeTokens(attempted);
  }
  return { sent, total: tokens.length };
}
