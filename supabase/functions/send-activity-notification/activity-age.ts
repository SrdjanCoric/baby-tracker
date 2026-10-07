const MAX_ACTIVITY_AGE_MS = 60 * 60 * 1000;

export const ACTIVITY_TIME_COLUMNS: Record<
  string,
  { time: string; end?: string }
> = {
  feedings: { time: "started_at", end: "ended_at" },
  sleep_sessions: { time: "started_at", end: "ended_at" },
  diapers: { time: "changed_at" },
  pumping_sessions: { time: "started_at", end: "ended_at" },
  growth_measurements: { time: "measured_at" },
  tummy_time_sessions: { time: "started_at", end: "ended_at" },
};

export function getPastActivity(
  table: string,
  record: Record<string, unknown>,
  now: number
): { activityTime: string; ageMs: number } | null {
  const columns = ACTIVITY_TIME_COLUMNS[table];
  if (!columns) return null;
  const activityTime = columns.end
    ? (record[columns.end] ?? record[columns.time])
    : record[columns.time];
  if (typeof activityTime !== "string") return null;
  const timestamp = Date.parse(activityTime);
  if (!Number.isFinite(timestamp)) return null;
  const ageMs = now - timestamp;
  return ageMs > MAX_ACTIVITY_AGE_MS ? { activityTime, ageMs } : null;
}
