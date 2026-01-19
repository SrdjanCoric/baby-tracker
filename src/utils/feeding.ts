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
