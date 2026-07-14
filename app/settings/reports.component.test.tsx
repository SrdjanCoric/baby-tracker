import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

const mockGenerateReport = jest.fn();
const mockShareReport = jest.fn();

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

jest.mock("@/contexts", () => ({
  useBaby: () => ({
    selectedBaby: {
      id: "baby-1",
      name: "Sofi",
      birthDate: "2026-01-01",
      gender: "female",
    },
  }),
  useUnits: () => mockUnits,
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
    mockGenerateReport.mockResolvedValue({
      success: true,
      filePath: "/tmp/report.pdf",
      fileName: "report.pdf",
    });
    mockShareReport.mockResolvedValue(undefined);
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
