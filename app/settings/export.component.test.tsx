import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { DateRange } from "@/types/export";

const mockExportToCSV = jest.fn();
const mockShareCSV = jest.fn();
const mockGetRecordCountsInRange = jest.fn();
const mockLoadRange = jest.fn(async () => {});

let mockUser: {
  id: string | null;
  householdId: string | null;
} = { id: "user-1", householdId: "household-1" };

let mockUnits: {
  volumeUnit: "ml" | "oz";
  weightUnit: "kg" | "lbs";
  heightUnit: "cm" | "in";
} = {
  volumeUnit: "ml",
  weightUnit: "kg",
  heightUnit: "cm",
};

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

const mockSelectedBaby = {
  id: "baby-1",
  name: "Sofi",
};

jest.mock("@/contexts", () => ({
  useBaby: () => ({
    selectedBaby: mockSelectedBaby,
  }),
  useUnits: () => mockUnits,
  useAuth: () => ({ user: mockUser }),
}));

jest.mock("@/hooks/useActivityRangeLoader", () => ({
  useActivityRangeLoader: () => ({
    loadRange: mockLoadRange,
    getRangeStatus: () => "loaded",
  }),
}));

jest.mock("@/components/export", () => {
  const { Pressable, Text } = require("react-native");
  return {
    DataTypeSelector: () => null,
    DateRangePicker: ({
      onDateRangeChange,
    }: {
      onDateRangeChange: (range: DateRange) => void;
    }) => (
      <Pressable
        testID="change-range"
        onPress={() =>
          onDateRangeChange({
            startDate: new Date(2026, 0, 1),
            endDate: new Date(2026, 0, 2),
            preset: "custom",
          })
        }
      >
        <Text>change-range</Text>
      </Pressable>
    ),
  };
});

jest.mock("@/services/export-service", () => ({
  ExportService: {
    exportToCSV: (options: unknown) => mockExportToCSV(options),
    shareCSV: (content: string, fileName: string) => mockShareCSV(content, fileName),
    getRecordCountsInRange: (
      babyId: string,
      startDate: Date,
      endDate: Date,
      ensureRangesLoaded?: () => Promise<void>
    ) => mockGetRecordCountsInRange(babyId, startDate, endDate, ensureRangesLoaded),
  },
}));

import ExportScreen from "./export";

describe("ExportScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockUser = { id: "user-1", householdId: "household-1" };
    mockUnits = {
      volumeUnit: "ml",
      weightUnit: "kg",
      heightUnit: "cm",
    };
    mockLoadRange.mockClear();
    mockLoadRange.mockImplementation(async () => {});
    mockGetRecordCountsInRange.mockImplementation(
      async (_babyId: string, _s: Date, _e: Date, ensure?: () => Promise<void>) => {
        await ensure?.();
        return {
          feedings: 1,
          sleep: 0,
          diapers: 0,
          pumping: 0,
          growth: 0,
          tummyTime: 0,
          health: 0,
        };
      }
    );
    mockExportToCSV.mockResolvedValue({
      success: true,
      content: "csv",
      fileName: "export.csv",
    });
    mockShareCSV.mockResolvedValue(undefined);
  });

  it("resolves every collection's selected range before loading record counts", async () => {
    render(<ExportScreen />);

    await waitFor(() => {
      expect(screen.getByText("export.recordsSummary")).toBeTruthy();
    });

    const expectedEnd = new Date();
    expectedEnd.setHours(23, 59, 59, 999);
    const expectedStart = new Date();
    expectedStart.setHours(0, 0, 0, 0);
    expectedStart.setDate(expectedStart.getDate() - 29);

    expect(mockLoadRange).toHaveBeenCalledTimes(6);
    for (const call of mockLoadRange.mock.calls) {
      const range = call[0] as { start: string; end: string };
      expect(Date.parse(range.start)).toBe(expectedStart.getTime());
      expect(Date.parse(range.end)).toBe(expectedEnd.getTime() + 1);
    }
  });

  it("shows an error, disables export, and retries when range resolution fails", async () => {
    mockLoadRange.mockRejectedValueOnce(new Error("Failed to fetch activity range"));

    render(<ExportScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("export-range-error")).toBeTruthy();
    });
    expect(screen.queryByText("export.recordsSummary")).toBeNull();
    // TR-2: Export button is disabled while the range is in the error state.
    expect(screen.getByTestId("export-button").props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByTestId("export-range-retry"));

    await waitFor(() => {
      expect(screen.getByText("export.recordsSummary")).toBeTruthy();
    });
    expect(screen.queryByTestId("export-range-error")).toBeNull();
  });

  it("debounces rapid range changes so each iOS spinner tick does not fetch", async () => {
    jest.useFakeTimers();
    mockGetRecordCountsInRange.mockClear();
    mockLoadRange.mockClear();

    render(<ExportScreen />);

    // Let the initial debounced load resolve.
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(mockLoadRange).toHaveBeenCalledTimes(6);
    mockLoadRange.mockClear();

    // Rapid changes — an iOS spinner fires one onChange per scrolled value.
    fireEvent.press(screen.getByTestId("change-range"));
    fireEvent.press(screen.getByTestId("change-range"));
    fireEvent.press(screen.getByTestId("change-range"));

    // No fetch before the debounce window fires.
    expect(mockLoadRange).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    // One debounced resolution => six collection loads, not 18.
    expect(mockLoadRange).toHaveBeenCalledTimes(6);
    jest.useRealTimers();
  });

  it("resolves the selected range before exporting", async () => {
    render(<ExportScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("export-button").props.accessibilityState.disabled).toBe(false);
    });

    // The export path must invoke the resolver itself, not rely on the earlier count load.
    mockExportToCSV.mockImplementation(async (options: { ensureRangesLoaded: () => Promise<void> }) => {
      await options.ensureRangesLoaded();
      return { success: true, content: "csv", fileName: "export.csv" };
    });

    mockLoadRange.mockClear();
    mockShareCSV.mockClear();

    fireEvent.press(screen.getByTestId("export-button"));

    await waitFor(() => {
      expect(mockExportToCSV).toHaveBeenCalled();
      expect(mockLoadRange).toHaveBeenCalledTimes(6);
      expect(mockShareCSV).toHaveBeenCalledWith("csv", "export.csv");
    });

    const expectedEnd = new Date();
    expectedEnd.setHours(23, 59, 59, 999);
    const expectedStart = new Date();
    expectedStart.setHours(0, 0, 0, 0);
    expectedStart.setDate(expectedStart.getDate() - 29);

    for (const call of mockLoadRange.mock.calls) {
      const range = call[0] as { start: string; end: string };
      expect(Date.parse(range.start)).toBe(expectedStart.getTime());
      expect(Date.parse(range.end)).toBe(expectedEnd.getTime() + 1);
    }
  });

  it("uses the latest unit preferences when exporting after a settings change", async () => {
    const { rerender } = render(<ExportScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("export-button").props.accessibilityState.disabled).toBe(false);
    });

    mockUnits = {
      volumeUnit: "oz",
      weightUnit: "lbs",
      heightUnit: "in",
    };
    rerender(<ExportScreen />);

    fireEvent.press(screen.getByTestId("export-button"));

    await waitFor(() => {
      expect(mockExportToCSV).toHaveBeenCalledWith(
        expect.objectContaining({
          volumeUnit: "oz",
          weightUnit: "lbs",
          heightUnit: "in",
        })
      );
    });
  });
});