import type { StoredSleepEntry } from "@/services/sleep-storage";
import { classifySleepByTimeRange } from "@/utils/sleep-patterns";

export interface OngoingSleepTimer {
  isRunning: boolean;
  startTime: Date;
  totalPausedMs: number;
  isPaused?: boolean;
  /** Set while a pause is open; its elapsed time is not yet in totalPausedMs. */
  pausedAt?: Date;
}

export interface OngoingSleepEntryInput {
  timer: OngoingSleepTimer | null | undefined;
  babyId: string | undefined;
  isCurrentBaby: boolean;
  now: Date;
  dayStartHour: number;
  dayEndHour: number;
}

/**
 * Represents a running sleep timer as a completed entry ending now, so that sleep surfaces
 * report the sleep in progress instead of waiting for it to be stopped. Shared by the
 * Statistics sleep screens and the Timeline daily summary so both report the same day.
 *
 * The entry starts at the pause-adjusted start rather than the real one, because the surfaces
 * that total sleep measure the interval and ignore durationSeconds. Shifting the start keeps
 * the entry ending now — so the day view still draws the block up to the current time — while
 * the interval carries only unpaused time, and stops growing while a pause is open.
 */
export function buildOngoingSleepEntry({
  timer,
  babyId,
  isCurrentBaby,
  now,
  dayStartHour,
  dayEndHour,
}: OngoingSleepEntryInput): StoredSleepEntry | null {
  if (!timer?.isRunning || !babyId || !isCurrentBaby) return null;

  const openPauseMs = timer.pausedAt
    ? Math.max(0, now.getTime() - timer.pausedAt.getTime())
    : 0;
  const pausedMs = timer.totalPausedMs + openPauseMs;
  const effectiveStart = new Date(
    Math.min(timer.startTime.getTime() + pausedMs, now.getTime())
  );

  return {
    id: `ongoing-${babyId}`,
    babyId,
    type: classifySleepByTimeRange(effectiveStart, now, dayStartHour, dayEndHour),
    startedAt: effectiveStart.toISOString(),
    endedAt: now.toISOString(),
    durationSeconds: Math.floor((now.getTime() - effectiveStart.getTime()) / 1000),
    createdAt: timer.startTime.toISOString(),
    updatedAt: now.toISOString(),
  };
}
