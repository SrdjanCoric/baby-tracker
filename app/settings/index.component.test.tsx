import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockDismissAll = jest.fn();
let mockCanGoBack = false;

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    canGoBack: () => mockCanGoBack,
    replace: mockReplace,
    push: mockPush,
  }),
  router: {
    push: mockPush,
    dismissAll: mockDismissAll,
    replace: mockReplace,
    back: mockBack,
  },
  useLocalSearchParams: () => ({}),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "common.close": "Close",
        "navigation.settings": "Settings",
        "settings.preferences": "Preferences",
      }[key] ?? key),
  }),
}));

jest.mock("@/contexts", () => ({
  useTheme: () => ({ theme: "system", setThemePreference: jest.fn(), isDark: false }),
  useUnits: () => ({ unitSystem: "metric", weightUnit: "kg", heightUnit: "cm", volumeUnit: "ml" }),
  useTimeFormat: () => ({ timeFormat: "12h" }),
  useAuth: () => ({ isAuthenticated: false, user: null, signOut: jest.fn() }),
  useLanguage: () => ({ language: "en", resolvedLanguage: "en", setLanguage: jest.fn() }),
}));

jest.mock("@/components/settings/DevelopmentOnboardingTools", () => ({
  DevelopmentOnboardingTools: () => null,
}));

import SettingsScreen from "./index";

describe("SettingsScreen close control", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack = false;
  });

  it("returns a cold-opened settings screen to the tabs through the close control", () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByRole("button", { name: "Close" }));

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("returns to the previous screen when a caregiver closes settings with history", () => {
    mockCanGoBack = true;
    render(<SettingsScreen />);

    fireEvent.press(screen.getByRole("button", { name: "Close" }));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});