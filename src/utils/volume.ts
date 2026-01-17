/**
 * Volume conversion utilities for baby tracker
 * Handles conversions between milliliters and fluid ounces
 */

const ML_PER_OZ = 29.5735;

/**
 * Converts milliliters to fluid ounces
 * @param ml Volume in milliliters
 * @param decimalPlaces Number of decimal places (default 1)
 */
export function mlToOz(ml: number, decimalPlaces: number = 1): number {
  if (ml < 0) return 0;
  const oz = ml / ML_PER_OZ;
  return Number(oz.toFixed(decimalPlaces));
}

/**
 * Converts fluid ounces to milliliters
 * @param oz Volume in fluid ounces
 * @param decimalPlaces Number of decimal places (default 0)
 */
export function ozToMl(oz: number, decimalPlaces: number = 0): number {
  if (oz < 0) return 0;
  const ml = oz * ML_PER_OZ;
  return Number(ml.toFixed(decimalPlaces));
}

/**
 * Formats volume for display with appropriate unit
 * @param ml Volume in milliliters
 * @param preferredUnit User's preferred unit
 */
export function formatVolume(ml: number, preferredUnit: "ml" | "oz" = "oz"): string {
  if (preferredUnit === "oz") {
    const oz = mlToOz(ml);
    return `${oz} oz`;
  }
  return `${Math.round(ml)} ml`;
}

/**
 * Validates that a volume value is reasonable for baby feeding
 * @param ml Volume in milliliters
 * @returns true if volume is within reasonable range (0-500ml per feeding)
 */
export function isValidFeedingVolume(ml: number): boolean {
  return ml >= 0 && ml <= 500;
}

/**
 * Parses a volume string input, handling both ml and oz
 * @param input User input string
 * @param unit The unit of the input
 * @returns Volume in milliliters, or null if invalid
 */
export function parseVolume(input: string, unit: "ml" | "oz"): number | null {
  const value = parseFloat(input);
  if (isNaN(value) || value < 0) return null;

  if (unit === "oz") {
    return ozToMl(value);
  }
  return value;
}
