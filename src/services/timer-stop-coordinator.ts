import { readPendingWidgetStop } from "./widget-data-service";

export type TimerStopActivityType =
  | "feeding"
  | "sleep"
  | "pumping"
  | "tummy_time";

export interface PendingTimerStop {
  activityType: string;
  stoppedAt: string;
  babyId?: string;
}

export interface RestoredTimer {
  isRunning: boolean;
  startTime: Date;
}

export type PendingTimerStopResult = "waiting" | "consumed" | "stale";

export async function readPendingTimerStop(): Promise<PendingTimerStop | null> {
  return readPendingWidgetStop();
}

export function isPendingStopForTimer(
  pending: PendingTimerStop | null,
  activityType: TimerStopActivityType,
  timerStartTime: Date,
  babyId?: string
): boolean {
  if (
    !pending ||
    pending.activityType !== activityType ||
    (pending.babyId !== undefined && pending.babyId !== babyId)
  ) {
    return false;
  }

  const stoppedAtMs = new Date(pending.stoppedAt).getTime();
  const startedAtMs = timerStartTime.getTime();
  return (
    Number.isFinite(stoppedAtMs) &&
    Number.isFinite(startedAtMs) &&
    startedAtMs <= stoppedAtMs
  );
}

export function isTimerRestoreObsolete(
  stopVersionAtStart: number,
  currentStopVersion: number,
  isStopping: boolean
): boolean {
  return isStopping || stopVersionAtStart !== currentStopVersion;
}

export async function processPendingTimerStop(
  pending: PendingTimerStop,
  timer: RestoredTimer | null | undefined,
  stop: (endTime: Date) => Promise<unknown>,
  babyId?: string
): Promise<PendingTimerStopResult> {
  if (pending.babyId !== undefined && pending.babyId !== babyId)
    return "waiting";
  if (!timer?.isRunning) return "waiting";

  const stoppedAt = new Date(pending.stoppedAt);
  if (
    !Number.isFinite(stoppedAt.getTime()) ||
    timer.startTime.getTime() > stoppedAt.getTime()
  ) {
    return "stale";
  }

  await stop(stoppedAt);
  return "consumed";
}
