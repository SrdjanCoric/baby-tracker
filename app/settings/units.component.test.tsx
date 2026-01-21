import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import UnitsSettingsScreen from "./units";

const mockSetUnitSystem = jest.fn();
const mockBack = jest.fn();

jest.mock("@/contexts/unit-context", () => ({
  useUnits: () => ({
    unitSystem: "metric",
    weightUnit: "kg",
    heightUnit: "cm",
    volumeUnit: "ml",
    isLoading: false,
    setUnitSystem: mockSetUnitSystem,
  }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

describe("UnitsSettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders all unit options", () => {
      render(<UnitsSettingsScreen />);

      expect(screen.getByText("Metric (kg, cm, ml)")).toBeTruthy();
      expect(screen.getByText("Imperial (lbs, in, oz)")).toBeTruthy();
    });

    it("renders unit option descriptions", () => {
      render(<UnitsSettingsScreen />);

      expect(screen.getByText("kg, cm, ml")).toBeTruthy();
      expect(screen.getByText("lbs, in, oz")).toBeTruthy();
    });

    it("renders the page title", () => {
      render(<UnitsSettingsScreen />);

      expect(screen.getByText("Units")).toBeTruthy();
    });

    it("renders unit icons", () => {
      render(<UnitsSettingsScreen />);

      expect(screen.getByText("🌍")).toBeTruthy();
      expect(screen.getByText("🇺🇸")).toBeTruthy();
    });

    it("shows checkmark for selected unit option", () => {
      render(<UnitsSettingsScreen />);

      const checkmarks = screen.getAllByText("✓");
      expect(checkmarks.length).toBe(1);
    });
  });

  describe("selection state", () => {
    it("shows checkmark only for selected option", () => {
      render(<UnitsSettingsScreen />);

      const checkmarks = screen.getAllByText("✓");
      expect(checkmarks).toHaveLength(1);
    });
  });

  describe("interactions", () => {
    it("calls setUnitSystem when imperial is selected", async () => {
      render(<UnitsSettingsScreen />);

      const imperialOption = screen.getByText("Imperial (lbs, in, oz)").parent?.parent;
      fireEvent.press(imperialOption!);

      await waitFor(() => {
        expect(mockSetUnitSystem).toHaveBeenCalledWith("imperial");
      });
    });

    it("calls setUnitSystem when metric is selected", async () => {
      render(<UnitsSettingsScreen />);

      const metricOption = screen.getByText("Metric (kg, cm, ml)").parent?.parent;
      fireEvent.press(metricOption!);

      await waitFor(() => {
        expect(mockSetUnitSystem).toHaveBeenCalledWith("metric");
      });
    });

    it("calls router.back when back button is pressed", () => {
      render(<UnitsSettingsScreen />);

      const backButton = screen.getByLabelText("Back");
      fireEvent.press(backButton);

      expect(mockBack).toHaveBeenCalled();
    });
  });
});
