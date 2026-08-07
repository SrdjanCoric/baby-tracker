import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import EditSleepScreen from "../../app/edit/sleep";
import { createPumpingTimerAdapter } from "@/services/timer-adapters/pumping-timer-adapter";
import { createSleepTimerAdapter } from "@/services/timer-adapters/sleep-timer-adapter";
import { createTummyTimeTimerAdapter } from "@/services/timer-adapters/tummy-time-timer-adapter";
import type { StoredPumpingEntry } from "@/services/pumping-storage";
import type { StoredSleepEntry, UpdateSleepInput } from "@/services/sleep-storage";
import type { StoredTummyTimeEntry } from "@/services/tummyTime-storage";
import { formatSleepAsCSV } from "@/utils/csv-generator";
import { renderSleepSection } from "@/utils/pdf-templates/sleep-section";
import { aggregateSleep } from "@/utils/report-aggregator";
import { buildDayViewData } from "@/utils/sleep-patterns";
import {
  calculatePumpingStats,
  calculateTummyTimeStats,
} from "@/utils/statistics";
import { formatDuration } from "@/utils/time";
import { calculateDailySummary } from "@/utils/timeline";

const mockUpdateSleep = jest.fn();
let mockEditSleeps: StoredSleepEntry[] = [];

jest.mock("@react-native-community/datetimepicker", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => (
      <View testID="datetime-picker" {...props} />
    ),
  };
});

jest.mock("@/contexts/sleep-context", () => ({
  useSleep: () => ({
    sleeps: mockEditSleeps,
    updateSleep: mockUpdateSleep,
    deleteSleep: jest.fn(),
    wakeWindowConfig: { dayStartHour: 6, dayEndHour: 19 },
  }),
}));

jest.mock("@/contexts", () => ({
  useBaby: () => ({ selectedBaby: { id: "baby-1", name: "Sofi" } }),
  useTimeFormat: () => ({ timeFormat: "24h" }),
}));

jest.mock("@/hooks/useDuplicateCheck", () => ({
  useDuplicateCheck: () => ({ checkAndConfirmSleep: jest.fn().mockResolvedValue(true) }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    canGoBack: () => false,
    back: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({ id: "legacy-paused-sleep" }),
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ dispatch: jest.fn() }),
  usePreventRemove: jest.fn(),
}));

jest.mock("@/services/live-activity-service", () => ({}));
jest.mock("@/services/active-timer-service", () => ({}));
jest.mock("@/services/timer-conflict-notice", () => ({}));
jest.mock("@/services/timer-completion-service", () => ({}));
jest.mock("@/services/timer-lock-reconciliation", () => ({}));
jest.mock("@/services/timer-stop-coordinator", () => ({}));

