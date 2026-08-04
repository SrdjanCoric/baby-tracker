import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = false;

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    canGoBack: () => mockCanGoBack,
    replace: mockReplace,
    push: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "common.close": "Close",
        "health.logHealth": "Log health",
      }[key] ?? key),
  }),
}));

jest.mock("@/contexts/health-context", () => ({
  useHealth: () => ({
    addHealth: jest.fn().mockResolvedValue(undefined),
    healthEntries: [],
    getCompletedVaccinations: () => [],
  }),
}));

jest.mock("@/contexts", () => ({
  useBaby: () => ({ selectedBaby: { id: "baby-1", name: "Sofi", birthDate: "2025-01-01" } }),
  useUnits: () => ({ weightUnit: "kg", heightUnit: "cm", volumeUnit: "ml", temperatureUnit: "c" }),
}));

jest.mock("@/components/NoBabyScreen", () => ({
  NoBabyScreen: () => null,
}));

import HealthScreen from "./index";

describe("HealthScreen close control", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack = false;
  });

  it("returns a cold-opened health screen to the tabs through the close control", () => {
    render(<HealthScreen />);

    fireEvent.press(screen.getByRole("button", { name: "Close" }));

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("returns to the previous screen when a caregiver closes health with history", () => {
    mockCanGoBack = true;
    render(<HealthScreen />);

    fireEvent.press(screen.getByRole("button", { name: "Close" }));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});