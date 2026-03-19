import type { BreastSide } from "@constants/activities";

export interface PumpingEntry {
  id?: string;
  babyId: string;
  side?: BreastSide;
  startedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  volumeMl?: number;
  notes?: string;
}

export interface PumpingValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validatePumpingSide(side: string): side is BreastSide {
  return ["left", "right", "both"].includes(side);
}

export function validatePumpingVolume(volumeMl: number | undefined): string | null {
  if (volumeMl === undefined) {
    return null;
  }
  if (volumeMl <= 0) {
    return "validation.volumePositive";
  }
  if (volumeMl > 500) {
    return "validation.volumeTooLarge500ml";
  }
  return null;
}

export function validatePumpingDuration(durationSeconds: number | undefined): string | null {
  if (durationSeconds === undefined) {
    return null;
  }
  if (durationSeconds < 0) {
    return "validation.durationNegative";
  }
  if (durationSeconds > 3600) {
    return "validation.durationTooLong1h";
  }
  return null;
}

const FUTURE_TIME_TOLERANCE_MS = 10000;

export function validateStartTimeNotInFuture(startedAt: Date): string | null {
  const now = Date.now();
  if (startedAt.getTime() > now + FUTURE_TIME_TOLERANCE_MS) {
    return "validation.startTimeNotInFuture";
  }
  return null;
}

export function validateStartTime(startedAt: Date | undefined): string | null {
  if (!startedAt) {
    return "validation.startTimeRequired";
  }
  return null;
}

export function validateEndTime(startedAt: Date, endedAt: Date | undefined): string | null {
  if (!endedAt) {
    return null;
  }
  if (endedAt.getTime() < startedAt.getTime()) {
    return "validation.endTimeBeforeStart";
  }
  return null;
}

export function validatePumping(entry: Partial<PumpingEntry>): PumpingValidationResult {
  const errors: Record<string, string> = {};

  const startError = validateStartTime(entry.startedAt);
  if (startError) errors.startedAt = startError;

  if (!entry.side) {
    errors.side = "validation.sideRequired";
  } else if (!validatePumpingSide(entry.side)) {
    errors.side = "validation.invalidSide";
  }

  if (entry.startedAt && entry.endedAt) {
    const endError = validateEndTime(entry.startedAt, entry.endedAt);
    if (endError) errors.endedAt = endError;
  }

  const durationError = validatePumpingDuration(entry.durationSeconds);
  if (durationError) errors.durationSeconds = durationError;

  const volumeError = validatePumpingVolume(entry.volumeMl);
  if (volumeError) errors.volumeMl = volumeError;

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateManualPumpingDuration(durationSeconds: number | undefined): string | null {
  if (durationSeconds === undefined) {
    return "validation.durationRequired";
  }
  if (durationSeconds < 60) {
    return "validation.durationMinimum1m";
  }
  if (durationSeconds > 3600) {
    return "validation.durationTooLong1h";
  }
  return null;
}

export function validateManualPumpingVolume(volumeMl: number | undefined): string | null {
  if (volumeMl === undefined) {
    return "validation.volumeRequired";
  }
  if (volumeMl <= 0) {
    return "validation.volumePositive";
  }
  if (volumeMl > 500) {
    return "validation.volumeTooLarge500ml";
  }
  return null;
}

export function validateManualPumping(entry: Partial<PumpingEntry>): PumpingValidationResult {
  const errors: Record<string, string> = {};

  const startError = validateStartTime(entry.startedAt);
  if (startError) {
    errors.startedAt = startError;
  } else if (entry.startedAt) {
    const futureError = validateStartTimeNotInFuture(entry.startedAt);
    if (futureError) errors.startedAt = futureError;
  }

  if (!entry.side) {
    errors.side = "validation.sideRequired";
  } else if (!validatePumpingSide(entry.side)) {
    errors.side = "validation.invalidSide";
  }

  const durationError = validateManualPumpingDuration(entry.durationSeconds);
  if (durationError) errors.durationSeconds = durationError;

  const volumeError = validateManualPumpingVolume(entry.volumeMl);
  if (volumeError) errors.volumeMl = volumeError;

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
