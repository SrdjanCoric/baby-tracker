import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import NewOwnerWelcomeScreen from "./index";

const mockPush = jest.fn();
const mockSetLanguage = jest.fn();
const mockBeginOwnerPath = jest.fn();
const mockUpdateLanguage = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/contexts", () => ({
  useLanguage: () => ({
    language: "en",
    resolvedLanguage: "en",
    setLanguage: mockSetLanguage,
  }),
}));

jest.mock("@/services/new-owner-onboarding-storage", () => ({
  NewOwnerOnboardingStorageService: {
    beginOwnerPath: (...args: unknown[]) => mockBeginOwnerPath(...args),
    updateLanguage: (...args: unknown[]) => mockUpdateLanguage(...args),
  },
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      "newOwnerOnboarding.welcome.title": "Care for your baby with confidence",
      "newOwnerOnboarding.welcome.promise": "Track feeding, sleep, diapers, and more—on your own or together with family.",
      "newOwnerOnboarding.welcome.startTracking": "Start tracking",
      "newOwnerOnboarding.welcome.joinFamily": "Join a family",
      "newOwnerOnboarding.welcome.signIn": "Sign in",
      "newOwnerOnboarding.welcome.language": "Language: English",
      "settings.english": "English",
      "settings.german": "German",
    }[key] ?? key),
  }),
}));

describe("NewOwnerWelcomeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetLanguage.mockResolvedValue(undefined);
    mockBeginOwnerPath.mockResolvedValue(undefined);
    mockUpdateLanguage.mockResolvedValue(undefined);
  });

  it("shows the product promise and starts the guest owner path", async () => {
    render(<NewOwnerWelcomeScreen />);

    expect(screen.getByText("Care for your baby with confidence")).toBeTruthy();
    expect(screen.getByText("Track feeding, sleep, diapers, and more—on your own or together with family.")).toBeTruthy();
    expect(screen.getByText("Join a family")).toBeTruthy();
    expect(screen.getByText("Sign in")).toBeTruthy();

    fireEvent.press(screen.getByTestId("start-tracking-button"));

    await waitFor(() => {
      expect(mockBeginOwnerPath).toHaveBeenCalledWith("en");
      expect(mockPush).toHaveBeenCalledWith("/onboarding/owner/baby");
    });
  });

  it("applies and persists a language choice immediately", async () => {
    render(<NewOwnerWelcomeScreen />);

    fireEvent.press(screen.getByTestId("current-language-button"));
    fireEvent.press(screen.getByTestId("welcome-language-de"));

    await waitFor(() => {
      expect(mockSetLanguage).toHaveBeenCalledWith("de");
      expect(mockUpdateLanguage).toHaveBeenCalledWith("de");
    });
  });
});
