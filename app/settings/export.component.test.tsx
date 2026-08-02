import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

const mockExportToCSV = jest.fn();
const mockShareCSV = jest.fn();
const mockGetRecordCountsInRange = jest.fn();

const mockLoadRanges = {
  feeding: jest.fn(async () => {}),
  sleep: jest.fn(async () => {}),
  diapers: jest.fn(async () => {}),
  pumping: jest.fn(async () => {}),
  growth: jest.fn(async () => {}),
  tummyTime: jest.fn(async () => {}),
};

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
  useFeeding: () => ({ loadFeedingRange: mockLoadRanges.feeding }),
  useSleep: () => ({ loadSleepRange: mockLoadRanges.sleep }),
  useDiaper: () => ({ loadDiaperRange: mockLoadRanges.diapers }),
  usePumping: () => ({ loadPumpingRange: mockLoadRanges.pumping }),
  useGrowth: () => ({ loadGrowthRange: mockLoadRanges.growth }),
  useTummyTime: () => ({ loadTummyTimeRange: mockLoadRanges.tummyTime }),
}));

jest.mock("@/components/export", () => ({
  DataTypeSelector: () => null,
  DateRangePicker: () => null,
}));

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
    mockUnits = {
      volumeUnit: "ml",
      weightUnit: "kg",
      heightUnit: "cm",
    };
    for (const loadRange of Object.values(mockLoadRanges)) {
      loadRange.mockClear();
      loadRange.mockImplementation(async () => {});
    }
    mockGetRecordCountsInRange.mockResolvedValue({
      feedings: 1,
      sleep: 0,
      diapers: 0,
      pumping: 0,
      growth: 0,
      tummyTime: 0,
      health: 0,
    });
    mockExportToCSV.mockResolvedValue({
      success: true,
      content: "csv",
      fileName: "export.csv",
    });
    mockShareCSV.mockResolvedValue(undefined);
  });

  it("resolves every collection's selected range before loading record counts", async () => {
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
        };
      }
    );

    render(<ExportScreen />);

    await waitFor(() => {
      expect(screen.getByText("export.recordsSummary")).toBeTruthy();
    });

    const expectedEnd = new Date();
    expectedEnd.setHours(23, 59, 59, 999);
    const expectedStart = new Date();
    expectedStart.setHours(0, 0, 0, 0);
    expectedStart.setDate(expectedStart.getDate() - 29);

    for (const loadRange of Object.values(mockLoadRanges)) {
      expect(loadRange).toHaveBeenCalledTimes(1);
      const range = loadRange.mock.calls[0][0] as { start: string; end: string };
      expect(Date.parse(range.start)).toBe(expectedStart.getTime());
      expect(Date.parse(range.end)).toBe(expectedEnd.getTime() + 1);
    }
  });

  it("shows an error and retries when range resolution fails", async () => {
    mockLoadRanges.feeding.mockRejectedValueOnce(new Error("Failed to fetch activity range"));
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
        };
      }
    );

    render(<ExportScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("export-range-error")).toBeTruthy();
    });
    expect(screen.queryByText("export.recordsSummary")).toBeNull();

    fireEvent.press(screen.getByTestId("export-range-retry"));

    await waitFor(() => {
      expect(screen.getByText("export.recordsSummary")).toBeTruthy();
    });
    expect(screen.queryByTestId("export-range-error")).toBeNull();
  });

  it("resolves the selected range before exporting", async () => {
    render(<ExportScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("export-button").props.accessibilityState.disabled).toBe(false);
    });

    for (const loadRange of Object.values(mockLoadRanges)) loadRange.mockClear();

    fireEvent.press(screen.getByTestId("export-button"));

    await waitFor(() => {
      expect(mockExportToCSV).toHaveBeenCalled();
    });

    const options = mockExportToCSV.mock.calls[0][0] as {
      ensureRangesLoaded: () => Promise<void>;
    };
    expect(typeof options.ensureRangesLoaded).toBe("function");

    await options.ensureRangesLoaded();

    for (const loadRange of Object.values(mockLoadRanges)) {
      expect(loadRange).toHaveBeenCalledWith({
        start: expect.any(String),
        end: expect.any(String),
      });
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
