import { describe, it, expect } from "vitest";
import { getDashboardLayout, canHideCard } from "./dashboard-layout";
import { DEFAULT_DASHBOARD_CONFIG, DashboardCardConfig } from "@/services/dashboard-config-storage";
import { ActivityType } from "@/constants/activities";

function cardsWithHidden(hidden: ActivityType[]): DashboardCardConfig[] {
  return DEFAULT_DASHBOARD_CONFIG.cards.map((card) => ({
    ...card,
    visible: !hidden.includes(card.activity),
  }));
}

describe("getDashboardLayout", () => {
  it("lays out all eight cards as two grid rows and four compact rows when everything is visible", () => {
    const layout = getDashboardLayout(cardsWithHidden([]));

    expect(layout.gridRows).toEqual([
      ["feeding", "sleep"],
      ["diaper", "tummyTime"],
    ]);
    expect(layout.compactCards).toEqual(["pumping", "growth", "milestones", "health"]);
  });

  it("promotes the first compact card into the grid when a primary card is hidden", () => {
    const layout = getDashboardLayout(cardsWithHidden(["feeding"]));

    expect(layout.gridRows).toEqual([
      ["sleep", "diaper"],
      ["tummyTime", "pumping"],
    ]);
    expect(layout.compactCards).toEqual(["growth", "milestones", "health"]);
  });

  it("promotes enough compact cards to keep the grid at four when two primaries are hidden", () => {
    const layout = getDashboardLayout(cardsWithHidden(["feeding", "sleep"]));

    expect(layout.gridRows).toEqual([
      ["diaper", "tummyTime"],
      ["pumping", "growth"],
    ]);
    expect(layout.compactCards).toEqual(["milestones", "health"]);
  });

  it("leaves an odd grid row when fewer than four cards are visible in total", () => {
    const layout = getDashboardLayout(
      cardsWithHidden(["feeding", "sleep", "pumping", "growth", "milestones"])
    );

    expect(layout.gridRows).toEqual([
      ["diaper", "tummyTime"],
      ["health"],
    ]);
    expect(layout.compactCards).toEqual([]);
  });

  it("removes hidden compact cards without touching the grid", () => {
    const layout = getDashboardLayout(cardsWithHidden(["pumping", "health"]));

    expect(layout.gridRows).toEqual([
      ["feeding", "sleep"],
      ["diaper", "tummyTime"],
    ]);
    expect(layout.compactCards).toEqual(["growth", "milestones"]);
  });

  it("renders a single half-row when only one primary card remains", () => {
    const layout = getDashboardLayout(
      cardsWithHidden(["feeding", "sleep", "diaper", "pumping", "growth", "milestones", "health"])
    );

    expect(layout.gridRows).toEqual([["tummyTime"]]);
    expect(layout.compactCards).toEqual([]);
  });

  it("promotes a lone compact card to a full card when all primaries are hidden", () => {
    const layout = getDashboardLayout(
      cardsWithHidden(["feeding", "sleep", "diaper", "tummyTime", "pumping", "growth", "milestones"])
    );

    expect(layout.gridRows).toEqual([["health"]]);
    expect(layout.compactCards).toEqual([]);
  });
});

describe("canHideCard", () => {
  it("allows hiding while more than one card is visible", () => {
    expect(canHideCard(cardsWithHidden([]), "feeding")).toBe(true);
    expect(
      canHideCard(cardsWithHidden(["feeding", "sleep", "diaper", "pumping", "growth", "milestones"]), "health")
    ).toBe(true);
  });

  it("rejects hiding the last visible card", () => {
    const cards = cardsWithHidden([
      "feeding", "sleep", "diaper", "pumping", "growth", "milestones", "health",
    ]);

    expect(canHideCard(cards, "tummyTime")).toBe(false);
  });
});
