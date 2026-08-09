export function isUnderTwoYears(birthDate: string | undefined): boolean {
  if (!birthDate) return true;
  const birth = new Date(birthDate);
  const now = new Date();
  const monthsDiff =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  return monthsDiff < 24;
}

export function getGrowthTrendArrow(change: number | undefined): string {
  if (change === undefined || change === 0) return "→";
  return change > 0 ? "↗" : "↘";
}

export function formatWeightChange(changeGrams: number, t?: (key: string) => string): string {
  if (changeGrams === 0) return t ? t("growthHelpers.stable") : "stable";
  const sign = changeGrams > 0 ? "+" : "";
  return `${sign}${changeGrams}g`;
}

export function formatPercentile(percentile: number): string {
  return `P${Math.round(percentile)}`;
}
