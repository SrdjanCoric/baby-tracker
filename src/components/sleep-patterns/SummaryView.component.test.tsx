import React from "react";
import { render, screen, within } from "@testing-library/react-native";
import type { StoredSleepEntry } from "@/services/sleep-storage";
import type { SleepPatternColors } from "./useSleepPatternColors";

let mockLanguage = "en";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, number>) => {
      if (key === "common.durationHM") {
        return mockLanguage === "de"
          ? `${options?.h}Std ${options?.m}Min`
          : `${options?.h}h ${options?.m}m`;
      }
      if (key === "common.durationH") {
        return mockLanguage === "de" ? `${options?.h}Std` : `${options?.h}h`;
      }
      if (key === "common.durationM") {
        return mockLanguage === "de" ? `${options?.m}Min` : `${options?.m}m`;
      }
      if (key === "sleepPatterns.avgNapTimeSubtitle") {
        return `per napping day · ${options?.nappingDays} of ${options?.days}`;
      }
      if (key === "sleepPatterns.napSlot") {
        return `Nap ${options?.slotNumber}`;
      }
      if (key === "sleepPatterns.napOccurrenceCount") {
        return `${options?.count} of ${options?.nappingDays} days`;
      }
      return key;
    },
  }),
}));

jest.mock("./SleepDailyChart", () => {
  const { Text } = require("react-native");
  return {
    SleepDailyChart: ({ data }: { data: Array<{ dateKey: string }> }) => (
      <>
        <Text testID="daily-bar-count">{data.length}</Text>
        <Text testID="daily-bar-keys">{data.map((bar) => bar.dateKey).join(",")}</Text>
      </>
    ),
  };
});

jest.mock("./TrendChart", () => {
  const { Text } = require("react-native");
  return {
    TrendChart: () => <Text>trend</Text>,
  };
});

import { SummaryView } from "./SummaryView";

const colors: SleepPatternColors = {
  bgColor: "#fff",
  cardBg: "#fff",
  textPrimary: "#111",
  textSecondary: "#555",
  textTertiary: "#777",
  borderSubtle: "#ddd",
  gridLine: "#eee",
  accentColor: "#00f",
  nightColor: "#123",
  napColor: "#456",
  napTextColor: "#789",
  isDark: false,
};

function localISO(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0
): string {
  return new Date(year, month - 1, day, hour, minute, 0).toISOString();
}

