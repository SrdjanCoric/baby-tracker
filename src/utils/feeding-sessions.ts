import type { StoredFeedingEntry } from "@/services/feeding-storage";
import type { BreastSide } from "@/constants/activities";

const SESSION_GAP_MS = 60 * 60 * 1000; // 1 hour
const MIN_SESSION_DURATION_SECONDS = 120; // 2 minutes

export function countFeedingSessions(feedings: StoredFeedingEntry[]): number {
  if (feedings.length === 0) return 0;

  const sorted = [...feedings].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );

  let sessions = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const prevEnd = new Date(prev.endedAt || prev.startedAt).getTime();
    const currStart = new Date(sorted[i].startedAt).getTime();

    if (currStart - prevEnd >= SESSION_GAP_MS) {
      sessions++;
    }
  }

  return sessions;
}

export function computeSuggestedSide(allFeedings: StoredFeedingEntry[]): BreastSide | null {
  const breastEntries = allFeedings
    .filter(f => f.type === "breast")
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  if (breastEntries.length === 0) return null;

  let sessionStart = 0;
  while (sessionStart < breastEntries.length) {
    const session = [breastEntries[sessionStart]];
    for (let i = sessionStart + 1; i < breastEntries.length; i++) {
      const laterStart = new Date(session[session.length - 1].startedAt).getTime();
      const earlierEnd = new Date(breastEntries[i].endedAt || breastEntries[i].startedAt).getTime();
      if (laterStart - earlierEnd <= SESSION_GAP_MS) {
        session.push(breastEntries[i]);
      } else {
        break;
      }
    }

    const result = computeSuggestionFromSession(session);
    if (result !== null) return result;

    sessionStart += session.length;
  }

  return null;
}

function computeSuggestionFromSession(session: StoredFeedingEntry[]): BreastSide | null {
  let totalLeft = 0, totalRight = 0, totalDuration = 0;
  for (const entry of session) {
    totalLeft += entry.leftDurationSeconds ?? 0;
    totalRight += entry.rightDurationSeconds ?? 0;
    totalDuration += entry.durationSeconds ?? 0;
  }

  if (totalDuration < MIN_SESSION_DURATION_SECONDS) return null;

  if (totalLeft > 0 && totalRight > 0) {
    if (totalLeft < totalRight) return "left";
    if (totalRight < totalLeft) return "right";
    const mostRecent = session[0];
    if (mostRecent.lastFinishedSide === "both") return "both";
    const lastSide = mostRecent.lastFinishedSide ?? "left";
    return lastSide === "left" ? "right" : "left";
  }

  if (totalLeft > 0) return "right";
  if (totalRight > 0) return "left";

  const mostRecent = session[0];
  const lastSide = mostRecent.lastFinishedSide ?? mostRecent.side;
  if (lastSide && lastSide !== "both") {
    return lastSide === "left" ? "right" : "left";
  }

  return "left";
}
