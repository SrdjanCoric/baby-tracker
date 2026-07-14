import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

const mockExportToCSV = jest.fn();
const mockShareCSV = jest.fn();
const mockGetRecordCountsInRange = jest.fn();

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

jest.mock("@/contexts", () => ({
  useBaby: () => ({
    selectedBaby: {
      id: "baby-1",
      name: "Sofi",
    },
  }),
  useUnits: () => mockUnits,
}));

jest.mock("@/components/export", () => ({
  DataTypeSelector: () => null,
  DateRangePicker: () => null,
}));

jest.mock("@/services/export-service", () => ({
  ExportService: {
    exportToCSV: (options: unknown) => mockExportToCSV(options),
    shareCSV: (content: string, fileName: string) => mockShareCSV(content, fileName),
    getRecordCountsInRange: (babyId: string, startDate: Date, endDate: Date) =>
      mockGetRecordCountsInRange(babyId, startDate, endDate),
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