function makeSleep(
  id: string,
  startedAt: string,
  endedAt: string
): StoredSleepEntry {
  return {
    id,
    babyId: "baby-1",
    type: "nap",
    startedAt,
    endedAt,
    durationSeconds: Math.floor(
      (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
    ),
    createdAt: startedAt,
    updatedAt: endedAt,
  };
}

const sleeps = [
  makeSleep(
    "evening-fragment",
    localISO(2026, 7, 31, 20, 35),
    localISO(2026, 8, 1, 0, 20)
  ),
  makeSleep(
    "morning-fragment",
    localISO(2026, 8, 1, 2, 15),
    localISO(2026, 8, 1, 6, 55)
  ),
  makeSleep(
    "incomplete-current-day",
    localISO(2026, 8, 1, 12, 0),
    localISO(2026, 8, 1, 13, 0)
  ),
];

function renderSummary(timeFormat: "12h" | "24h") {
  return render(
    <SummaryView
      sleeps={sleeps}
      now={new Date(2026, 7, 1, 18, 0, 0)}
      timeFormat={timeFormat}
      dayStartHour={9}
      dayEndHour={21}
      colors={colors}
      isNewborn={false}
      locale="en"
      period={7}
      onPeriodChange={() => {}}
    />
  );
}

describe("SummaryView", () => {
  afterEach(() => {
    mockLanguage = "en";
    jest.useRealTimers();
  });


  it("shows only completed sleep days and the evening fragment as bedtime in both formats", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 7, 1, 18, 0, 0));

    const { rerender } = renderSummary("24h");

    const avgTotalSleepCard = screen.getByText(
      "sleepPatterns.avgTotalSleep"
    ).parent!.parent!;
    expect(within(avgTotalSleepCard).getByText("8h 25m")).toBeTruthy();
    expect(screen.getByText("20:35")).toBeTruthy();
    expect(screen.getByTestId("daily-bar-count").props.children).toBe(7);
    expect(screen.getByTestId("daily-bar-keys").props.children).toBe(
      "2026-07-25,2026-07-26,2026-07-27,2026-07-28,2026-07-29,2026-07-30,2026-07-31"
    );

    rerender(
      <SummaryView
        sleeps={sleeps}
        now={new Date(2026, 7, 1, 18, 0, 0)}
        timeFormat="12h"
        dayStartHour={9}
        dayEndHour={21}
        colors={colors}
        isNewborn={false}
        locale="en"
        period={7}
        onPeriodChange={() => {}}
      />
    );

    expect(screen.getByText("8:35 PM")).toBeTruthy();
  });

  it("shows average nap time with its napping-day divisor", () => {
    const divergentSleeps = [
      makeSleep(
        "night-only",
        localISO(2025, 3, 4, 20),
        localISO(2025, 3, 4, 23)
      ),
      makeSleep(
        "first-short-nap",
        localISO(2025, 3, 5, 10),
        localISO(2025, 3, 5, 10, 30)
      ),
      makeSleep(
        "second-short-nap",
        localISO(2025, 3, 5, 14),
        localISO(2025, 3, 5, 14, 30)
      ),
      makeSleep(
        "long-nap",
        localISO(2025, 3, 6, 10),
        localISO(2025, 3, 6, 12)
      ),
    ];

    render(
      <SummaryView
        sleeps={divergentSleeps}
        now={new Date(2025, 2, 8, 12, 0, 0)}
        timeFormat="24h"
        dayStartHour={6}
        dayEndHour={19}
        colors={colors}
        isNewborn={false}
        locale="en"
        period={7}
        onPeriodChange={() => {}}
      />
    );

    expect(screen.getByText("sleepPatterns.avgNapTime")).toBeTruthy();
    expect(screen.getByText("1h 30m")).toBeTruthy();
    expect(screen.getByText("2h")).toBeTruthy();
    expect(screen.getByText("per napping day · 2 of 7")).toBeTruthy();
  });

  it("shows a zero napping-day divisor when the range has no naps", () => {
    render(
      <SummaryView
        sleeps={[
          makeSleep(
            "night-only",
            localISO(2025, 3, 6, 20),
            localISO(2025, 3, 6, 23)
          ),
        ]}
        now={new Date(2025, 2, 8, 12, 0, 0)}
        timeFormat="24h"
        dayStartHour={6}
        dayEndHour={19}
        colors={colors}
        isNewborn={false}
        locale="en"
        period={7}
        onPeriodChange={() => {}}
      />
    );

    expect(screen.getAllByText("0m").length).toBeGreaterThan(0);
    expect(screen.getByText("per napping day · 0 of 7")).toBeTruthy();
  });

  it("shows qualifying nap slots with their occurrence count and hides failing rows", () => {
    const scheduleSleeps = [3, 4, 5].flatMap((day) => {
      const firstNapStart = localISO(2025, 3, day, 9);
      const naps = [
        makeSleep(
          `first-${day}`,
          firstNapStart,
          new Date(
            new Date(firstNapStart).getTime() + (day - 2) * 30 * 60 * 1000
          ).toISOString()
        ),
      ];
      if (day < 5) {
        naps.push(
          makeSleep(
            `second-${day}`,
            localISO(2025, 3, day, 13),
            localISO(2025, 3, day, 13, 30)
          )
        );
      }
      return naps;
    });

    render(
      <SummaryView
        sleeps={scheduleSleeps}
        now={new Date(2025, 2, 8, 12, 0, 0)}
        timeFormat="24h"
        dayStartHour={6}
        dayEndHour={19}
        colors={colors}
        isNewborn={false}
        locale="en"
        period={7}
        onPeriodChange={() => {}}
      />
    );

    expect(screen.getByText("sleepPatterns.napSchedule")).toBeTruthy();
    expect(screen.getByText("Nap 1")).toBeTruthy();
    expect(screen.getByText("3 of 3 days")).toBeTruthy();
    expect(screen.getByText("1h")).toBeTruthy();
    expect(screen.getByText("9:00")).toBeTruthy();
    expect(screen.queryByText("Nap 2")).toBeNull();
  });

  it("localizes a nap schedule duration", () => {
    mockLanguage = "de";
    const scheduleSleeps = [3, 4, 5].map((day) =>
      makeSleep(
        `nap-${day}`,
        localISO(2025, 3, day, 9),
        localISO(2025, 3, day, 10, 30)
      )
    );

    render(
      <SummaryView
        sleeps={scheduleSleeps}
        now={new Date(2025, 2, 8, 12, 0, 0)}
        timeFormat="24h"
        dayStartHour={6}
        dayEndHour={19}
        colors={colors}
        isNewborn={false}
        locale="de"
        period={7}
        onPeriodChange={() => {}}
      />
    );

    expect(screen.getByText("1Std 30Min")).toBeTruthy();
  });

  it("omits the nap schedule panel when no slot qualifies", () => {
    render(
      <SummaryView
        sleeps={[
          makeSleep(
            "nap-one",
            localISO(2025, 3, 5, 9),
            localISO(2025, 3, 5, 10)
          ),
          makeSleep(
            "nap-two",
            localISO(2025, 3, 6, 9),
            localISO(2025, 3, 6, 10)
          ),
        ]}
        now={new Date(2025, 2, 8, 12, 0, 0)}
        timeFormat="24h"
        dayStartHour={6}
        dayEndHour={19}
        colors={colors}
        isNewborn={false}
        locale="en"
        period={7}
        onPeriodChange={() => {}}
      />
    );

    expect(screen.queryByText("sleepPatterns.napSchedule")).toBeNull();
  });
});
