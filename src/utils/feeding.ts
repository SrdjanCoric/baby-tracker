import type { FeedingType } from "@/constants/activities";

export type FeedingTab = "breast" | "bottle" | "solids";

export function feedingTypeToTab(type: FeedingType): FeedingTab {
  if (type === "solid") {
    return "solids";
  }
  return type;
}

export interface FeedingEntryWithTime {
  type: FeedingType;
  startedAt: string | Date;
}

export function getLastFeedingType(
  feedings: FeedingEntryWithTime[]
): FeedingType | null {
  if (feedings.length === 0) {
    return null;
  }

  let mostRecent: FeedingEntryWithTime | null = null;
  let mostRecentTime = -Infinity;

  for (const feeding of feedings) {
    const time =
      feeding.startedAt instanceof Date
        ? feeding.startedAt.getTime()
        : new Date(feeding.startedAt).getTime();

    if (time > mostRecentTime) {
      mostRecentTime = time;
      mostRecent = feeding;
    }
  }

  return mostRecent?.type ?? null;
}

export function formatDualSideDuration(
  leftDurationSeconds?: number,
  rightDurationSeconds?: number
): string {
  const leftMinutes = leftDurationSeconds ? Math.floor(leftDurationSeconds / 60) : 0;
  const rightMinutes = rightDurationSeconds ? Math.floor(rightDurationSeconds / 60) : 0;

  const hasLeft = (leftDurationSeconds ?? 0) > 0;
  const hasRight = (rightDurationSeconds ?? 0) > 0;

  if (!hasLeft && !hasRight) {
    return "";
  }

  if (hasLeft && hasRight) {
    return `L: ${leftMinutes}m, R: ${rightMinutes}m`;
  }

  if (hasLeft) {
    return `L: ${leftMinutes}m`;
  }

  return `R: ${rightMinutes}m`;
}
