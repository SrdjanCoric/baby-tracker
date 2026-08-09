import { describe, expect, it } from "vitest";
import {
  calculateDailyBreakdown,
  calculateWeeklyBreakdown,
  getWeekdayLabelFromDateKey,
  toLocalDateKey,
} from "./statistics";

function localTimestamp(year: number, month: number, day: number, hour: number): string {
  return new Date(year, month - 1, day, hour, 30).toISOString();
}

describe("local calendar statistics buckets", () => {
  it("keeps an event just after local midnight on the caregiver's day", () => {
    expect(toLocalDateKey(new Date(2026, 7, 8, 0, 30))).toBe("2026-08-08");
  });

  it("keeps an event just before local midnight on the caregiver's day", () => {
    expect(toLocalDateKey(new Date(2026, 7, 8, 23, 30))).toBe("2026-08-08");
  });

  it("groups events after local midnight and before local midnight into the same daily bucket", () => {
    const entries = [
      { date: localTimestamp(2026, 8, 8, 0) },
      { date: localTimestamp(2026, 8, 8, 23) },
    ];
    const referenceDate = new Date(2026, 7, 8, 12);

    const daily = calculateDailyBreakdown(entries, (entry) => entry.date, 1, referenceDate);
    const weekly = calculateWeeklyBreakdown(entries, (entry) => entry.date, referenceDate);

    expect([...daily.keys()]).toEqual(["2026-08-08"]);
    expect(daily.get("2026-08-08")).toEqual(entries);
    expect(weekly.get("2026-08-08")).toEqual(entries);
  });

  it("keeps both ends of a daylight-saving transition on the local transition date", () => {
    const entries = [
      { date: localTimestamp(2026, 3, 8, 0) },
      { date: localTimestamp(2026, 3, 8, 23) },
    ];

    const breakdown = calculateDailyBreakdown(
      entries,
      (entry) => entry.date,
      1,
      new Date(2026, 2, 8, 12)
    );

    expect([...breakdown.keys()]).toEqual(["2026-03-08"]);
    expect(breakdown.get("2026-03-08")).toEqual(entries);
  });

  it("derives the weekday label from the same local date key", () => {
    expect(getWeekdayLabelFromDateKey("2026-08-08", "en-US")).toBe("Sat");
  });
});
