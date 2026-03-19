export interface GrowthEntry {
  id?: string;
  babyId: string;
  measuredAt?: Date;
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  notes?: string;
}

export interface GrowthValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

const FUTURE_TIME_TOLERANCE_MS = 10000;

export function validateWeightKg(weight: number | undefined): string | null {
  if (weight === undefined) {
    return null;
  }
  if (weight <= 0) {
    return "validation.weightPositive";
  }
  if (weight < 0.5) {
    return "validation.weightTooLow";
  }
  if (weight > 30) {
    return "validation.weightTooHigh";
  }
  return null;
}

export function validateHeightCm(height: number | undefined): string | null {
  if (height === undefined) {
    return null;
  }
  if (height <= 0) {
    return "validation.heightPositive";
  }
  if (height < 20) {
    return "validation.heightTooLow";
  }
  if (height > 150) {
    return "validation.heightTooHigh";
  }
  return null;
}

export function validateHeadCircumferenceCm(circumference: number | undefined): string | null {
  if (circumference === undefined) {
    return null;
  }
  if (circumference <= 0) {
    return "validation.headCircumferencePositive";
  }
  if (circumference < 20) {
    return "validation.headCircumferenceTooLow";
  }
  if (circumference > 60) {
    return "validation.headCircumferenceTooHigh";
  }
  return null;
}

export function validateMeasurementDate(date: Date | undefined): string | null {
  if (!date) {
    return "validation.measurementDateRequired";
  }
  return null;
}

export function validateMeasurementDateNotInFuture(date: Date): string | null {
  const now = Date.now();
  if (date.getTime() > now + FUTURE_TIME_TOLERANCE_MS) {
    return "validation.measurementDateNotInFuture";
  }
  return null;
}

export function validateAtLeastOneMeasurement(
  weight: number | undefined,
  height: number | undefined,
  headCircumference: number | undefined
): string | null {
  if (weight === undefined && height === undefined && headCircumference === undefined) {
    return "validation.atLeastOneMeasurement";
  }
  return null;
}

export function validateGrowthMeasurement(entry: Partial<GrowthEntry>): GrowthValidationResult {
  const errors: Record<string, string> = {};

  const dateError = validateMeasurementDate(entry.measuredAt);
  if (dateError) {
    errors.measuredAt = dateError;
  } else if (entry.measuredAt) {
    const futureError = validateMeasurementDateNotInFuture(entry.measuredAt);
    if (futureError) errors.measuredAt = futureError;
  }

  const atLeastOneError = validateAtLeastOneMeasurement(
    entry.weightKg,
    entry.heightCm,
    entry.headCircumferenceCm
  );
  if (atLeastOneError) {
    errors.measurements = atLeastOneError;
  }

  const weightError = validateWeightKg(entry.weightKg);
  if (weightError) errors.weightKg = weightError;

  const heightError = validateHeightCm(entry.heightCm);
  if (heightError) errors.heightCm = heightError;

  const headError = validateHeadCircumferenceCm(entry.headCircumferenceCm);
  if (headError) errors.headCircumferenceCm = headError;

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
