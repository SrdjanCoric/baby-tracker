import React from "react";
import { render, screen } from "@testing-library/react-native";
import { InsightCard } from "./InsightCard";
import type { Insight } from "@/utils/insights";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: { percentage: number }) => {
      const translations: Record<string, string> = {
        "statistics.comparedToLastWeek": "compared to last week",
        "insights.sleepIncreased": `Sleep increased by ${params?.percentage || 0}%`,
        "insights.sleepDecreased": `Sleep decreased by ${params?.percentage || 0}%`,
        "insights.feedingStable": "Feeding patterns remain stable",
      };
      return translations[key] || key;
    },
  }),
}));

describe("InsightCard", () => {
  const createInsight = (overrides: Partial<Insight> = {}): Insight => ({
    type: "sleep",
    direction: "increase",
    percentageChange: 15,
    messageKey: "insights.sleepIncreased",
    ...overrides,
  });

  describe("direction icons", () => {
    it("renders direction icon for increase", () => {
      const insight = createInsight({ direction: "increase" });
      render(<InsightCard insight={insight} />);
      expect(screen.getByText("📈")).toBeTruthy();
    });

    it("renders direction icon for decrease", () => {
      const insight = createInsight({
        direction: "decrease",
        messageKey: "insights.sleepDecreased",
      });
      render(<InsightCard insight={insight} />);
      expect(screen.getByText("📉")).toBeTruthy();
    });

    it("renders direction icon for stable", () => {
      const insight = createInsight({
        direction: "stable",
        type: "feeding",
        messageKey: "insights.feedingStable",
      });
      render(<InsightCard insight={insight} />);
      expect(screen.getByText("➡️")).toBeTruthy();
    });
  });

  describe("activity icons", () => {
    it("renders sleep icon", () => {
      const insight = createInsight({ type: "sleep" });
      render(<InsightCard insight={insight} />);
      expect(screen.getByText("😴")).toBeTruthy();
    });

    it("renders feeding icon", () => {
      const insight = createInsight({
        type: "feeding",
        messageKey: "insights.feedingStable",
      });
      render(<InsightCard insight={insight} />);
      expect(screen.getByText("🤱")).toBeTruthy();
    });

    it("renders diaper icon", () => {
      const insight = createInsight({
        type: "diaper",
        messageKey: "insights.diaperCount",
      });
      render(<InsightCard insight={insight} />);
      expect(screen.getByText("👶")).toBeTruthy();
    });

    it("renders pumping icon", () => {
      const insight = createInsight({
        type: "pumping",
        messageKey: "insights.pumpingVolume",
      });
      render(<InsightCard insight={insight} />);
      expect(screen.getByText("🫙")).toBeTruthy();
    });

    it("renders tummyTime icon", () => {
      const insight = createInsight({
        type: "tummyTime",
        messageKey: "insights.tummyTime",
      });
      render(<InsightCard insight={insight} />);
      expect(screen.getByText("💪")).toBeTruthy();
    });
  });

  describe("content", () => {
    it("renders insight message", () => {
      const insight = createInsight({ percentageChange: 25 });
      render(<InsightCard insight={insight} />);
      expect(screen.getByText("Sleep increased by 25%")).toBeTruthy();
    });

    it('renders "compared to last week" text', () => {
      const insight = createInsight();
      render(<InsightCard insight={insight} />);
      expect(screen.getByText("compared to last week")).toBeTruthy();
    });

    it("displays percentage in message", () => {
      const insight = createInsight({ percentageChange: 42 });
      render(<InsightCard insight={insight} />);
      expect(screen.getByText("Sleep increased by 42%")).toBeTruthy();
    });
  });
});
