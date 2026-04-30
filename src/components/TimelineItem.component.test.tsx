import React, { createRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { View } from "react-native";
import { TimelineItem, TimelineDayHeader, TimelineDivider } from "./TimelineItem";

describe("TimelineItem", () => {
  const defaultProps = {
    activity: "feeding" as const,
    time: "10:30 AM",
    title: "Breastfeeding",
  };

  describe("rendering", () => {
    it("renders time", () => {
      render(<TimelineItem {...defaultProps} testID="item" />);
      expect(screen.getByText("10:30 AM")).toBeTruthy();
    });

    it("renders title", () => {
      render(<TimelineItem {...defaultProps} testID="item" />);
      expect(screen.getByText("Breastfeeding")).toBeTruthy();
    });

    it("renders subtitle when provided", () => {
      render(
        <TimelineItem {...defaultProps} subtitle="Left side, 15 min" testID="item" />
      );
      expect(screen.getByText("Left side, 15 min")).toBeTruthy();
    });

    it("renders details when provided", () => {
      render(
        <TimelineItem {...defaultProps} details="Good latch" testID="item" />
      );
      expect(screen.getByText("Good latch")).toBeTruthy();
    });

    it("renders edit indicator", () => {
      render(<TimelineItem {...defaultProps} testID="item" />);
      expect(screen.getByText("›")).toBeTruthy();
    });
  });

  describe("activity icons", () => {
    it("renders feeding icon", () => {
      render(<TimelineItem {...defaultProps} testID="item" />);
      expect(screen.getByText("🤱")).toBeTruthy();
    });

    it("renders sleep icon", () => {
      render(
        <TimelineItem
          activity="sleep"
          time="9:00 PM"
          title="Nap"
          testID="item"
        />
      );
      expect(screen.getByText("😴")).toBeTruthy();
    });

    it("renders diaper icon", () => {
      render(
        <TimelineItem
          activity="diaper"
          time="11:00 AM"
          title="Diaper Change"
          testID="item"
        />
      );
      expect(screen.getByText("🚼")).toBeTruthy();
    });

    it("renders pumping icon", () => {
      render(
        <TimelineItem
          activity="pumping"
          time="2:00 PM"
          title="Pumping"
          testID="item"
        />
      );
      expect(screen.getByText("🫙")).toBeTruthy();
    });

    it("renders growth icon", () => {
      render(
        <TimelineItem
          activity="growth"
          time="3:00 PM"
          title="Measurement"
          testID="item"
        />
      );
      expect(screen.getByText("📏")).toBeTruthy();
    });

    it("renders tummyTime icon", () => {
      render(
        <TimelineItem
          activity="tummyTime"
          time="4:00 PM"
          title="Tummy Time"
          testID="item"
        />
      );
      expect(screen.getByText("💪")).toBeTruthy();
    });
  });

  describe("interactions", () => {
    it("calls onPress when pressed", () => {
      const onPressMock = jest.fn();
      render(
        <TimelineItem {...defaultProps} onPress={onPressMock} testID="item" />
      );
      fireEvent.press(screen.getByTestId("item"));
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("accessibility", () => {
    it("has button accessibility role", () => {
      render(<TimelineItem {...defaultProps} testID="item" />);
      const item = screen.getByTestId("item");
      expect(item.props.accessibilityRole).toBe("button");
    });

    it("has correct accessibility label", () => {
      render(<TimelineItem {...defaultProps} testID="item" />);
      const item = screen.getByTestId("item");
      expect(item.props.accessibilityLabel).toContain("Breastfeeding");
      expect(item.props.accessibilityLabel).toContain("10:30 AM");
    });

    it("has accessibility label with subtitle", () => {
      render(
        <TimelineItem {...defaultProps} subtitle="Left side" testID="item" />
      );
      const item = screen.getByTestId("item");
      expect(item.props.accessibilityLabel).toContain("Left side");
    });
  });

  describe("ref forwarding", () => {
    it("forwards ref", () => {
      const ref = createRef<View>();
      render(<TimelineItem {...defaultProps} ref={ref} />);
      expect(ref.current).toBeTruthy();
    });
  });
});

describe("TimelineDayHeader", () => {
  describe("rendering", () => {
    it("renders title", () => {
      render(<TimelineDayHeader title="Today" />);
      expect(screen.getByText("Today")).toBeTruthy();
    });

    it("renders date parts when dateObj provided", () => {
      const testDate = new Date(2026, 0, 19); // Jan 19, 2026
      render(<TimelineDayHeader title="Yesterday" dateObj={testDate} />);
      expect(screen.getByText("Yesterday")).toBeTruthy();
      expect(screen.getByText("19")).toBeTruthy(); // day number
      expect(screen.getByText("Jan")).toBeTruthy(); // month
    });
  });
});

describe("TimelineDivider", () => {
  describe("rendering", () => {
    it("renders divider line", () => {
      const { UNSAFE_root } = render(<TimelineDivider />);
      expect(UNSAFE_root).toBeTruthy();
    });
  });
});
