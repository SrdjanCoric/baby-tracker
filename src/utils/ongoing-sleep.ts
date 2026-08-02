import type { StoredSleepEntry } from "@/services/sleep-storage";
import { classifySleepByTimeRange } from "@/utils/sleep-patterns";

export interface OngoingSleepTimer {
  isRunning: boolean;
  startTime: Date;
  totalPausedMs: number;
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

  return {
    id: `ongoing-${babyId}`,
    babyId,
    type: classifySleepByTimeRange(timer.startTime, now, dayStartHour, dayEndHour),
    startedAt: timer.startTime.toISOString(),
    endedAt: now.toISOString(),
    durationSeconds: Math.floor(
      (now.getTime() - timer.startTime.getTime() - timer.totalPausedMs) / 1000
    ),
    createdAt: timer.startTime.toISOString(),
    updatedAt: now.toISOString(),
  };
}
