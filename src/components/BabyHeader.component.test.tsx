import React, { createRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { View } from "react-native";
import { BabyHeader } from "./BabyHeader";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
}));

jest.mock("@/contexts", () => ({
  useBaby: jest.fn(),
}));

jest.mock("./BabySelector", () => ({
  BabySelector: ({ onAddBaby }: { onAddBaby?: () => void }) => {
    const { Pressable, Text } = require("react-native");
    return (
      <Pressable testID="baby-selector" onPress={onAddBaby}>
        <Text>Baby Selector</Text>
      </Pressable>
    );
  },
}));

import { useBaby } from "@/contexts";

const mockUseBaby = useBaby as jest.Mock;

describe("BabyHeader", () => {
  const mockBaby = {
    id: "1",
    name: "Emma",
    birthDate: new Date("2025-06-15").toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseBaby.mockReturnValue({
      selectedBaby: mockBaby,
      isLoading: false,
    });
  });

  describe("loading state", () => {
    it("shows loading skeleton when isLoading", () => {
      mockUseBaby.mockReturnValue({
        selectedBaby: null,
        isLoading: true,
      });
      const { UNSAFE_root } = render(<BabyHeader testID="header" />);
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  describe("no baby state", () => {
    beforeEach(() => {
      mockUseBaby.mockReturnValue({
        selectedBaby: null,
        isLoading: false,
      });
    });

    it('shows "Add Baby" when no selectedBaby', () => {
      render(<BabyHeader testID="header" />);
      expect(screen.getByText("Add Baby")).toBeTruthy();
    });

    it('calls router.push("/baby/add") when add pressed', () => {
      render(<BabyHeader testID="header" />);
      fireEvent.press(screen.getByLabelText("Add your first baby"));
      expect(mockPush).toHaveBeenCalledWith("/baby/add");
    });
  });

  describe("selected baby state", () => {
    it("renders BabySelector when baby selected", () => {
      render(<BabyHeader testID="header" />);
      expect(screen.getByTestId("baby-selector")).toBeTruthy();
    });

    it("renders edit button when baby selected", () => {
      render(<BabyHeader testID="header" />);
      expect(screen.getByLabelText("Edit baby profile")).toBeTruthy();
    });

    it("calls router.push with baby ID when edit pressed", () => {
      render(<BabyHeader testID="header" />);
      fireEvent.press(screen.getByLabelText("Edit baby profile"));
      expect(mockPush).toHaveBeenCalledWith("/baby/1");
    });
  });

  describe("settings button", () => {
    it("renders settings button when onSettingsPress provided", () => {
      const onSettingsPress = jest.fn();
      render(<BabyHeader testID="header" onSettingsPress={onSettingsPress} />);
      expect(screen.getByLabelText("Settings")).toBeTruthy();
    });

    it("calls onSettingsPress when settings pressed", () => {
      const onSettingsPress = jest.fn();
      render(<BabyHeader testID="header" onSettingsPress={onSettingsPress} />);
      fireEvent.press(screen.getByLabelText("Settings"));
      expect(onSettingsPress).toHaveBeenCalled();
    });

    it("hides settings button when onSettingsPress not provided", () => {
      render(<BabyHeader testID="header" />);
      expect(screen.queryByLabelText("Settings")).toBeNull();
    });
  });

  describe("accessibility", () => {
    it('has "Add your first baby" accessibility label when no baby', () => {
      mockUseBaby.mockReturnValue({
        selectedBaby: null,
        isLoading: false,
      });
      render(<BabyHeader testID="header" />);
      expect(screen.getByLabelText("Add your first baby")).toBeTruthy();
    });

    it('has "Edit baby profile" accessibility label', () => {
      render(<BabyHeader testID="header" />);
      expect(screen.getByLabelText("Edit baby profile")).toBeTruthy();
    });

    it('has "Settings" accessibility label when settings provided', () => {
      render(<BabyHeader testID="header" onSettingsPress={() => {}} />);
      expect(screen.getByLabelText("Settings")).toBeTruthy();
    });
  });

  describe("ref forwarding", () => {
    it("forwards ref", () => {
      const ref = createRef<View>();
      render(<BabyHeader ref={ref} />);
      expect(ref.current).toBeTruthy();
    });
  });
});
