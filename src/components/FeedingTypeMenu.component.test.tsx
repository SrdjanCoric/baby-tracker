import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { FeedingTypeMenu } from "./FeedingTypeMenu";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "feeding.startFeeding": "Start Feeding",
        "feeding.breastfeeding": "Breastfeeding",
        "feeding.selectSideToStart": "Select side to start",
        "feeding.bottleFeeding": "Bottle",
        "feeding.enterAmount": "Enter amount",
        "feeding.solidFood": "Solid Food",
        "feeding.logSolidFood": "Log solid food",
        "common.cancel": "Cancel",
      };
      return translations[key] || key;
    },
  }),
}));

describe("FeedingTypeMenu", () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onSelect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("visibility", () => {
    it("renders when visible=true", () => {
      render(<FeedingTypeMenu {...defaultProps} />);
      expect(screen.getByText("Start Feeding")).toBeTruthy();
    });

    it("does not render when visible=false", () => {
      render(<FeedingTypeMenu {...defaultProps} visible={false} />);
      expect(screen.queryByText("Start Feeding")).toBeNull();
    });
  });

  describe("options rendering", () => {
    it("renders breastfeeding option", () => {
      render(<FeedingTypeMenu {...defaultProps} />);
      expect(screen.getByText("🤱")).toBeTruthy();
      expect(screen.getByText("Breastfeeding")).toBeTruthy();
    });

    it("renders bottle option", () => {
      render(<FeedingTypeMenu {...defaultProps} />);
      expect(screen.getByText("🍼")).toBeTruthy();
      expect(screen.getByText("Bottle")).toBeTruthy();
    });

    it("renders solids option", () => {
      render(<FeedingTypeMenu {...defaultProps} />);
      expect(screen.getByText("🥣")).toBeTruthy();
      expect(screen.getByText("Solid Food")).toBeTruthy();
    });

    it("renders cancel button", () => {
      render(<FeedingTypeMenu {...defaultProps} />);
      expect(screen.getByText("Cancel")).toBeTruthy();
    });

    it("renders option descriptions", () => {
      render(<FeedingTypeMenu {...defaultProps} />);
      expect(screen.getByText("Select side to start")).toBeTruthy();
      expect(screen.getByText("Enter amount")).toBeTruthy();
      expect(screen.getByText("Log solid food")).toBeTruthy();
    });
  });

  describe("interactions", () => {
    it('calls onSelect with "breastfeed"', () => {
      render(<FeedingTypeMenu {...defaultProps} />);
      fireEvent.press(screen.getByLabelText("Breastfeeding"));
      expect(defaultProps.onSelect).toHaveBeenCalledWith("breastfeed");
    });

    it('calls onSelect with "bottle"', () => {
      render(<FeedingTypeMenu {...defaultProps} />);
      fireEvent.press(screen.getByLabelText("Bottle"));
      expect(defaultProps.onSelect).toHaveBeenCalledWith("bottle");
    });

    it('calls onSelect with "solids"', () => {
      render(<FeedingTypeMenu {...defaultProps} />);
      fireEvent.press(screen.getByLabelText("Solid Food"));
      expect(defaultProps.onSelect).toHaveBeenCalledWith("solids");
    });

    it("calls onClose when cancel pressed", () => {
      render(<FeedingTypeMenu {...defaultProps} />);
      fireEvent.press(screen.getByLabelText("Cancel"));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it("calls onClose after selecting an option", () => {
      render(<FeedingTypeMenu {...defaultProps} />);
      fireEvent.press(screen.getByLabelText("Breastfeeding"));
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });
});
