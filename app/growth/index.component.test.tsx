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
        "growth.logMeasurement": "Log measurement",
      }[key] ?? key),
  }),
}));

jest.mock("@/contexts/growth-context", () => ({
  useGrowth: () => ({ addMeasurement: jest.fn().mockResolvedValue(undefined) }),
}));

jest.mock("@/contexts", () => ({
  useBaby: () => ({ selectedBaby: { id: "baby-1", name: "Sofi", birthDate: "2025-01-01" } }),
  useUnits: () => ({ weightUnit: "kg", heightUnit: "cm", volumeUnit: "ml" }),
  useTimeFormat: () => ({ timeFormat: "12h" }),
}));

jest.mock("@/components/NoBabyScreen", () => ({
  NoBabyScreen: () => null,
}));

jest.mock("@react-native-community/datetimepicker", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => <View testID="datetime-picker" {...props} />,
  };
});

import GrowthScreen from "./index";

describe("GrowthScreen close control", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack = false;
  });

  it("returns a cold-opened growth screen to the tabs through the close control", () => {
    render(<GrowthScreen />);

    fireEvent.press(screen.getByRole("button", { name: "Close" }));

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("returns to the previous screen when a caregiver closes growth with history", () => {
    mockCanGoBack = true;
    render(<GrowthScreen />);

    fireEvent.press(screen.getByRole("button", { name: "Close" }));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});