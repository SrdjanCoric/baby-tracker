import type { ActivityType } from "@/constants/activities";
import type { TimerActivityType } from "@/services/active-timer-service";

const PRODUCTION_MINIMUM_TIMER_DURATION_SECONDS = 60;

export function shouldDiscardTimerDuration(
  durationSeconds: number,
  configuredMinimum = process.env.EXPO_PUBLIC_E2E_TIMER_MINIMUM_SECONDS
): boolean {
  const minimumDuration = configuredMinimum === "0"
    ? 0
    : PRODUCTION_MINIMUM_TIMER_DURATION_SECONDS;
  return durationSeconds < minimumDuration;
}

export function calculateActiveDurationSeconds(
  startedAt: Date,
  endedAt: Date,
  pausedSeconds: number
): number {
  return Math.max(
    0,
    Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000) -
      Math.max(0, pausedSeconds)
  );
}

// Sleep counts a resumed pause; every other timer leaves it out.
export function excludesResumedPauses(
  activityType: TimerActivityType | ActivityType
): boolean {
  return activityType !== "sleep";
}

export function calculateTimerDuration(
  startedAt: Date,
  endedAt: Date,
  totalPausedMs: number,
  activityType: TimerActivityType | ActivityType
): { durationSeconds: number; pausedSeconds: number } {
  const wallMs = Math.max(0, endedAt.getTime() - startedAt.getTime());
  const pausedMs = excludesResumedPauses(activityType)
    ? Math.min(Math.max(0, totalPausedMs), wallMs)
    : 0;
  return {
    durationSeconds: calculateActiveDurationSeconds(
      startedAt,
      endedAt,
      Math.floor(pausedMs / 1000)
    ),
    pausedSeconds: Math.floor(pausedMs / 1000),
  };
}

export function calculateTimerDurationSeconds(
  startedAt: Date,
  endedAt: Date,
  totalPausedMs: number,
  activityType: TimerActivityType | ActivityType
): number {
  return calculateTimerDuration(startedAt, endedAt, totalPausedMs, activityType)
    .durationSeconds;
}

// The live readout always equals what stopping now would save for the same type.
export function calculateRunningTimerSeconds(
  timer: {
    startTime: Date;
    isPaused?: boolean;
    pausedAt?: Date;
    totalPausedMs?: number;
  },
  activityType: TimerActivityType | ActivityType,
  now = new Date()
): number {
  const end = timer.isPaused && timer.pausedAt ? timer.pausedAt : now;
  return calculateTimerDurationSeconds(
    timer.startTime,
    end,
    timer.totalPausedMs ?? 0,
    activityType
  );
}

export function getEditablePausedSeconds(
  entry?: {
    startedAt: string;
    endedAt?: string;
    durationSeconds?: number;
    pausedSeconds?: number;
  } | null
): number {
  if (!entry) return 0;
  const paused = entry.pausedSeconds ?? 0;
  // Older editors keep pause metadata while saving the full wall-clock duration.
  if (
    paused > 0 &&
    entry.endedAt &&
    entry.durationSeconds ===
      calculateActiveDurationSeconds(
        new Date(entry.startedAt),
        new Date(entry.endedAt),
        0
      )
  ) {
    return 0;
  }
  return paused;
}
