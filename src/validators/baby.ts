/**
 * Baby profile validation utilities
 */

export interface BabyProfile {
  id?: string;
  name: string;
  birthDate?: Date;
  gender?: "male" | "female" | "other";
  photoUri?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Validates a baby name
 */
export function validateBabyName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return "Name is required";
  }
  if (trimmed.length < 1) {
    return "Name must be at least 1 character";
  }
  if (trimmed.length > 100) {
    return "Name must be less than 100 characters";
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

  // Check if date is in the future
  if (date.getTime() > now.getTime()) {
    return "Birth date cannot be in the future";
  }

  // Check if date is unreasonably old (more than 5 years ago)
  const fiveYearsAgo = new Date(now);
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  if (date.getTime() < fiveYearsAgo.getTime()) {
    return "Birth date seems too far in the past";
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

/**
 * Calculates baby age from birth date
 * Returns age in appropriate units (days, weeks, months, years)
 */
export function calculateBabyAge(birthDate: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - birthDate.getTime();
  if (diffMs < 0) return "Not born yet";

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Less than 14 days: show in days
  if (diffDays < 14) {
    return diffDays === 1 ? "1 day old" : `${diffDays} days old`;
  }

  // Less than 8 weeks: show in weeks
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 8) {
    return diffWeeks === 1 ? "1 week old" : `${diffWeeks} weeks old`;
  }

  // Less than 24 months: show in months
  const diffMonths = Math.floor(diffDays / 30.44); // Average days per month
  if (diffMonths < 24) {
    return diffMonths === 1 ? "1 month old" : `${diffMonths} months old`;
  }

  // 2+ years: show in years and months
  const years = Math.floor(diffMonths / 12);
  const months = diffMonths % 12;
  if (months === 0) {
    return years === 1 ? "1 year old" : `${years} years old`;
  }
  return `${years}y ${months}m old`;
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
