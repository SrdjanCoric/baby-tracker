import type { StoredFeedingEntry } from "@/services/feeding-storage";

const SESSION_GAP_MS = 60 * 60 * 1000; // 1 hour

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
