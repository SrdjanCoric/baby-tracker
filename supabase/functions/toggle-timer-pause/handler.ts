export interface AuthenticatedCaller {
  id: string;
}

export interface ToggleTimerRequest {
  babyId: string;
  activityType: "feeding" | "sleep" | "pumping" | "tummy_time";
  action: "pause" | "resume";
  timerData: Record<string, unknown>;
  userId?: string;
  liveActivityPushToken?: string;
  isSandbox?: boolean;
  elapsedSeconds?: number;
  context?: string | null;
  effectiveStartTimeISO?: string | null;
}

export class ToggleTimerMutationError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 500,
    message: string
  ) {
    super(message);
    this.name = "ToggleTimerMutationError";
  }
}

export interface NotificationResult {
  widgetPushCount: number;
  liveActivityUpdated: boolean;
}

interface ToggleTimerPauseDependencies {
  authenticate: (accessToken: string) => Promise<AuthenticatedCaller | null>;
  mutateTimer: (
    accessToken: string,
    caller: AuthenticatedCaller,
    payload: ToggleTimerRequest
  ) => Promise<void>;
  sendNotifications: (payload: ToggleTimerRequest) => Promise<NotificationResult>;
  corsHeaders?: Record<string, string>;
}

const TIMER_ACTIVITY_TYPES = new Set([
  "feeding",
  "sleep",
  "pumping",
  "tummy_time",
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function isValidApnsToken(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 32
    && value.length <= 512
    && value.length % 2 === 0
    && /^[0-9a-f]+$/i.test(value);
}

function isOptionalNonNegativeNumber(value: unknown): boolean {
  return value === undefined
    || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

function validateToggleTimerRequest(
  value: Record<string, unknown>
): ToggleTimerRequest | null {
  if (typeof value.babyId !== "string" || !UUID_PATTERN.test(value.babyId)) return null;
  if (typeof value.activityType !== "string" || !TIMER_ACTIVITY_TYPES.has(value.activityType)) {
    return null;
  }
  if (value.action !== "pause" && value.action !== "resume") return null;
  if (!isRecord(value.timerData)) return null;
  if (value.userId !== undefined && typeof value.userId !== "string") return null;
  if (!isOptionalNonNegativeNumber(value.elapsedSeconds)) return null;
  if (!isOptionalNonNegativeNumber(value.timerData.accumulatedSeconds)) return null;
  if (value.isSandbox !== undefined && typeof value.isSandbox !== "boolean") return null;
  if (value.context !== undefined && value.context !== null && typeof value.context !== "string") {
    return null;
  }
  if (
    value.liveActivityPushToken !== undefined
    && !isValidApnsToken(value.liveActivityPushToken)
  ) {
    return null;
  }

  if (value.action === "pause") {
    if (value.timerData.isPaused !== true || !isIsoTimestamp(value.timerData.pausedAt)) return null;
  } else {
    if (value.timerData.isPaused !== false) return null;
    if (
      value.effectiveStartTimeISO !== undefined
      && value.effectiveStartTimeISO !== null
      && !isIsoTimestamp(value.effectiveStartTimeISO)
    ) {
      return null;
    }
    if (
      value.timerData.effectiveStartTime !== undefined
      && !isIsoTimestamp(value.timerData.effectiveStartTime)
    ) {
      return null;
    }
  }

  return value as unknown as ToggleTimerRequest;
}

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Requires a validated Bearer user, rejects legacy user-ID impersonation, and delegates the
 * mutation through that caller's JWT before privileged notification work may run.
 */
export function createToggleTimerPauseHandler(
  dependencies: ToggleTimerPauseDependencies
): (request: Request) => Promise<Response> {
  const corsHeaders = dependencies.corsHeaders ?? {};

  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    const authorization = request.headers.get("authorization");
    const match = authorization?.match(/^Bearer ([^\s]+)$/);
    if (!match) {
      return jsonResponse(401, { error: "Authentication required" }, corsHeaders);
    }

    let caller: AuthenticatedCaller | null;
    try {
      caller = await dependencies.authenticate(match[1]);
    } catch {
      caller = null;
    }
    if (!caller) {
      return jsonResponse(401, { error: "Invalid or expired authentication" }, corsHeaders);
    }

    let rawPayload: unknown;
    try {
      rawPayload = await request.json();
    } catch {
      return jsonResponse(400, { error: "Invalid JSON body" }, corsHeaders);
    }
    if (!isRecord(rawPayload)) {
      return jsonResponse(400, { error: "Invalid request body" }, corsHeaders);
    }

    const payload = validateToggleTimerRequest(rawPayload);
    if (!payload) {
      return jsonResponse(400, { error: "Invalid timer request" }, corsHeaders);
    }

    if (payload.userId !== undefined && payload.userId !== caller.id) {
      return jsonResponse(403, { error: "Authenticated user mismatch" }, corsHeaders);
    }

    try {
      await dependencies.mutateTimer(match[1], caller, payload);
    } catch (error) {
      if (error instanceof ToggleTimerMutationError) {
        return jsonResponse(error.status, { error: error.message }, corsHeaders);
      }
      return jsonResponse(500, { error: "Failed to update timer" }, corsHeaders);
    }
    let notificationResult: NotificationResult;
    try {
      notificationResult = await dependencies.sendNotifications(payload);
    } catch {
      return jsonResponse(500, {
        error: "Timer updated but notifications failed",
      }, corsHeaders);
    }

    return jsonResponse(200, {
      success: true,
      widgetPushCount: notificationResult.widgetPushCount,
      liveActivityUpdated: notificationResult.liveActivityUpdated,
    }, corsHeaders);
  };
}
