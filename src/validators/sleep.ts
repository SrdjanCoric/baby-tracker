import type { SleepType } from "@constants/activities";
import { determineSleepTypeFromBoundary } from "@/utils/day-night-boundary";

export interface SleepEntry {
  id?: string;
  babyId: string;
  type: SleepType;
  startedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  notes?: string;
}

export interface SleepValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateSleepType(type: string): type is SleepType {
  return ["nap", "night"].includes(type);
}

export function validateSleepStartTime(startedAt: Date | undefined): string | null {
  if (!startedAt) {
    return "validation.startTimeRequired";
  }
  return null;
}

export function validateSleepEndTime(startedAt: Date, endedAt: Date | undefined): string | null {
  if (!endedAt) {
    return null;
  }
  if (endedAt.getTime() < startedAt.getTime()) {
    return "validation.endTimeBeforeStart";
  }
  return null;
}

export function validateSleepDuration(durationSeconds: number | undefined): string | null {
  if (durationSeconds === undefined) {
    return null;
  }
  if (durationSeconds < 0) {
    return "validation.durationNegative";
  }
  if (durationSeconds > 86400) {
    return "validation.durationTooLong24h";
  }
  return null;
}

const FUTURE_TIME_TOLERANCE_MS = 10000;

export function validateSleepStartTimeNotInFuture(startedAt: Date): string | null {
  const now = Date.now();
  if (startedAt.getTime() > now + FUTURE_TIME_TOLERANCE_MS) {
    return "validation.startTimeNotInFuture";
  }
  return null;
}

export function validateManualSleepDuration(durationSeconds: number | undefined): string | null {
  if (durationSeconds === undefined) {
    return "validation.durationRequired";
  }
  if (durationSeconds < 60) {
    return "validation.durationMinimum1m";
  }
  if (durationSeconds > 86400) {
    return "validation.durationTooLong24h";
  }
  return null;
}

export function calculateSleepDuration(startedAt: Date, endedAt: Date): number {
  const diffMs = endedAt.getTime() - startedAt.getTime();
  return Math.max(0, Math.floor(diffMs / 1000));
}

export function determineSleepType(
  startedAt: Date,
  dayStartHour?: number,
  dayEndHour?: number
): SleepType {
  return determineSleepTypeFromBoundary(startedAt, dayStartHour, dayEndHour);
}

export function validateSleep(entry: Partial<SleepEntry>): SleepValidationResult {
  const errors: Record<string, string> = {};

  if (entry.type && !validateSleepType(entry.type)) {
    errors.type = "validation.invalidSleepType";
  }

  const startError = validateSleepStartTime(entry.startedAt);
  if (startError) errors.startedAt = startError;

  if (entry.startedAt && entry.endedAt) {
    const endError = validateSleepEndTime(entry.startedAt, entry.endedAt);
    if (endError) errors.endedAt = endError;
  }

  const durationError = validateSleepDuration(entry.durationSeconds);
  if (durationError) errors.durationSeconds = durationError;

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateManualSleep(entry: Partial<SleepEntry>): SleepValidationResult {
  const errors: Record<string, string> = {};

  if (entry.type && !validateSleepType(entry.type)) {
    errors.type = "validation.invalidSleepType";
  }

  const startError = validateSleepStartTime(entry.startedAt);
  if (startError) {
    errors.startedAt = startError;
  } else if (entry.startedAt) {
    const futureError = validateSleepStartTimeNotInFuture(entry.startedAt);
    if (futureError) errors.startedAt = futureError;
  }

  const durationError = validateManualSleepDuration(entry.durationSeconds);
  if (durationError) errors.durationSeconds = durationError;

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateManualSleepTimes(
  entry: Partial<SleepEntry>
): SleepValidationResult {
  const durationSeconds =
    entry.startedAt && entry.endedAt
      ? Math.floor((entry.endedAt.getTime() - entry.startedAt.getTime()) / 1000)
      : undefined;

  const result = validateManualSleep({
    ...entry,
    durationSeconds,
  });

  if (
    entry.endedAt &&
    validateSleepStartTimeNotInFuture(entry.endedAt) !== null
  ) {
    result.errors.endedAt = "validation.endTimeNotInFuture";
    result.isValid = false;
  }

  return result;
}
