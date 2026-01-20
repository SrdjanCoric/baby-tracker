import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import ThemeSettingsScreen from "./theme";

const mockSetThemePreference = jest.fn();
const mockBack = jest.fn();

jest.mock("@/contexts/theme-context", () => ({
  useTheme: () => ({
    preference: "system",
    resolvedMode: "light",
    isDark: false,
    isLoading: false,
    setThemePreference: mockSetThemePreference,
  }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

describe("ThemeSettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders all theme options including night mode", () => {
      render(<ThemeSettingsScreen />);

      expect(screen.getByText("System Default")).toBeTruthy();
      expect(screen.getByText("Light Mode")).toBeTruthy();
      expect(screen.getByText("Dark Mode")).toBeTruthy();
      expect(screen.getByText("Night Mode")).toBeTruthy();
    });

    it("renders theme option descriptions", () => {
      render(<ThemeSettingsScreen />);

      expect(screen.getByText("Follow system setting")).toBeTruthy();
      expect(screen.getByText("Always use light theme")).toBeTruthy();
      expect(screen.getByText("Always use dark theme")).toBeTruthy();
      expect(screen.getByText("Dim red light for nighttime")).toBeTruthy();
    });

    it("renders the page title", () => {
      render(<ThemeSettingsScreen />);

      expect(screen.getByText("Appearance")).toBeTruthy();
    });

    it("renders theme icons", () => {
      render(<ThemeSettingsScreen />);

      expect(screen.getByText("📱")).toBeTruthy();
      expect(screen.getByText("☀️")).toBeTruthy();
      expect(screen.getByText("🌙")).toBeTruthy();
      expect(screen.getByText("🌃")).toBeTruthy();
    });

    it("shows checkmark for selected theme option", () => {
      render(<ThemeSettingsScreen />);

      const checkmarks = screen.getAllByText("✓");
      expect(checkmarks.length).toBe(1);
    });
  });

  describe("selection state", () => {
    it("shows checkmark only for selected option", () => {
      render(<ThemeSettingsScreen />);

      const checkmarks = screen.getAllByText("✓");
      expect(checkmarks).toHaveLength(1);
    });
  });

  describe("interactions", () => {
    it("calls setThemePreference when light mode is selected", async () => {
      render(<ThemeSettingsScreen />);

      const lightOption = screen.getByText("Light Mode").parent?.parent;
      fireEvent.press(lightOption!);

      await waitFor(() => {
        expect(mockSetThemePreference).toHaveBeenCalledWith("light");
      });
    });

    it("calls setThemePreference when dark mode is selected", async () => {
      render(<ThemeSettingsScreen />);

      const darkOption = screen.getByText("Dark Mode").parent?.parent;
      fireEvent.press(darkOption!);

      await waitFor(() => {
        expect(mockSetThemePreference).toHaveBeenCalledWith("dark");
      });
    });

    it("calls setThemePreference when night mode is selected", async () => {
      render(<ThemeSettingsScreen />);

      const nightOption = screen.getByText("Night Mode").parent?.parent;
      fireEvent.press(nightOption!);

      await waitFor(() => {
        expect(mockSetThemePreference).toHaveBeenCalledWith("night");
      });
    });

    it("calls router.back when back button is pressed", () => {
      render(<ThemeSettingsScreen />);

      const backButton = screen.getByLabelText("Back");
      fireEvent.press(backButton);

      expect(mockBack).toHaveBeenCalled();
    });
  });

  describe("current mode display", () => {
    it("displays current theme mode info", () => {
      render(<ThemeSettingsScreen />);

      expect(screen.getByText(/Currently using/)).toBeTruthy();
    });
  });
});
