/**
 * WHO Growth Standards LMS data for 0-24 months
 * Source: World Health Organization Child Growth Standards
 * https://www.who.int/tools/child-growth-standards
 *
 * LMS Parameters:
 * L = Power in the Box-Cox transformation
 * M = Median
 * S = Coefficient of variation
 */

import type { WHODataPoint } from "@/types/growth-chart";

/**
 * Weight-for-age LMS data for boys (0-24 months)
 * Weight in kg
 */
export const WEIGHT_BOYS: WHODataPoint[] = [
  { ageMonths: 0, L: 0.3487, M: 3.3464, S: 0.14602 },
  { ageMonths: 1, L: 0.2297, M: 4.4709, S: 0.13395 },
  { ageMonths: 2, L: 0.197, M: 5.5675, S: 0.12385 },
  { ageMonths: 3, L: 0.1738, M: 6.3762, S: 0.11727 },
  { ageMonths: 4, L: 0.1553, M: 7.0023, S: 0.11316 },
  { ageMonths: 5, L: 0.1395, M: 7.5105, S: 0.1108 },
  { ageMonths: 6, L: 0.1257, M: 7.934, S: 0.10958 },
  { ageMonths: 7, L: 0.1134, M: 8.297, S: 0.10902 },
  { ageMonths: 8, L: 0.1021, M: 8.6151, S: 0.10882 },
  { ageMonths: 9, L: 0.0917, M: 8.9014, S: 0.10881 },
  { ageMonths: 10, L: 0.082, M: 9.1649, S: 0.10891 },
  { ageMonths: 11, L: 0.073, M: 9.4122, S: 0.10906 },
  { ageMonths: 12, L: 0.0644, M: 9.6479, S: 0.10925 },
  { ageMonths: 13, L: 0.0563, M: 9.8749, S: 0.10949 },
  { ageMonths: 14, L: 0.0487, M: 10.0953, S: 0.10976 },
  { ageMonths: 15, L: 0.0413, M: 10.3108, S: 0.11007 },
  { ageMonths: 16, L: 0.0343, M: 10.5228, S: 0.11041 },
  { ageMonths: 17, L: 0.0275, M: 10.7319, S: 0.11079 },
  { ageMonths: 18, L: 0.0211, M: 10.9385, S: 0.11119 },
  { ageMonths: 19, L: 0.0148, M: 11.143, S: 0.11164 },
  { ageMonths: 20, L: 0.0087, M: 11.3462, S: 0.11211 },
  { ageMonths: 21, L: 0.0029, M: 11.5486, S: 0.11261 },
  { ageMonths: 22, L: -0.0028, M: 11.7504, S: 0.11314 },
  { ageMonths: 23, L: -0.0083, M: 11.9514, S: 0.11369 },
  { ageMonths: 24, L: -0.0137, M: 12.1515, S: 0.11426 },
];

/**
 * Weight-for-age LMS data for girls (0-24 months)
 * Weight in kg
 */
export const WEIGHT_GIRLS: WHODataPoint[] = [
  { ageMonths: 0, L: 0.3809, M: 3.2322, S: 0.14171 },
  { ageMonths: 1, L: 0.1714, M: 4.1873, S: 0.13724 },
  { ageMonths: 2, L: 0.0962, M: 5.1282, S: 0.13 },
  { ageMonths: 3, L: 0.0402, M: 5.8458, S: 0.12619 },
  { ageMonths: 4, L: -0.005, M: 6.4237, S: 0.12402 },
  { ageMonths: 5, L: -0.043, M: 6.8985, S: 0.12274 },
  { ageMonths: 6, L: -0.0756, M: 7.297, S: 0.12204 },
  { ageMonths: 7, L: -0.1039, M: 7.6422, S: 0.12178 },
  { ageMonths: 8, L: -0.1288, M: 7.9487, S: 0.12181 },
  { ageMonths: 9, L: -0.1507, M: 8.2254, S: 0.12199 },
  { ageMonths: 10, L: -0.17, M: 8.48, S: 0.12223 },
  { ageMonths: 11, L: -0.1872, M: 8.7192, S: 0.12247 },
  { ageMonths: 12, L: -0.2024, M: 8.9481, S: 0.12268 },
  { ageMonths: 13, L: -0.2158, M: 9.1699, S: 0.12283 },
  { ageMonths: 14, L: -0.2278, M: 9.387, S: 0.12294 },
  { ageMonths: 15, L: -0.2384, M: 9.6008, S: 0.12299 },
  { ageMonths: 16, L: -0.2478, M: 9.8124, S: 0.12303 },
  { ageMonths: 17, L: -0.2562, M: 10.0226, S: 0.12306 },
  { ageMonths: 18, L: -0.2637, M: 10.2315, S: 0.12309 },
  { ageMonths: 19, L: -0.2703, M: 10.4393, S: 0.12315 },
  { ageMonths: 20, L: -0.2762, M: 10.6464, S: 0.12323 },
  { ageMonths: 21, L: -0.2815, M: 10.8534, S: 0.12335 },
  { ageMonths: 22, L: -0.2862, M: 11.0608, S: 0.1235 },
  { ageMonths: 23, L: -0.2903, M: 11.2688, S: 0.1237 },
  { ageMonths: 24, L: -0.2941, M: 11.4775, S: 0.12393 },
];

