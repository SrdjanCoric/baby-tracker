import React, { createRef } from "react";
import { render, screen } from "@testing-library/react-native";
import { View } from "react-native";
import { TodaySummary } from "./TodaySummary";

describe("TodaySummary", () => {
  describe("rendering", () => {
    it('renders "Today" header', () => {
      render(<TodaySummary testID="summary" />);
      expect(screen.getByText("Today")).toBeTruthy();
    });

    it("renders feedingTotal", () => {
      render(<TodaySummary feedingTotal="24 oz" testID="summary" />);
      expect(screen.getByText("24 oz")).toBeTruthy();
    });

    it("renders napCount", () => {
      render(<TodaySummary napCount={3} testID="summary" />);
      expect(screen.getByText("3")).toBeTruthy();
    });

    it("renders diaperCount", () => {
      render(<TodaySummary diaperCount={5} testID="summary" />);
      expect(screen.getByText("5")).toBeTruthy();
    });

    it("renders sleepTotal when provided", () => {
      render(<TodaySummary sleepTotal="8h 30m" testID="summary" />);
      expect(screen.getByText("8h 30m")).toBeTruthy();
    });

    it("hides sleepTotal when not provided", () => {
      render(<TodaySummary testID="summary" />);
      expect(screen.queryByText("Sleep")).toBeNull();
    });
  });

  describe("singular/plural labels", () => {
    it('uses singular "Feeding" for count of 1', () => {
      render(<TodaySummary feedingTotal="1" testID="summary" />);
      expect(screen.getByText("Feeding")).toBeTruthy();
    });

    it('uses plural "Feedings" for count > 1', () => {
      render(<TodaySummary feedingTotal="3 oz" testID="summary" />);
      expect(screen.getByText("Feedings")).toBeTruthy();
    });

    it('uses singular "Nap" for count of 1', () => {
      render(<TodaySummary napCount={1} testID="summary" />);
      expect(screen.getByText("Nap")).toBeTruthy();
    });

    it('uses plural "Naps" for count > 1', () => {
      render(<TodaySummary napCount={2} testID="summary" />);
      expect(screen.getByText("Naps")).toBeTruthy();
    });

    it('uses singular "Diaper" for count of 1', () => {
      render(<TodaySummary diaperCount={1} testID="summary" />);
      expect(screen.getByText("Diaper")).toBeTruthy();
    });

    it('uses plural "Diapers" for count > 1', () => {
      render(<TodaySummary diaperCount={4} testID="summary" />);
      expect(screen.getByText("Diapers")).toBeTruthy();
    });
  });

  describe("ref forwarding", () => {
    it("forwards ref", () => {
      const ref = createRef<View>();
      render(<TodaySummary ref={ref} />);
      expect(ref.current).toBeTruthy();
    });
  });
});
