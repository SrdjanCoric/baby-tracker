import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import SettingsScreen from "./settings";

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

jest.mock("expo-constants", () => ({
  expoConfig: {
    version: "0.1.0",
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "common.back": "Back",
        "settings.units": "Units",
        "settings.theme": "Theme",
        "settings.metric": "Metric",
        "settings.imperial": "Imperial",
        "settings.systemDefault": "System",
        "settings.lightMode": "Light",
        "settings.darkMode": "Dark",
        "settings.nightMode": "Night",
        "settings.notifications": "Notifications",
        "settings.export": "Export Data",
        "settings.about": "About",
        "settings.privacyPolicy": "Privacy Policy",
        "settings.version": "Version",
        "baby.title": "Baby",
        "household.title": "Household",
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@/contexts", () => ({
  useUnits: () => ({
    unitSystem: "metric",
    weightUnit: "kg",
    heightUnit: "cm",
    volumeUnit: "ml",
    isLoading: false,
    setUnitSystem: jest.fn(),
  }),
  useTheme: () => ({
    preference: "system",
    resolvedMode: "light",
    isDark: false,
  }),
}));

describe("SettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders Units row", () => {
      render(<SettingsScreen />);
      expect(screen.getByText("Units")).toBeTruthy();
    });

    it("renders Theme row", () => {
      render(<SettingsScreen />);
      expect(screen.getByText("Theme")).toBeTruthy();
    });

    it("renders About row", () => {
      render(<SettingsScreen />);
      expect(screen.getByText("About")).toBeTruthy();
    });

    it("shows current unit preference (Metric)", () => {
      render(<SettingsScreen />);
      expect(screen.getByText("Metric")).toBeTruthy();
    });
  });

  describe("navigation", () => {
    it("navigates to units screen when Units is pressed", () => {
      render(<SettingsScreen />);

      const unitsRow = screen.getByText("Units").parent?.parent;
      fireEvent.press(unitsRow!);

      expect(mockPush).toHaveBeenCalledWith("/settings/units");
    });

    it("navigates to theme screen when Theme is pressed", () => {
      render(<SettingsScreen />);

      const themeRow = screen.getByText("Theme").parent?.parent;
      fireEvent.press(themeRow!);

      expect(mockPush).toHaveBeenCalledWith("/settings/theme");
    });

    it("navigates to about screen when About is pressed", () => {
      render(<SettingsScreen />);

      const aboutRow = screen.getByText("About").parent?.parent;
      fireEvent.press(aboutRow!);

      expect(mockPush).toHaveBeenCalledWith("/settings/about");
    });

    it("navigates to baby screen when Baby is pressed", () => {
      render(<SettingsScreen />);

      const babyRow = screen.getByText("Baby").parent?.parent;
      fireEvent.press(babyRow!);

      expect(mockPush).toHaveBeenCalledWith("/baby/add");
    });
  });
});
