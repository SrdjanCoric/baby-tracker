import type { BreastSide, FeedingType, BottleContentType } from "@constants/activities";

export interface FeedingEntry {
  id?: string;
  babyId: string;
  type: FeedingType;
  side?: BreastSide;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
  amountMl?: number;
  contentType?: BottleContentType;
  foodType?: string;
  notes?: string;
}

export interface FeedingValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateFeedingType(type: string): type is FeedingType {
  return ["breast", "bottle", "solid"].includes(type);
}

export function validateBreastSide(side: string): side is BreastSide {
  return ["left", "right", "both"].includes(side);
}

export function validateStartTime(startedAt: Date | undefined): string | null {
  if (!startedAt) {
    return "Start time is required";
  }
  return null;
}

export function validateEndTime(startedAt: Date, endedAt: Date | undefined): string | null {
  if (!endedAt) {
    return null;
  }
  if (endedAt.getTime() < startedAt.getTime()) {
    return "End time cannot be before start time";
  }
  return null;
}

export function validateFeedingDuration(durationSeconds: number | undefined): string | null {
  if (durationSeconds === undefined) {
    return null;
  }
  if (durationSeconds < 0) {
    return "Duration cannot be negative";
  }
  if (durationSeconds > 7200) {
    return "Duration seems too long (over 2 hours)";
  }
  return null;
}

export function validateBottleAmount(amountMl: number | undefined, type: FeedingType): string | null {
  if (type !== "bottle") {
    return null;
  }
  if (amountMl === undefined || amountMl <= 0) {
    return "Amount is required for bottle feeding";
  }
  if (amountMl > 500) {
    return "Amount seems too large (over 500ml)";
  }
  return null;
}

export function validateBottleContentType(contentType: BottleContentType | undefined, type: FeedingType): string | null {
  if (type !== "bottle") {
    return null;
  }
  if (!contentType) {
    return "Content type is required for bottle feeding";
  }
  if (!["formula", "breastMilk"].includes(contentType)) {
    return "Invalid content type";
  }
  return null;
}

export function validateBreastfeeding(entry: Partial<FeedingEntry>): FeedingValidationResult {
  const errors: Record<string, string> = {};

  if (entry.type !== "breast") {
    errors.type = "Invalid feeding type for breastfeeding";
  }

  const startError = validateStartTime(entry.startedAt);
  if (startError) errors.startedAt = startError;

  if (entry.startedAt && entry.endedAt) {
    const endError = validateEndTime(entry.startedAt, entry.endedAt);
    if (endError) errors.endedAt = endError;
  }

  const durationError = validateFeedingDuration(entry.durationSeconds);
  if (durationError) errors.durationSeconds = durationError;

  if (entry.side && !validateBreastSide(entry.side)) {
    errors.side = "Invalid breast side";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateBottleFeeding(entry: Partial<FeedingEntry>): FeedingValidationResult {
  const errors: Record<string, string> = {};

  if (entry.type !== "bottle") {
    errors.type = "Invalid feeding type for bottle feeding";
  }

  const startError = validateStartTime(entry.startedAt);
  if (startError) errors.startedAt = startError;

  const amountError = validateBottleAmount(entry.amountMl, "bottle");
  if (amountError) errors.amountMl = amountError;

  const contentTypeError = validateBottleContentType(entry.contentType, "bottle");
  if (contentTypeError) errors.contentType = contentTypeError;

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function calculateFeedingDuration(startedAt: Date, endedAt: Date): number {
  const diffMs = endedAt.getTime() - startedAt.getTime();
  return Math.max(0, Math.floor(diffMs / 1000));
}

const FUTURE_TIME_TOLERANCE_MS = 10000;

export function validateStartTimeNotInFuture(startedAt: Date): string | null {
  const now = Date.now();
  if (startedAt.getTime() > now + FUTURE_TIME_TOLERANCE_MS) {
    return "Start time cannot be in the future";
  }
  return null;
}

export function validateManualFeedingDuration(durationSeconds: number | undefined): string | null {
  if (durationSeconds === undefined) {
    return "Duration is required for manual entry";
  }
  if (durationSeconds < 60) {
    return "Duration must be at least 1 minute";
  }
  if (durationSeconds > 7200) {
    return "Duration seems too long (over 2 hours)";
  }
  return null;
}

export function validateManualBreastfeeding(entry: Partial<FeedingEntry>): FeedingValidationResult {
  const errors: Record<string, string> = {};

  if (entry.type !== "breast") {
    errors.type = "Invalid feeding type for breastfeeding";
  }

  const startError = validateStartTime(entry.startedAt);
  if (startError) {
    errors.startedAt = startError;
  } else if (entry.startedAt) {
    const futureError = validateStartTimeNotInFuture(entry.startedAt);
    if (futureError) errors.startedAt = futureError;
  }

  const durationError = validateManualFeedingDuration(entry.durationSeconds);
  if (durationError) errors.durationSeconds = durationError;

  if (!entry.side) {
    errors.side = "Side is required for breastfeeding";
  } else if (!validateBreastSide(entry.side)) {
    errors.side = "Invalid breast side";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateManualBottleFeeding(entry: Partial<FeedingEntry>): FeedingValidationResult {
  const errors: Record<string, string> = {};

  if (entry.type !== "bottle") {
    errors.type = "Invalid feeding type for bottle feeding";
  }

  const startError = validateStartTime(entry.startedAt);
  if (startError) {
    errors.startedAt = startError;
  } else if (entry.startedAt) {
    const futureError = validateStartTimeNotInFuture(entry.startedAt);
    if (futureError) errors.startedAt = futureError;
  }

  const amountError = validateBottleAmount(entry.amountMl, "bottle");
  if (amountError) errors.amountMl = amountError;

  const contentTypeError = validateBottleContentType(entry.contentType, "bottle");
  if (contentTypeError) errors.contentType = contentTypeError;

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
