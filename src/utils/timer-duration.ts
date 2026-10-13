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
