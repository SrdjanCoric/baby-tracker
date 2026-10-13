const TIMER_START_EDIT_HORIZON_MS = 12 * 60 * 60 * 1000;

export interface TimerStartBounds {
  minimumDate: Date;
  maximumDate: Date;
}

interface EndedActivity {
  endedAt?: string | Date | null;
}

export function getTimerStartBounds(
  activities: ReadonlyArray<EndedActivity>,
  now: Date = new Date(),
  upperBound?: Date
): TimerStartBounds {
  const nowTime = now.getTime();
  const upperBoundTime = upperBound?.getTime();
  const maximumDate = new Date(
    upperBoundTime !== undefined && Number.isFinite(upperBoundTime)
      ? Math.min(nowTime, upperBoundTime)
      : nowTime
  );
  let minimumTime = nowTime - TIMER_START_EDIT_HORIZON_MS;

  for (const activity of activities) {
    if (!activity.endedAt) continue;
    const endedTime = new Date(activity.endedAt).getTime();
    if (
      Number.isFinite(endedTime) &&
      endedTime <= maximumDate.getTime() &&
      endedTime > minimumTime
    ) {
      minimumTime = endedTime;
    }
  }

  return {
    minimumDate: new Date(minimumTime),
    maximumDate,
  };
}

export function normalizeTimerStartSelection(
  selectedTime: Date,
  bounds: TimerStartBounds
): Date {
  const normalized = new Date(selectedTime);

  if (normalized < bounds.minimumDate) {
    return new Date(bounds.minimumDate);
  }
  if (normalized > bounds.maximumDate) {
    return new Date(bounds.maximumDate);
  }
  return normalized;
}

export function getPausedTimerStartUpperBound(
  timer?: {
    startTime: Date;
    isPaused: boolean;
    pausedAt?: Date;
    totalPausedMs: number;
  } | null
): Date | undefined {
  // A cumulative total cannot tell which completed pauses a later start would cut off.
  if (timer && timer.totalPausedMs > 0) return timer.startTime;
  return timer?.isPaused ? timer.pausedAt : undefined;
}
