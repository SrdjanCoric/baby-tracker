import type { BreastSide, FeedingType, BottleContentType, SolidAmount, SolidReaction } from "@constants/activities";
import { SOLID_AMOUNTS, SOLID_REACTIONS } from "@constants/activities";

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
  amount?: SolidAmount;
  reaction?: SolidReaction;
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

export function validateFeedingDuration(durationSeconds: number | undefined): string | null {
  if (durationSeconds === undefined) {
    return null;
  }
  if (durationSeconds < 0) {
    return "validation.durationNegative";
  }
  if (durationSeconds > 7200) {
    return "validation.durationTooLong2h";
  }
  return null;
}

export function validateBottleAmount(amountMl: number | undefined, type: FeedingType): string | null {
  if (type !== "bottle") {
    return null;
  }
  if (amountMl === undefined || amountMl <= 0) {
    return "validation.amountRequiredBottle";
  }
  if (amountMl > 500) {
    return "validation.amountTooLarge500ml";
  }
  return null;
}

export function validateBottleContentType(contentType: BottleContentType | undefined, type: FeedingType): string | null {
  if (type !== "bottle") {
    return null;
  }
  if (!contentType) {
    return "validation.contentTypeRequired";
  }
  if (!["formula", "breastMilk"].includes(contentType)) {
    return "validation.invalidContentType";
  }
  return null;
}

export function validateBreastfeeding(entry: Partial<FeedingEntry>): FeedingValidationResult {
  const errors: Record<string, string> = {};

  if (entry.type !== "breast") {
    errors.type = "validation.invalidFeedingTypeBreast";
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
    errors.side = "validation.invalidBreastSide";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateBottleFeeding(entry: Partial<FeedingEntry>): FeedingValidationResult {
  const errors: Record<string, string> = {};

  if (entry.type !== "bottle") {
    errors.type = "validation.invalidFeedingTypeBottle";
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
    return "validation.startTimeNotInFuture";
  }
  return null;
}

export function validateManualFeedingDuration(durationSeconds: number | undefined): string | null {
  if (durationSeconds === undefined) {
    return "validation.durationRequired";
  }
  if (durationSeconds < 60) {
    return "validation.durationMinimum1m";
  }
  if (durationSeconds > 7200) {
    return "validation.durationTooLong2h";
  }
  return null;
}

export function validateManualBreastfeeding(entry: Partial<FeedingEntry>): FeedingValidationResult {
  const errors: Record<string, string> = {};

  if (entry.type !== "breast") {
    errors.type = "validation.invalidFeedingTypeBreast";
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
    errors.side = "validation.sideRequiredBreast";
  } else if (!validateBreastSide(entry.side)) {
    errors.side = "validation.invalidBreastSide";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateManualBottleFeeding(entry: Partial<FeedingEntry>): FeedingValidationResult {
  const errors: Record<string, string> = {};

  if (entry.type !== "bottle") {
    errors.type = "validation.invalidFeedingTypeBottle";
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

export function validateFoodType(foodType: string | undefined): string | null {
  if (!foodType || foodType.trim() === "") {
    return "validation.foodTypeRequired";
  }
  if (foodType.length > 100) {
    return "validation.foodTypeTooLong";
  }
  return null;
}

export function validateSolidAmount(amount: SolidAmount | undefined): string | null {
  if (amount === undefined) {
    return null;
  }
  if (!SOLID_AMOUNTS.includes(amount)) {
    return "validation.invalidAmount";
  }
  return null;
}

export function validateSolidReaction(reaction: SolidReaction | undefined): string | null {
  if (reaction === undefined) {
    return null;
  }
  if (!SOLID_REACTIONS.includes(reaction)) {
    return "validation.invalidReaction";
  }
  return null;
}

export function validateSolidFeeding(entry: Partial<FeedingEntry>): FeedingValidationResult {
  const errors: Record<string, string> = {};

  if (entry.type !== "solid") {
    errors.type = "validation.invalidFeedingTypeSolid";
  }

  const startError = validateStartTime(entry.startedAt);
  if (startError) {
    errors.startedAt = startError;
  } else if (entry.startedAt) {
    const futureError = validateStartTimeNotInFuture(entry.startedAt);
    if (futureError) errors.startedAt = futureError;
  }

  const foodTypeError = validateFoodType(entry.foodType);
  if (foodTypeError) errors.foodType = foodTypeError;

  if (entry.amount !== undefined) {
    const amountError = validateSolidAmount(entry.amount);
    if (amountError) errors.amount = amountError;
  }

  if (entry.reaction !== undefined) {
    const reactionError = validateSolidReaction(entry.reaction);
    if (reactionError) errors.reaction = reactionError;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