describe("recorded timer duration consumers", () => {
  const startedAt = new Date("2026-08-05T12:00:00.000Z");
  const endedAt = new Date("2026-08-05T12:30:00.000Z");

  it("includes a resumed pause in pumping totals without splitting the session", () => {
    const adapter = createPumpingTimerAdapter({
      babyId: "baby-1",
      dispatchRestoreTimer: jest.fn(),
    });
    const input = adapter.buildRecord(startedAt, endedAt, {
      timerInstanceId: "pumping-timer-1",
      activityId: "pumping-activity-1",
      side: "left",
      isPaused: false,
      totalPausedMs: 600_000,
    });
    const pumping: StoredPumpingEntry = {
      ...input,
      id: input.id!,
      startedAt: input.startedAt.toISOString(),
      endedAt: input.endedAt?.toISOString(),
      createdAt: endedAt.toISOString(),
      updatedAt: endedAt.toISOString(),
    };

    expect(calculatePumpingStats([pumping])).toMatchObject({
      totalCount: 1,
      totalDurationSeconds: 1800,
    });
  });

  it("includes a resumed pause in tummy-time totals without splitting the session", () => {
    const adapter = createTummyTimeTimerAdapter({
      babyId: "baby-1",
      dispatchRestoreTimer: jest.fn(),
    });
    const input = adapter.buildRecord(startedAt, endedAt, {
      timerInstanceId: "tummy-timer-1",
      activityId: "tummy-activity-1",
      isPaused: false,
      totalPausedMs: 600_000,
    });
    const tummyTime: StoredTummyTimeEntry = {
      ...input,
      id: input.id!,
      startedAt: input.startedAt.toISOString(),
      endedAt: input.endedAt?.toISOString(),
      createdAt: endedAt.toISOString(),
      updatedAt: endedAt.toISOString(),
    };

    expect(calculateTummyTimeStats([tummyTime])).toMatchObject({
      sessionCount: 1,
      totalDurationSeconds: 1800,
    });
  });

  it("keeps sleep consumers aligned for a recorded resumed pause", () => {
    const adapter = createSleepTimerAdapter({
      babyId: "baby-1",
      resolveMorningClassification: (_startedAt, stored) =>
        stored ?? "unresolved",
      dispatchRestoreTimer: jest.fn(),
    });
    const sleepStartedAt = new Date("2026-08-05T12:00:00.000Z");
    const sleepEndedAt = new Date("2026-08-05T12:10:00.000Z");
    const input = adapter.buildRecord(sleepStartedAt, sleepEndedAt, {
      timerInstanceId: "sleep-timer-1",
      activityId: "sleep-activity-1",
      type: "nap",
      isPaused: false,
      totalPausedMs: 120_000,
      morningClassification: "automatic",
      morningClassificationVersion: 4,
    });
    const sleep: StoredSleepEntry = {
      ...input,
      id: input.id!,
      startedAt: input.startedAt.toISOString(),
      endedAt: input.endedAt.toISOString(),
      createdAt: sleepEndedAt.toISOString(),
      updatedAt: sleepEndedAt.toISOString(),
    };
    const day = new Date("2026-08-05T12:00:00.000Z");
    const report = aggregateSleep(
      [sleep],
      new Date("2026-08-05T00:00:00.000Z"),
      new Date("2026-08-05T23:59:59.999Z")
    );

    expect(
      calculateDailySummary(day, {
        feedings: [],
        sleeps: [sleep],
        diapers: [],
        pumpings: [],
        growths: [],
        tummyTimes: [],
      }).sleepMinutes
    ).toBe(10);
    expect(
      buildDayViewData([sleep], day, 60, day, 6, "en", 19).totalSleepSeconds
    ).toBe(600);
    expect(formatDuration(sleep.durationSeconds, "short")).toBe("10m");
    expect(formatSleepAsCSV([sleep], false)).toContain("00:10:00");
    expect(report.totalMinutes).toBe(10);
    expect(renderSleepSection(report)).toContain(">10 min<");
  });

  it("keeps every sleep duration consumer aligned after a legacy paused interval is time-edited", async () => {
    const legacySleep: StoredSleepEntry = {
      id: "legacy-paused-sleep",
      babyId: "baby-1",
      type: "nap",
      startedAt: "2026-08-05T12:00:00.000Z",
      endedAt: "2026-08-05T12:10:00.000Z",
      durationSeconds: 300,
      createdAt: "2026-08-05T12:00:00.000Z",
      updatedAt: "2026-08-05T12:10:00.000Z",
    };
    mockEditSleeps = [legacySleep];
    mockUpdateSleep.mockReset().mockResolvedValue(legacySleep);

    const rendered = render(<EditSleepScreen />);
    await waitFor(() => expect(rendered.getByText("10m")).toBeTruthy());
    fireEvent.press(
      rendered.getByRole("button", { name: "sleep.endTime feeding.selectTime" })
    );
    fireEvent(
      rendered.getByTestId("datetime-picker"),
      "change",
      {},
      new Date("2026-08-05T12:07:00.000Z")
    );
    fireEvent.press(rendered.getByRole("button", { name: "common.save" }));

    await waitFor(() => expect(mockUpdateSleep).toHaveBeenCalledTimes(1));
    const update = mockUpdateSleep.mock.calls[0][1] as UpdateSleepInput;
    const sleep: StoredSleepEntry = {
      ...legacySleep,
      ...update,
      startedAt: update.startedAt!.toISOString(),
      endedAt: update.endedAt!.toISOString(),
      durationSeconds: update.durationSeconds!,
    };
    const day = new Date("2026-08-05T12:00:00.000Z");
    const report = aggregateSleep(
      [sleep],
      new Date("2026-08-05T00:00:00.000Z"),
      new Date("2026-08-05T23:59:59.999Z")
    );

    expect(
      calculateDailySummary(day, {
        feedings: [],
        sleeps: [sleep],
        diapers: [],
        pumpings: [],
        growths: [],
        tummyTimes: [],
      }).sleepMinutes
    ).toBe(7);
    expect(
      buildDayViewData([sleep], day, 60, day, 6, "en", 19).totalSleepSeconds
    ).toBe(420);
    expect(formatDuration(sleep.durationSeconds, "short")).toBe("7m");
    expect(formatSleepAsCSV([sleep], false)).toContain("00:07:00");
    expect(report.totalMinutes).toBe(7);
    expect(renderSleepSection(report)).toContain(">7 min<");
  });
});
