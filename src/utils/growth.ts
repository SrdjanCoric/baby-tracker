/**
 * Growth measurement utilities for baby tracker
 * Handles conversions between metric and imperial units
 */

const KG_PER_LB = 0.453592;
const CM_PER_INCH = 2.54;

/**
 * Converts kilograms to pounds
 * @param kg Weight in kilograms
 * @param decimalPlaces Number of decimal places (default 1)
 */
export function kgToLbs(kg: number, decimalPlaces: number = 1): number {
  if (kg < 0) return 0;
  const lbs = kg / KG_PER_LB;
  return Number(lbs.toFixed(decimalPlaces));
}

/**
 * Converts pounds to kilograms
 * @param lbs Weight in pounds
 * @param decimalPlaces Number of decimal places (default 2)
 */
export function lbsToKg(lbs: number, decimalPlaces: number = 2): number {
  if (lbs < 0) return 0;
  const kg = lbs * KG_PER_LB;
  return Number(kg.toFixed(decimalPlaces));
}

/**
 * Converts centimeters to inches
 * @param cm Length in centimeters
 * @param decimalPlaces Number of decimal places (default 1)
 */
export function cmToInches(cm: number, decimalPlaces: number = 1): number {
  if (cm < 0) return 0;
  const inches = cm / CM_PER_INCH;
  return Number(inches.toFixed(decimalPlaces));
}

/**
 * Converts inches to centimeters
 * @param inches Length in inches
 * @param decimalPlaces Number of decimal places (default 1)
 */
export function inchesToCm(inches: number, decimalPlaces: number = 1): number {
  if (inches < 0) return 0;
  const cm = inches * CM_PER_INCH;
  return Number(cm.toFixed(decimalPlaces));
}

/**
 * Formats weight for display with appropriate unit
 * @param kg Weight in kilograms
 * @param preferredUnit User's preferred unit
 */
export function formatWeight(kg: number, preferredUnit: "kg" | "lbs" = "kg"): string {
  if (preferredUnit === "lbs") {
    const lbs = kgToLbs(kg, 0);
    return `${lbs} lbs`;
  }
  const formatted = Number(kg.toFixed(3));
  return `${formatted} kg`;
}

/**
 * Formats height for display with appropriate unit
 * @param cm Height in centimeters
 * @param preferredUnit User's preferred unit
 */
export function formatHeight(cm: number, preferredUnit: "cm" | "in" = "cm"): string {
  if (preferredUnit === "in") {
    const inches = cmToInches(cm);
    return `${inches} in`;
  }
  const formatted = Number(cm.toFixed(3));
  return `${formatted} cm`;
}

/**
 * Validates that a weight value is reasonable for a baby (0-3 years)
 * @param kg Weight in kilograms
 * @returns true if weight is within reasonable range (0.5-30 kg)
 */
export function isValidWeight(kg: number): boolean {
  return kg >= 0.5 && kg <= 30;
}

/**
 * Validates that a height value is reasonable for a baby (0-3 years)
 * @param cm Height in centimeters
 * @returns true if height is within reasonable range (20-150 cm)
 */
export function isValidHeight(cm: number): boolean {
  return cm >= 20 && cm <= 150;
}

/**
 * Validates that a head circumference value is reasonable for a baby
 * @param cm Head circumference in centimeters
 * @returns true if value is within reasonable range (20-60 cm)
 */
export function isValidHeadCircumference(cm: number): boolean {
  return cm >= 20 && cm <= 60;
}

/**
 * Parses a weight string input, handling both kg and lbs
 * @param input User input string
 * @param unit The unit of the input
 * @returns Weight in kilograms, or null if invalid
 */
export function parseWeight(input: string, unit: "kg" | "lbs"): number | null {
  const value = parseFloat(input);
  if (isNaN(value) || value < 0) return null;

  if (unit === "lbs") {
    return lbsToKg(value);
  }
  return value;
}

/**
 * Parses a height string input, handling both cm and inches
 * @param input User input string
 * @param unit The unit of the input
 * @returns Height in centimeters, or null if invalid
 */
export function parseHeight(input: string, unit: "cm" | "in"): number | null {
  const value = parseFloat(input);
  if (isNaN(value) || value < 0) return null;

  if (unit === "in") {
    return inchesToCm(value);
  }
  return value;
}
