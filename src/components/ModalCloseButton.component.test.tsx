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
  }),
}));

import { ModalCloseButton } from "./ModalCloseButton";

describe("ModalCloseButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack = false;
  });

  it("returns a cold-opened modal to the tabs when there is no history", () => {
    render(<ModalCloseButton accessibilityLabel="Close" testID="close-modal" />);

    fireEvent.press(screen.getByRole("button", { name: "Close" }));

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("returns a normally opened modal to the previous screen", () => {
    mockCanGoBack = true;
    render(<ModalCloseButton accessibilityLabel="Close" testID="close-modal" />);

    fireEvent.press(screen.getByRole("button", { name: "Close" }));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
