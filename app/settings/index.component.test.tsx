import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Linking, Platform } from "react-native";

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
        "settings.rateApp": "Rate App",
      }[key] ?? key),
  }),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "9.9.9" } },
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

  it("shows the app version from Expo configuration", () => {
    render(<SettingsScreen />);

    expect(screen.getByText("9.9.9")).toBeTruthy();
  });

  it("opens the App Store write-review page from Rate App on iOS", () => {
    const originalPlatformOS = Platform.OS;
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);

    try {
      Object.defineProperty(Platform, "OS", {
        value: "ios",
        configurable: true,
      });
      render(<SettingsScreen />);

      fireEvent.press(screen.getByTestId("rate-app-setting"));

      expect(openURL).toHaveBeenCalledTimes(1);
      expect(openURL).toHaveBeenCalledWith(
        "itms-apps://apps.apple.com/app/id6758142736?action=write-review"
      );
    } finally {
      Object.defineProperty(Platform, "OS", {
        value: originalPlatformOS,
        configurable: true,
      });
      openURL.mockRestore();
    }
  });

  it("contains an App Store URL failure without surfacing a rejection", async () => {
    const originalPlatformOS = Platform.OS;
    const failure = new Error("App Store unavailable");
    const openURL = jest.spyOn(Linking, "openURL").mockRejectedValue(failure);
    const logError = jest.spyOn(console, "error").mockImplementation(() => {});

    try {
      Object.defineProperty(Platform, "OS", {
        value: "ios",
        configurable: true,
      });
      render(<SettingsScreen />);

      fireEvent.press(screen.getByTestId("rate-app-setting"));

      await waitFor(() => {
        expect(logError).toHaveBeenCalledWith(
          "[StoreReview] Manual review URL failed",
          failure
        );
      });
    } finally {
      Object.defineProperty(Platform, "OS", {
        value: originalPlatformOS,
        configurable: true,
      });
      logError.mockRestore();
      openURL.mockRestore();
    }
  });

  it("opens the Play Store app directly when it is available", () => {
    const selectPlatform = jest
      .spyOn(Platform, "select")
      .mockImplementation((options) => options.android);
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);

    try {
      render(<SettingsScreen />);

      fireEvent.press(screen.getByTestId("rate-app-setting"));

      expect(openURL).toHaveBeenCalledTimes(1);
      expect(openURL).toHaveBeenCalledWith(
        "market://details?id=com.sofibaby.app"
      );
    } finally {
      selectPlatform.mockRestore();
      openURL.mockRestore();
    }
  });

  it("falls back to the Play Store website when the Android app cannot open", async () => {
    const selectPlatform = jest
      .spyOn(Platform, "select")
      .mockImplementation((options) => options.android);
    const openURL = jest
      .spyOn(Linking, "openURL")
      .mockRejectedValueOnce(new Error("Play Store unavailable"))
      .mockResolvedValueOnce(true);

    try {
      render(<SettingsScreen />);

      fireEvent.press(screen.getByTestId("rate-app-setting"));

      await waitFor(() => {
        expect(openURL).toHaveBeenNthCalledWith(
          1,
          "market://details?id=com.sofibaby.app"
        );
        expect(openURL).toHaveBeenNthCalledWith(
          2,
          "https://play.google.com/store/apps/details?id=com.sofibaby.app"
        );
      });
    } finally {
      selectPlatform.mockRestore();
      openURL.mockRestore();
    }
  });
});
