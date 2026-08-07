export interface TummyTimeEntry {
  id?: string;
  babyId: string;
  startedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  notes?: string;
}

export interface TummyTimeValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

const FUTURE_TIME_TOLERANCE_MS = 10000;
const MAX_DURATION_SECONDS = 7200;

export function validateTummyTimeStartTime(startedAt: Date | undefined): string | null {
  if (!startedAt) {
    return "validation.startTimeRequired";
  }
  return null;
}

export function validateTummyTimeEndTime(
  startedAt: Date,
  endedAt: Date | undefined
): string | null {
  if (!endedAt) {
    return null;
  }
  if (endedAt.getTime() < startedAt.getTime()) {
    return "validation.endTimeBeforeStart";
  }
  return null;
}

export function validateTummyTimeDuration(durationSeconds: number | undefined): string | null {
  if (durationSeconds === undefined) {
    return null;
  }
  if (durationSeconds < 0) {
    return "validation.durationNegative";
  }
  if (durationSeconds > MAX_DURATION_SECONDS) {
    return "validation.durationTooLong2h";
  }
  return null;
}

export function validateTummyTimeStartTimeNotInFuture(startedAt: Date): string | null {
  const now = Date.now();
  if (startedAt.getTime() > now + FUTURE_TIME_TOLERANCE_MS) {
    return "validation.startTimeNotInFuture";
  }
  return null;
}

export function validateManualTummyTimeDuration(
  durationSeconds: number | undefined
): string | null {
  if (durationSeconds === undefined) {
    return "validation.durationRequired";
  }
  if (durationSeconds < 60) {
    return "validation.durationMinimum1m";
  }
  if (durationSeconds > MAX_DURATION_SECONDS) {
    return "validation.durationTooLong2h";
  }
  return null;
}

export function calculateTummyTimeDuration(startedAt: Date, endedAt: Date): number {
  const diffMs = endedAt.getTime() - startedAt.getTime();
  return Math.max(0, Math.floor(diffMs / 1000));
}

export function validateDailyGoal(goalSeconds: number): string | null {
  if (goalSeconds < 60) {
    return "validation.dailyGoalMinimum";
  }
  if (goalSeconds > MAX_DURATION_SECONDS) {
    return "validation.dailyGoalMaximum";
  }
  return null;
}

export function calculateDailyProgress(currentSeconds: number, goalSeconds: number): number {
  if (goalSeconds <= 0) {
    return 100;
  }
  const percentage = (currentSeconds / goalSeconds) * 100;
  return Math.min(100, Math.round(percentage));
}

export function calculateTodaysTotalSeconds(entries: TummyTimeEntry[]): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return entries
    .filter(entry => {
      if (!entry.startedAt) return false;
      const entryDate = new Date(entry.startedAt);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate.getTime() === today.getTime();
    })
    .reduce((total, entry) => total + (entry.durationSeconds ?? 0), 0);
}

export function validateTummyTime(
  entry: Partial<TummyTimeEntry>
): TummyTimeValidationResult {
  const errors: Record<string, string> = {};

  const startError = validateTummyTimeStartTime(entry.startedAt);
  if (startError) errors.startedAt = startError;

  if (entry.startedAt && entry.endedAt) {
    const endError = validateTummyTimeEndTime(entry.startedAt, entry.endedAt);
    if (endError) errors.endedAt = endError;
  }

  const durationError = validateTummyTimeDuration(entry.durationSeconds);
  if (durationError) errors.durationSeconds = durationError;

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateManualTummyTime(
  entry: Partial<TummyTimeEntry>
): TummyTimeValidationResult {
  const errors: Record<string, string> = {};

  const startError = validateTummyTimeStartTime(entry.startedAt);
  if (startError) {
    errors.startedAt = startError;
  } else if (entry.startedAt) {
    const futureError = validateTummyTimeStartTimeNotInFuture(entry.startedAt);
    if (futureError) errors.startedAt = futureError;
  }

  const durationError = validateManualTummyTimeDuration(entry.durationSeconds);
  if (durationError) errors.durationSeconds = durationError;

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateManualTummyTimeTimes(
  entry: Partial<TummyTimeEntry>
): TummyTimeValidationResult {
  const durationSeconds =
    entry.startedAt && entry.endedAt
      ? calculateTummyTimeDuration(entry.startedAt, entry.endedAt)
      : undefined;

  const result = validateManualTummyTime({
    ...entry,
    durationSeconds,
  });

  if (
    entry.endedAt &&
    validateTummyTimeStartTimeNotInFuture(entry.endedAt) !== null
  ) {
    result.errors.endedAt = "validation.endTimeNotInFuture";
    result.isValid = false;
  }

  return result;
}
