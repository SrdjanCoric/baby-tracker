import React from "react";
import { render, screen } from "@testing-library/react-native";
import { DailySummaryCard } from "./DailySummaryCard";
import type { TimelineDataByDate } from "@/utils/timeline";
import type { StoredSleepEntry } from "@/services/sleep-storage";

jest.mock("@react-native-community/datetimepicker", () => "DateTimePicker");

const translations: Record<string, string> = {
  "sleep.nap": "Naps",
  "sleep.night": "Night",
  "common.total": "Total",
  "common.noData": "No data",
  "timeline.summary": "Summary",
  "timeline.selectDate": "Select date",
  "common.today": "Today",
};

function t(key: string, options?: Record<string, unknown>): string {
  if (key === "common.durationHM") return `${options?.h}h ${options?.m}m`;
  if (key === "common.durationH") return `${options?.h}h`;
  if (key === "common.durationM") return `${options?.m}m`;
  return translations[key] ?? key;
}

const DAY = new Date(2026, 6, 15);

function localISO(hour: number, minute = 0, day = 15): string {
  return new Date(2026, 6, day, hour, minute, 0).toISOString();
}

function makeSleep(
  id: string,
  startedAt: string,
  endedAt: string,
  type: "nap" | "night" = "nap"
): StoredSleepEntry {
  return {
    id,
    babyId: "baby1",
    type,
    startedAt,
    endedAt,
    durationSeconds: Math.floor(
      (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
    ),
    createdAt: startedAt,
    updatedAt: endedAt,
  };
}

function dataWith(sleeps: StoredSleepEntry[]): TimelineDataByDate {
  return { feedings: [], sleeps, diapers: [], pumpings: [], growths: [], tummyTimes: [] };
}

function renderCard(data: TimelineDataByDate, props: { dayEndHour?: number } = {}) {
  return render(
    <DailySummaryCard
      filter="sleep"
      allData={data}
      dayStartHour={6}
      t={t}
      selectedDate={DAY}
      onDateChange={jest.fn()}
      {...props}
    />
  );
}

describe("DailySummaryCard sleep summary", () => {
  it("reports overlapping entries as one sleep", () => {
    renderCard(
      dataWith([
        makeSleep("a", localISO(10, 0), localISO(11, 30)),
        makeSleep("b", localISO(10, 5), localISO(11, 35)),
      ])
    );

    expect(screen.getByText("1×")).toBeTruthy();
    expect(screen.getByText("1h 35m")).toBeTruthy();
  });

  it("classifies an evening sleep by the configured day end hour", () => {
    const sleeps = [makeSleep("a", localISO(18, 0), localISO(18, 45))];

    const { unmount } = renderCard(dataWith(sleeps), { dayEndHour: 17 });

    expect(screen.getByText(/Night/)).toBeTruthy();
    expect(screen.queryByText(/Naps/)).toBeNull();
    unmount();

    renderCard(dataWith(sleeps), { dayEndHour: 19 });

    expect(screen.getByText(/Naps/)).toBeTruthy();
    expect(screen.queryByText(/Night/)).toBeNull();
  });
});
