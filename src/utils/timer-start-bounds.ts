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
  now: Date = new Date()
): TimerStartBounds {
  const maximumDate = new Date(now);
  let minimumTime = maximumDate.getTime() - TIMER_START_EDIT_HORIZON_MS;

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
  bounds: TimerStartBounds,
  now: Date = new Date(),
  platform: "android" | "ios" | string
): Date {
  let normalized = new Date(selectedTime);

  if (platform === "android") {
    normalized = new Date(now);
    normalized.setHours(
      selectedTime.getHours(),
      selectedTime.getMinutes(),
      selectedTime.getSeconds(),
      0
    );
    if (normalized > bounds.maximumDate) {
      normalized.setDate(normalized.getDate() - 1);
    }
  }

  if (normalized < bounds.minimumDate) {
    return new Date(bounds.minimumDate);
  }
  if (normalized > bounds.maximumDate) {
    return new Date(bounds.maximumDate);
  }
  return normalized;
}
