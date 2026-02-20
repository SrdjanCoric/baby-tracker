export function isUnderTwoYears(birthDate: string | undefined): boolean {
  if (!birthDate) return true;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return true;
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

export function formatWeightChange(changeGrams: number): string {
  if (!Number.isFinite(changeGrams)) return "\u2014";
  if (changeGrams === 0) return "stable";
  const sign = changeGrams > 0 ? "+" : "";
  return `${sign}${changeGrams}g`;
}
