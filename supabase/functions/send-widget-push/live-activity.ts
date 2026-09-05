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
  const elapsed = Math.floor((pausedAt - Date.parse(timer.started_at)) / 1000);
  const detail = data?.sleepType ?? data?.side ?? data?.type;
  const body = JSON.stringify({
    aps: {
      timestamp,
      event: "end",
      "dismissal-date": timestamp - 1,
      "content-state": {
        elapsedSeconds: Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0,
        context: typeof detail === "string" ? detail : null,
        isPaused: true,
        effectiveStartTimeISO: null,
      },
    },
  });

  let sent = 0;
  try {
    const jwt = await deps.getJwt();
    for (const token of tokens) {
      try {
        const host = token.is_sandbox
          ? "api.sandbox.push.apple.com"
          : "api.push.apple.com";
        const response = await deps.fetch(
          `https://${host}/3/device/${token.device_token}`,
          {
            method: "POST",
            headers: {
              authorization: `bearer ${jwt}`,
              "apns-push-type": "liveactivity",
              "apns-priority": "10",
              "apns-topic": "com.sofibaby.app.push-type.liveactivity",
              "content-type": "application/json",
            },
            body,
            signal: AbortSignal.timeout(10000),
          }
        );
        if (response.status === 200) sent++;
      } catch {
        // Best effort delivery; foreground lock reconciliation is the fallback.
        // One failed device must not prevent the remaining end pushes.
      }
    }
  } finally {
    await deps.removeTokens(tokens.map((token) => token.id));
  }
  return { sent, total: tokens.length };
}
