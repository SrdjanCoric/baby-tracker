import type { DiaperType, StoolColor } from "@constants/activities";
import { STOOL_COLORS } from "@constants/activities";

export interface DiaperEntry {
  id?: string;
  babyId: string;
  type: DiaperType;
  stoolColor?: StoolColor;
  changedAt: Date;
  notes?: string;
}

export interface DiaperValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateDiaperType(type: string): type is DiaperType {
  return ["wet", "dirty", "mixed"].includes(type);
}

export function validateStoolColor(color: StoolColor | undefined): string | null {
  if (color === undefined) {
    return null;
  }
  if (!STOOL_COLORS.includes(color)) {
    return "Invalid stool color";
  }
  return null;
}

const FUTURE_TIME_TOLERANCE_MS = 10000;

export function validateChangeTimeNotInFuture(changedAt: Date): string | null {
  const now = Date.now();
  if (changedAt.getTime() > now + FUTURE_TIME_TOLERANCE_MS) {
    return "Change time cannot be in the future";
  }
  return null;
}

function validateStoolColorForType(
  type: DiaperType | undefined,
  stoolColor: StoolColor | undefined
): string | null {
  if (stoolColor === undefined) {
    return null;
  }

  if (type === "wet") {
    return "Stool color is only applicable for dirty or mixed diapers";
  }

  return validateStoolColor(stoolColor);
}

export function validateDiaperEntry(entry: Partial<DiaperEntry>): DiaperValidationResult {
  const errors: Record<string, string> = {};

  if (!entry.type) {
    errors.type = "Diaper type is required";
  } else if (!validateDiaperType(entry.type)) {
    errors.type = "Invalid diaper type";
  }

  const stoolColorError = validateStoolColorForType(entry.type, entry.stoolColor);
  if (stoolColorError) {
    errors.stoolColor = stoolColorError;
  }

  if (!entry.changedAt) {
    errors.changedAt = "Change time is required";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateManualDiaper(entry: Partial<DiaperEntry>): DiaperValidationResult {
  const errors: Record<string, string> = {};

  if (!entry.type) {
    errors.type = "Diaper type is required";
  } else if (!validateDiaperType(entry.type)) {
    errors.type = "Invalid diaper type";
  }

  const stoolColorError = validateStoolColorForType(entry.type, entry.stoolColor);
  if (stoolColorError) {
    errors.stoolColor = stoolColorError;
  }

  if (!entry.changedAt) {
    errors.changedAt = "Change time is required";
  } else {
    const futureError = validateChangeTimeNotInFuture(entry.changedAt);
    if (futureError) {
      errors.changedAt = futureError;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
