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

    it("renders feedingCount", () => {
      render(<TodaySummary feedingCount={24} testID="summary" />);
      expect(screen.getByText("24")).toBeTruthy();
    });

    it("renders wetDiaperCount", () => {
      render(<TodaySummary wetDiaperCount={5} testID="summary" />);
      expect(screen.getByText("5")).toBeTruthy();
    });

    it("renders sleepTotal when provided", () => {
      render(<TodaySummary sleepTotal="8h 30m" testID="summary" />);
      expect(screen.getByText("8h 30m")).toBeTruthy();
    });

    it("renders -- for sleepTotal when not provided", () => {
      render(<TodaySummary testID="summary" />);
      expect(screen.getByText("--")).toBeTruthy();
    });
  });

  describe("singular/plural labels", () => {
    it('uses singular "Feeding" for count of 1', () => {
      render(<TodaySummary feedingCount={1} testID="summary" />);
      expect(screen.getByText("Feeding")).toBeTruthy();
    });

    it('uses plural "Feedings" for count > 1', () => {
      render(<TodaySummary feedingCount={3} testID="summary" />);
      expect(screen.getByText("Feedings")).toBeTruthy();
    });

    it('uses singular "Diaper" for count of 1', () => {
      render(<TodaySummary wetDiaperCount={1} testID="summary" />);
      expect(screen.getByText("Diaper")).toBeTruthy();
    });

    it('uses plural "Diapers" for count > 1', () => {
      render(<TodaySummary wetDiaperCount={4} testID="summary" />);
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