/**
 * Length/Height-for-age LMS data for boys (0-24 months)
 * Length in cm (measured lying down for 0-24 months)
 */
export const HEIGHT_BOYS: WHODataPoint[] = [
  { ageMonths: 0, L: 1, M: 49.8842, S: 0.03795 },
  { ageMonths: 1, L: 1, M: 54.7244, S: 0.03557 },
  { ageMonths: 2, L: 1, M: 58.4249, S: 0.03424 },
  { ageMonths: 3, L: 1, M: 61.4292, S: 0.03328 },
  { ageMonths: 4, L: 1, M: 63.886, S: 0.03257 },
  { ageMonths: 5, L: 1, M: 65.9026, S: 0.03204 },
  { ageMonths: 6, L: 1, M: 67.6236, S: 0.03165 },
  { ageMonths: 7, L: 1, M: 69.1645, S: 0.03139 },
  { ageMonths: 8, L: 1, M: 70.5994, S: 0.03124 },
  { ageMonths: 9, L: 1, M: 71.9687, S: 0.03117 },
  { ageMonths: 10, L: 1, M: 73.2812, S: 0.03118 },
  { ageMonths: 11, L: 1, M: 74.5388, S: 0.03125 },
  { ageMonths: 12, L: 1, M: 75.7488, S: 0.03137 },
  { ageMonths: 13, L: 1, M: 76.9186, S: 0.03154 },
  { ageMonths: 14, L: 1, M: 78.0497, S: 0.03174 },
  { ageMonths: 15, L: 1, M: 79.1458, S: 0.03197 },
  { ageMonths: 16, L: 1, M: 80.2113, S: 0.03222 },
  { ageMonths: 17, L: 1, M: 81.2487, S: 0.0325 },
  { ageMonths: 18, L: 1, M: 82.2587, S: 0.03279 },
  { ageMonths: 19, L: 1, M: 83.2418, S: 0.0331 },
  { ageMonths: 20, L: 1, M: 84.1996, S: 0.03342 },
  { ageMonths: 21, L: 1, M: 85.1348, S: 0.03376 },
  { ageMonths: 22, L: 1, M: 86.0477, S: 0.0341 },
  { ageMonths: 23, L: 1, M: 86.941, S: 0.03445 },
  { ageMonths: 24, L: 1, M: 87.8161, S: 0.03479 },
];

/**
 * Length/Height-for-age LMS data for girls (0-24 months)
 * Length in cm
 */
export const HEIGHT_GIRLS: WHODataPoint[] = [
  { ageMonths: 0, L: 1, M: 49.1477, S: 0.0379 },
  { ageMonths: 1, L: 1, M: 53.6872, S: 0.0364 },
  { ageMonths: 2, L: 1, M: 57.0673, S: 0.03568 },
  { ageMonths: 3, L: 1, M: 59.8029, S: 0.0352 },
  { ageMonths: 4, L: 1, M: 62.0899, S: 0.03486 },
  { ageMonths: 5, L: 1, M: 64.0301, S: 0.03463 },
  { ageMonths: 6, L: 1, M: 65.7311, S: 0.03448 },
  { ageMonths: 7, L: 1, M: 67.2873, S: 0.0344 },
  { ageMonths: 8, L: 1, M: 68.7498, S: 0.03437 },
  { ageMonths: 9, L: 1, M: 70.1435, S: 0.03439 },
  { ageMonths: 10, L: 1, M: 71.4818, S: 0.03445 },
  { ageMonths: 11, L: 1, M: 72.771, S: 0.03455 },
  { ageMonths: 12, L: 1, M: 74.015, S: 0.03467 },
  { ageMonths: 13, L: 1, M: 75.2176, S: 0.03483 },
  { ageMonths: 14, L: 1, M: 76.3817, S: 0.03501 },
  { ageMonths: 15, L: 1, M: 77.5099, S: 0.03522 },
  { ageMonths: 16, L: 1, M: 78.6055, S: 0.03544 },
  { ageMonths: 17, L: 1, M: 79.671, S: 0.03569 },
  { ageMonths: 18, L: 1, M: 80.7079, S: 0.03595 },
  { ageMonths: 19, L: 1, M: 81.7182, S: 0.03622 },
  { ageMonths: 20, L: 1, M: 82.7036, S: 0.03652 },
  { ageMonths: 21, L: 1, M: 83.6654, S: 0.03682 },
  { ageMonths: 22, L: 1, M: 84.604, S: 0.03713 },
  { ageMonths: 23, L: 1, M: 85.5202, S: 0.03745 },
  { ageMonths: 24, L: 1, M: 86.4153, S: 0.03778 },
];

/**
 * Head circumference-for-age LMS data for boys (0-24 months)
 * Head circumference in cm
 */
