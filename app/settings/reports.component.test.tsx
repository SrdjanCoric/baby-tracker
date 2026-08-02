import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

const mockGenerateReport = jest.fn();
const mockShareReport = jest.fn();
const mockLoadRange = jest.fn(async () => {});

let mockUser: { id: string | null; householdId: string | null } = {
  id: "user-1",
  householdId: "household-1",
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
  useAuth: () => ({ user: mockUser }),
  // The resolver goes through the shared context loaders; every collection
  // delegates to one spy so the six-collection assertions below stay readable.
  useFeeding: () => ({ loadFeedingRange: mockLoadRange }),
  useSleep: () => ({ loadSleepRange: mockLoadRange }),
  useDiaper: () => ({ loadDiaperRange: mockLoadRange }),
  usePumping: () => ({ loadPumpingRange: mockLoadRange }),
  useGrowth: () => ({ loadGrowthRange: mockLoadRange }),
  useTummyTime: () => ({ loadTummyTimeRange: mockLoadRange }),
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
    mockUser = { id: "user-1", householdId: "household-1" };
    mockUnits = {
      weightUnit: "kg",
      heightUnit: "cm",
    };
    mockLoadRange.mockClear();
    mockLoadRange.mockImplementation(async () => {});
    mockGenerateReport.mockResolvedValue({
      success: true,
      filePath: "/tmp/report.pdf",
      fileName: "report.pdf",
    });
    mockShareReport.mockResolvedValue(undefined);
  });

  it("resolves the selected range for every report collection before generating", async () => {
    mockGenerateReport.mockImplementation(
      async (options: { ensureRangesLoaded: () => Promise<void> }) => {
        await options.ensureRangesLoaded();
        return { success: true, filePath: "/tmp/report.pdf", fileName: "report.pdf" };
      }
    );

    render(<ReportsScreen />);

    fireEvent.press(screen.getByTestId("generate-report-button"));

    await waitFor(() => {
      expect(mockLoadRange).toHaveBeenCalledTimes(6);
      expect(mockShareReport).toHaveBeenCalledWith("/tmp/report.pdf", "report.pdf");
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

  it("shows the failure alert when report generation fails", async () => {
    // The PDF service maps a failed range read to { success: false, errorKind: "rangeLoad" }.
    // That mapping is proved in pdf-service.test.ts; here we only assert the screen surfaces it.
    mockGenerateReport.mockResolvedValue({
      success: false,
      error: "Failed to fetch activity range",
      errorKind: "rangeLoad",
    });
    const alertSpy = jest.spyOn(require("react-native").Alert, "alert");

    render(<ReportsScreen />);

    fireEvent.press(screen.getByTestId("generate-report-button"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "reports.generateFailed",
        "reports.rangeLoadError"
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