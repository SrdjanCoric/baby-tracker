import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockAddDiaper = jest.fn();
let mockCanGoBack = false;

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    canGoBack: () => mockCanGoBack,
    push: jest.fn(),
    replace: mockReplace,
  }),
  useLocalSearchParams: () => ({}),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      "common.close": "Close",
      "diaper.logDiaperChange": "Diaper",
    }[key] ?? key),
  }),
}));

jest.mock("@/contexts/diaper-context", () => ({
  useDiaper: () => ({ addDiaper: mockAddDiaper }),
}));

jest.mock("@/contexts", () => ({
  useBaby: () => ({ selectedBaby: { id: "baby-1", name: "Sofi" } }),
}));

jest.mock("@/services/new-owner-onboarding-storage", () => ({
  NewOwnerOnboardingStorageService: { markActivitySaved: jest.fn() },
}));

import DiaperScreen from "./index";

describe("DiaperScreen exits", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack = false;
    mockAddDiaper.mockResolvedValue({ id: "diaper-1" });
  });

  it("lets a caregiver close a cold-opened diaper screen", () => {
    render(<DiaperScreen />);

    fireEvent.press(screen.getByRole("button", { name: "Close" }));

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("returns to tabs after saving from a cold-opened diaper screen", async () => {
    render(<DiaperScreen />);
    fireEvent.press(screen.getByTestId("type-wet"));
    fireEvent.press(screen.getByTestId("save-button"));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    });
    expect(mockBack).not.toHaveBeenCalled();
  });
});
