/**
 * WHO Growth Chart Percentile Calculator
 *
 * Uses the LMS method (Lambda-Mu-Sigma) to calculate Z-scores and percentiles.
 * The LMS method smooths reference centiles and produces normalized Z-scores.
 *
 * Formula:
 * Z = ((X/M)^L - 1) / (L * S)  when L ≠ 0
 * Z = ln(X/M) / S              when L = 0
 *
 * Where:
 * X = measurement value
 * L = Box-Cox power (skewness)
 * M = Median
 * S = Coefficient of variation
 */

import { getWHOData } from "@/data/growth";
import type {
  Gender,
  GrowthMeasurementType,
  LMSParameters,
  PercentileResult,
} from "@/types/growth-chart";

/**
 * Standard normal cumulative distribution function (CDF)
 * Approximation using the error function
 */
function normalCDF(z: number): number {
  // Using the approximation with error function
  // P(Z <= z) = 0.5 * (1 + erf(z / sqrt(2)))
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * Error function approximation
 * Uses Horner's method for polynomial approximation
 */
function erf(x: number): number {
  // Constants for the approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  // Save the sign of x
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  // A&S formula 7.1.26
  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

/**
 * Inverse standard normal cumulative distribution function
 * (Quantile function / percent point function)
 *
 * Uses Acklam's algorithm for approximation
 */
function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  // Coefficients for rational approximation
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0,
    -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0,
    3.754408661907416e0,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number, r: number;

  if (p < pLow) {
    // Rational approximation for lower region
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  } else if (p <= pHigh) {
    // Rational approximation for central region
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  } else {
    // Rational approximation for upper region
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
      )
    );
  }
}

/**
 * Calculate Z-score using the LMS method
 *
 * @param measurement The actual measurement value (X)
 * @param L Box-Cox power parameter
 * @param M Median parameter
 * @param S Coefficient of variation parameter
 * @returns Z-score
 */
export function calculateZScore(
  measurement: number,
  L: number,
  M: number,
  S: number
): number | null {
  if (measurement <= 0 || M <= 0 || S <= 0) {
    return null;
  }

  if (Math.abs(L) < 0.0001) {
    // When L is approximately 0, use the logarithmic formula
    return Math.log(measurement / M) / S;
  }

  // Standard LMS formula
  return (Math.pow(measurement / M, L) - 1) / (L * S);
}

/**
 * Calculate percentile from Z-score using normal distribution
 *
 * @param zScore The Z-score
 * @returns Percentile (0-100)
 */
export function calculatePercentile(zScore: number): number {
  return normalCDF(zScore) * 100;
}

/**
 * Linearly interpolate between two LMS parameter sets
 *
 * @param lms1 LMS parameters at lower age
 * @param lms2 LMS parameters at upper age
 * @param ratio Interpolation ratio (0 = lms1, 1 = lms2)
 * @returns Interpolated LMS parameters
 */
export function interpolateLMS(
  lms1: LMSParameters,
  lms2: LMSParameters,
  ratio: number
): LMSParameters {
  return {
    L: lms1.L + (lms2.L - lms1.L) * ratio,
    M: lms1.M + (lms2.M - lms1.M) * ratio,
    S: lms1.S + (lms2.S - lms1.S) * ratio,
  };
}

/**
 * Get LMS parameters for a specific age, with interpolation if needed
 *
 * @param gender The baby's gender
 * @param ageMonths Age in months (can be decimal)
 * @param measurementType Type of measurement (weight, height, head)
 * @returns LMS parameters for the given age
 */
export function getLMSForAge(
  gender: Gender,
  ageMonths: number,
  measurementType: GrowthMeasurementType
): LMSParameters | null {
  if (ageMonths < 0 || ageMonths > 24) {
    return null;
  }

  const data = getWHOData(measurementType, gender);

  const clampedAge = ageMonths;

  // Find the surrounding data points
  const lowerIndex = Math.floor(clampedAge);
  const upperIndex = Math.min(lowerIndex + 1, data.length - 1);

  if (lowerIndex === upperIndex || lowerIndex >= data.length - 1) {
    // Exact match or at boundary
    const point = data[Math.min(lowerIndex, data.length - 1)];
    return { L: point.L, M: point.M, S: point.S };
  }

  // Interpolate between the two surrounding points
  const ratio = clampedAge - lowerIndex;
  const lowerPoint = data[lowerIndex];
  const upperPoint = data[upperIndex];

  return interpolateLMS(
    { L: lowerPoint.L, M: lowerPoint.M, S: lowerPoint.S },
    { L: upperPoint.L, M: upperPoint.M, S: upperPoint.S },
    ratio
  );
}

/**
 * Calculate percentile for a given measurement
 *
 * @param gender The baby's gender
 * @param ageMonths Age in months
 * @param measurement The measurement value
 * @param measurementType Type of measurement
 * @returns PercentileResult with percentile, Z-score, and metadata
 */
export function calculatePercentileFromMeasurement(
  gender: Gender,
  ageMonths: number,
  measurement: number,
  measurementType: GrowthMeasurementType
): PercentileResult | null {
  const lms = getLMSForAge(gender, ageMonths, measurementType);
  if (!lms) return null;

  const zScore = calculateZScore(measurement, lms.L, lms.M, lms.S);
  if (zScore === null) return null;

  const percentile = calculatePercentile(zScore);

  return {
    percentile,
    zScore,
    measurement,
    ageMonths,
    measurementType,
  };
}

/**
 * Get the measurement value for a given percentile (reverse calculation)
 *
 * @param gender The baby's gender
 * @param ageMonths Age in months
 * @param percentile The target percentile (0-100)
 * @param measurementType Type of measurement
 * @returns The measurement value at the given percentile
 */
export function getPercentileValue(
  gender: Gender,
  ageMonths: number,
  percentile: number,
  measurementType: GrowthMeasurementType
): number | null {
  const lms = getLMSForAge(gender, ageMonths, measurementType);
  if (!lms) return null;

  const zScore = normalQuantile(percentile / 100);

  if (Math.abs(lms.L) < 0.0001) {
    return lms.M * Math.exp(lms.S * zScore);
  }

  return lms.M * Math.pow(1 + lms.L * lms.S * zScore, 1 / lms.L);
}

/**
 * Generate percentile line data for chart rendering
 *
 * @param gender The baby's gender
 * @param measurementType Type of measurement
 * @param percentile The percentile line to generate
 * @param minAge Minimum age in months
 * @param maxAge Maximum age in months
 * @param stepMonths Step size in months (default 0.5 for smooth curves)
 * @returns Array of points for the percentile line
 */
export function generatePercentileLine(
  gender: Gender,
  measurementType: GrowthMeasurementType,
  percentile: number,
  minAge: number = 0,
  maxAge: number = 24,
  stepMonths: number = 0.5
): Array<{ ageMonths: number; value: number }> {
  const points: Array<{ ageMonths: number; value: number }> = [];

  for (let age = minAge; age <= maxAge; age += stepMonths) {
    const value = getPercentileValue(gender, age, percentile, measurementType);
    if (value !== null) {
      points.push({ ageMonths: age, value });
    }
  }

  return points;
}

/**
 * Calculate baby's age in months from birth date
 *
 * @param birthDate The baby's birth date
 * @param measurementDate The date of measurement (defaults to now)
 * @returns Age in months (decimal)
 */
export function calculateAgeInMonths(
  birthDate: Date,
  measurementDate: Date = new Date()
): number {
  const diffMs = measurementDate.getTime() - birthDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const ageMonths = diffDays / 30.4375; // Average days per month

  return Math.max(0, ageMonths);
}
