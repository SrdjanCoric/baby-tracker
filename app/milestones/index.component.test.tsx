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
        "milestones.title": "Milestones",
      }[key] ?? key),
  }),
}));

jest.mock("@/contexts", () => ({
  useMilestones: () => ({
    setMilestoneState: jest.fn(),
    clearMilestoneState: jest.fn(),
    getMilestoneState: () => "not_sure",
    getYesCountForAge: () => 0,
    getTotalCountForAge: () => 4,
    isAgeCompleted: () => false,
  }),
  useBaby: () => ({ selectedBaby: { id: "baby-1", name: "Sofi", birthDate: "2025-01-01" } }),
}));

jest.mock("@/components/MilestoneCelebrationModal", () => ({
  MilestoneCelebrationModal: () => null,
}));

import MilestonesScreen from "./index";

describe("MilestonesScreen close control", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack = false;
  });

  it("returns a cold-opened milestones screen to the tabs through the close control", () => {
    render(<MilestonesScreen />);

    fireEvent.press(screen.getByRole("button", { name: "Close" }));

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("returns to the previous screen when a caregiver closes milestones with history", () => {
    mockCanGoBack = true;
    render(<MilestonesScreen />);

    fireEvent.press(screen.getByRole("button", { name: "Close" }));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});