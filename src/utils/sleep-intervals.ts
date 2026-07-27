import type { StoredSleepEntry } from "@/services/sleep-storage";

export function unionCompletedSleepIntervals(
  sleeps: StoredSleepEntry[]
): StoredSleepEntry[] {
  const completed = sleeps
    .filter((sleep) => sleep.endedAt)
    .map((sleep) => ({ ...sleep }))
    .sort(
      (a, b) =>
        new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    );
  const unioned: StoredSleepEntry[] = [];

  for (const sleep of completed) {
    const previous = unioned[unioned.length - 1];
    if (!previous) {
      unioned.push(sleep);
      continue;
    }

    const previousEnd = new Date(previous.endedAt!).getTime();
    const sleepStart = new Date(sleep.startedAt).getTime();
    if (sleepStart >= previousEnd) {
      unioned.push(sleep);
      continue;
    }

    const sleepEnd = new Date(sleep.endedAt!).getTime();
    const unionEnd = Math.max(previousEnd, sleepEnd);
    previous.endedAt = new Date(unionEnd).toISOString();
    previous.durationSeconds = Math.floor(
      (unionEnd - new Date(previous.startedAt).getTime()) / 1000
    );
  }

  return [...unioned, ...sleeps.filter((sleep) => !sleep.endedAt)].sort(
    (a, b) =>
      new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );
}
