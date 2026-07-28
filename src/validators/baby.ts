/**
 * Baby profile validation utilities
 */
import type { TFunction } from "i18next";

export type BabyGender = "male" | "female";

export interface BabyProfile {
  id?: string;
  name: string;
  birthDate?: Date;
  gender?: BabyGender;
  photoUri?: string;
}

export interface CompleteNewBabyProfile {
  name: string;
  birthDate: Date;
  gender: BabyGender;
  photoUri?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export type NewBabyValidationResult =
  | { isValid: false; errors: Record<string, string> }
  | { isValid: true; errors: Record<string, string>; data: CompleteNewBabyProfile };

/**
 * Validates a baby name
 */
export function validateBabyName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return "validation.nameRequired";
  }
  if (trimmed.length < 1) {
    return "validation.nameMinLength";
  }
  if (trimmed.length > 100) {
    return "validation.nameMaxLength";
  }
  return null;
}

/**
 * Validates a birth date
 */
export function validateBirthDate(date: Date | undefined, now: Date = new Date()): string | null {
  if (!date) {
    return null; // Birth date is optional
  }

  if (Number.isNaN(date.getTime())) {
    return "validation.birthDateInvalid";
  }

  // Check if date is in the future
  if (date.getTime() > now.getTime()) {
    return "validation.birthDateFuture";
  }

  // Check if date is unreasonably old (more than 5 years ago)
  const fiveYearsAgo = new Date(now);
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  if (date.getTime() < fiveYearsAgo.getTime()) {
    return "validation.birthDateTooFar";
  }

  return null;
}

/**
 * Validates a complete baby profile
 */
export function validateBabyProfile(profile: Partial<BabyProfile>, now: Date = new Date()): ValidationResult {
  const errors: Record<string, string> = {};

  const nameError = validateBabyName(profile.name || "");
  if (nameError) {
    errors.name = nameError;
  }

  const birthDateError = validateBirthDate(profile.birthDate, now);
  if (birthDateError) {
    errors.birthDate = birthDateError;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateNewBabyProfile(
  profile: Partial<BabyProfile>,
  now: Date = new Date()
): NewBabyValidationResult {
  const { errors } = validateBabyProfile(profile, now);

  if (!profile.birthDate) {
    errors.birthDate = "validation.birthDateRequired";
  }
  if (!profile.gender) {
    errors.gender = "validation.genderRequired";
  }

  if (Object.keys(errors).length > 0 || !profile.name || !profile.birthDate || !profile.gender) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors,
    data: {
      name: profile.name.trim(),
      birthDate: profile.birthDate,
      gender: profile.gender,
      photoUri: profile.photoUri,
    },
  };
}

/**
 * Calculates baby age from birth date
 * Returns age in appropriate units (days, weeks, months, years)
 */
export function calculateBabyAge(birthDate: Date, now: Date = new Date(), t?: TFunction): string {
  const diffMs = now.getTime() - birthDate.getTime();
  if (diffMs < 0) return t ? t("babyAge.notBornYet") : "Not born yet";

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Less than 14 days: show in days
  if (diffDays < 14) {
    if (!t) return diffDays === 1 ? "1 day old" : `${diffDays} days old`;
    return t("babyAge.daysOld", { count: diffDays });
  }

  // Less than 8 weeks: show in weeks
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 8) {
    if (!t) return diffWeeks === 1 ? "1 week old" : `${diffWeeks} weeks old`;
    return t("babyAge.weeksOld", { count: diffWeeks });
  }

  // Calendar-based month counting
  const diffMonths = (now.getFullYear() - birthDate.getFullYear()) * 12
    + (now.getMonth() - birthDate.getMonth())
    - (now.getDate() < birthDate.getDate() ? 1 : 0);
  if (diffMonths < 24) {
    if (!t) return diffMonths === 1 ? "1 month old" : `${diffMonths} months old`;
    return t("babyAge.monthsOld", { count: diffMonths });
  }

  // 2+ years: show in years and months
  const years = Math.floor(diffMonths / 12);
  const months = diffMonths % 12;
  if (months === 0) {
    if (!t) return years === 1 ? "1 year old" : `${years} years old`;
    return t("babyAge.yearsOld", { count: years });
  }
  if (!t) return `${years}y ${months}m old`;
  return t("babyAge.yearsMonthsOld", { years, months });
}

/**
 * Calculates baby age in weeks (useful for growth tracking)
 */
export function calculateBabyAgeInWeeks(birthDate: Date, now: Date = new Date()): number {
  const diffMs = now.getTime() - birthDate.getTime();
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
}

/**
 * Calculates baby age in days
 */
export function calculateBabyAgeInDays(birthDate: Date, now: Date = new Date()): number {
  const diffMs = now.getTime() - birthDate.getTime();
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