export const HEAD_BOYS: WHODataPoint[] = [
  { ageMonths: 0, L: 1, M: 34.4618, S: 0.03686 },
  { ageMonths: 1, L: 1, M: 37.2759, S: 0.03133 },
  { ageMonths: 2, L: 1, M: 39.1285, S: 0.02997 },
  { ageMonths: 3, L: 1, M: 40.5135, S: 0.02918 },
  { ageMonths: 4, L: 1, M: 41.6317, S: 0.02868 },
  { ageMonths: 5, L: 1, M: 42.5576, S: 0.02837 },
  { ageMonths: 6, L: 1, M: 43.3306, S: 0.02817 },
  { ageMonths: 7, L: 1, M: 44.0065, S: 0.02804 },
  { ageMonths: 8, L: 1, M: 44.6045, S: 0.02796 },
  { ageMonths: 9, L: 1, M: 45.1345, S: 0.02792 },
  { ageMonths: 10, L: 1, M: 45.6094, S: 0.0279 },
  { ageMonths: 11, L: 1, M: 46.0398, S: 0.0279 },
  { ageMonths: 12, L: 1, M: 46.4355, S: 0.02791 },
  { ageMonths: 13, L: 1, M: 46.8035, S: 0.02793 },
  { ageMonths: 14, L: 1, M: 47.1487, S: 0.02796 },
  { ageMonths: 15, L: 1, M: 47.4756, S: 0.02799 },
  { ageMonths: 16, L: 1, M: 47.7872, S: 0.02803 },
  { ageMonths: 17, L: 1, M: 48.0853, S: 0.02807 },
  { ageMonths: 18, L: 1, M: 48.372, S: 0.02812 },
  { ageMonths: 19, L: 1, M: 48.6479, S: 0.02817 },
  { ageMonths: 20, L: 1, M: 48.914, S: 0.02823 },
  { ageMonths: 21, L: 1, M: 49.1708, S: 0.02828 },
  { ageMonths: 22, L: 1, M: 49.4186, S: 0.02835 },
  { ageMonths: 23, L: 1, M: 49.6578, S: 0.02841 },
  { ageMonths: 24, L: 1, M: 49.8888, S: 0.02847 },
];

/**
 * Head circumference-for-age LMS data for girls (0-24 months)
 * Head circumference in cm
 */
export const HEAD_GIRLS: WHODataPoint[] = [
  { ageMonths: 0, L: 1, M: 33.8787, S: 0.03496 },
  { ageMonths: 1, L: 1, M: 36.5463, S: 0.0321 },
  { ageMonths: 2, L: 1, M: 38.2521, S: 0.03168 },
  { ageMonths: 3, L: 1, M: 39.5328, S: 0.03111 },
  { ageMonths: 4, L: 1, M: 40.5817, S: 0.03067 },
  { ageMonths: 5, L: 1, M: 41.459, S: 0.03032 },
  { ageMonths: 6, L: 1, M: 42.1995, S: 0.03004 },
  { ageMonths: 7, L: 1, M: 42.829, S: 0.02983 },
  { ageMonths: 8, L: 1, M: 43.3671, S: 0.02966 },
  { ageMonths: 9, L: 1, M: 43.83, S: 0.02953 },
  { ageMonths: 10, L: 1, M: 44.2319, S: 0.02942 },
  { ageMonths: 11, L: 1, M: 44.5844, S: 0.02933 },
  { ageMonths: 12, L: 1, M: 44.8965, S: 0.02926 },
  { ageMonths: 13, L: 1, M: 45.1752, S: 0.0292 },
  { ageMonths: 14, L: 1, M: 45.4265, S: 0.02914 },
  { ageMonths: 15, L: 1, M: 45.6551, S: 0.0291 },
  { ageMonths: 16, L: 1, M: 45.865, S: 0.02906 },
  { ageMonths: 17, L: 1, M: 46.0598, S: 0.02903 },
  { ageMonths: 18, L: 1, M: 46.2424, S: 0.029 },
  { ageMonths: 19, L: 1, M: 46.4152, S: 0.02897 },
  { ageMonths: 20, L: 1, M: 46.5801, S: 0.02895 },
  { ageMonths: 21, L: 1, M: 46.7384, S: 0.02893 },
  { ageMonths: 22, L: 1, M: 46.8913, S: 0.02891 },
  { ageMonths: 23, L: 1, M: 47.0391, S: 0.0289 },
  { ageMonths: 24, L: 1, M: 47.1822, S: 0.02888 },
];

/**
 * Get WHO data for a specific measurement type and gender
 */
export function getWHOData(
  measurementType: "weight" | "height" | "head",
  gender: "male" | "female"
): WHODataPoint[] {
  switch (measurementType) {
    case "weight":
      return gender === "male" ? WEIGHT_BOYS : WEIGHT_GIRLS;
    case "height":
      return gender === "male" ? HEIGHT_BOYS : HEIGHT_GIRLS;
    case "head":
      return gender === "male" ? HEAD_BOYS : HEAD_GIRLS;
  }
}
