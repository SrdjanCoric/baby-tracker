export function parseWholeMinutes(text: string): number | undefined {
  return /^\d+$/.test(text) ? Number(text) : undefined;
}

export function parseWholeMinutesAsSeconds(text: string): number | undefined {
  const minutes = parseWholeMinutes(text);
  return minutes === undefined ? undefined : minutes * 60;
}

export function wholeMinutes(seconds: number | undefined): number | undefined {
  return seconds ? Math.floor(seconds / 60) : undefined;
}

export function wholeMinutesText(seconds: number | undefined): string {
  return wholeMinutes(seconds)?.toString() ?? "";
}

// Sides are checked one at a time: "Both" counts time on each side, so the sum may exceed the duration.
export function findSidesLongerThanDuration(
  durationSeconds: number | undefined,
  sideSeconds: { left?: number; right?: number }
): ("left" | "right")[] {
  if (durationSeconds === undefined) return [];
  return (["left", "right"] as const).filter(
    (side) => (sideSeconds[side] ?? 0) > durationSeconds
  );
}
