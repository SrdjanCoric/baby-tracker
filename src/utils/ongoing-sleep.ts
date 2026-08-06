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
 * Represents a running sleep timer as the interval that stopping it now would record. A paused
 * timer ends at its pause instant; otherwise it ends now. Shared by the Statistics sleep screens
 * and the Timeline daily summary so their blocks and totals report the same interval.
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

  const endedAt = timer.isPaused && timer.pausedAt ? timer.pausedAt : now;
  const durationSeconds = Math.max(
    0,
    Math.floor((endedAt.getTime() - timer.startTime.getTime()) / 1000)
  );

  return {
    id: `ongoing-${babyId}`,
    babyId,
    type: classifySleepByTimeRange(timer.startTime, endedAt, dayStartHour, dayEndHour),
    startedAt: timer.startTime.toISOString(),
    endedAt: endedAt.toISOString(),
    durationSeconds,
    createdAt: timer.startTime.toISOString(),
    updatedAt: now.toISOString(),
  };
}
