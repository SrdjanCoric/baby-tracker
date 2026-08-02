import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

const mockGenerateReport = jest.fn();
const mockShareReport = jest.fn();

const mockLoadRanges = {
  feeding: jest.fn(async () => {}),
  sleep: jest.fn(async () => {}),
  diapers: jest.fn(async () => {}),
  pumping: jest.fn(async () => {}),
  growth: jest.fn(async () => {}),
  tummyTime: jest.fn(async () => {}),
};

let mockUnits: {
  weightUnit: "kg" | "lbs";
  heightUnit: "cm" | "in";
} = {
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
  birthDate: "2026-01-01",
  gender: "female",
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

jest.mock("@/components/reports", () => ({
  SectionSelector: () => null,
}));

jest.mock("@/components/export", () => ({
  DateRangePicker: () => null,
}));

jest.mock("@/services/pdf-service", () => ({
  PDFService: {
    generateReport: (options: unknown) => mockGenerateReport(options),
    shareReport: (filePath: string, fileName: string) =>
      mockShareReport(filePath, fileName),
  },
}));

import ReportsScreen from "./reports";

describe("ReportsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUnits = {
      weightUnit: "kg",
      heightUnit: "cm",
    };
    for (const loadRange of Object.values(mockLoadRanges)) {
      loadRange.mockClear();
      loadRange.mockImplementation(async () => {});
    }
    mockGenerateReport.mockResolvedValue({
      success: true,
      filePath: "/tmp/report.pdf",
      fileName: "report.pdf",
    });
    mockShareReport.mockResolvedValue(undefined);
  });

  it("resolves the selected range for every report collection before generating", async () => {
    render(<ReportsScreen />);

    fireEvent.press(screen.getByTestId("generate-report-button"));

    await waitFor(() => {
      expect(mockGenerateReport).toHaveBeenCalled();
    });

    const options = mockGenerateReport.mock.calls[0][0] as {
      ensureRangesLoaded: () => Promise<void>;
    };
    expect(typeof options.ensureRangesLoaded).toBe("function");

    await options.ensureRangesLoaded();

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

  it("reports failure when range resolution fails before generating", async () => {
    mockLoadRanges.sleep.mockRejectedValueOnce(new Error("Failed to fetch activity range"));
    mockGenerateReport.mockImplementation(
      async (options: { ensureRangesLoaded: () => Promise<void> }) => {
        try {
          await options.ensureRangesLoaded();
          return { success: true, filePath: "/tmp/report.pdf", fileName: "report.pdf" };
        } catch (error) {
          return { success: false, error: (error as Error).message };
        }
      }
    );
    const alertSpy = jest.spyOn(require("react-native").Alert, "alert");

    render(<ReportsScreen />);

    fireEvent.press(screen.getByTestId("generate-report-button"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "reports.generateFailed",
        "Failed to fetch activity range"
      );
    });
    expect(mockShareReport).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("uses the latest unit preferences when generating a report", async () => {
    const { rerender } = render(<ReportsScreen />);

    mockUnits = {
      weightUnit: "lbs",
      heightUnit: "in",
    };
    rerender(<ReportsScreen />);

    fireEvent.press(screen.getByTestId("generate-report-button"));

    await waitFor(() => {
      expect(mockGenerateReport).toHaveBeenCalledWith(
        expect.objectContaining({
          weightUnit: "lbs",
          heightUnit: "in",
        })
      );
    });
  });
});
