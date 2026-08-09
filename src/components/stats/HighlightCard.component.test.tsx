import React from "react";
import { render, screen } from "@testing-library/react-native";
import { HighlightCard } from "./HighlightCard";

jest.mock("nativewind", () => ({
  useColorScheme: () => ({ colorScheme: "light" }),
}));

const accentColor = "#C9A55C";

function renderCard(comparisonText?: string, comparisonPositive?: boolean) {
  return render(
    <HighlightCard
      accentColor={accentColor}
      label="Tummy time"
      value="20m"
      comparisonText={comparisonText}
      comparisonPositive={comparisonPositive}
    />
  );
}

describe("HighlightCard comparison treatment", () => {
  it("uses the accent treatment for an above-average comparison", () => {
    renderCard("↑ 5m above average", true);

    const comparison = screen.getByText("↑ 5m above average");
    expect(comparison.props.style.color).toBe(accentColor);
    expect(screen.getByTestId("highlight-comparison").props.style.backgroundColor).toBe(
      `${accentColor}15`
    );
  });

  it("uses a neutral treatment for a below-average comparison", () => {
    renderCard("↓ 5m below average", false);

    const comparison = screen.getByText("↓ 5m below average");
    expect(comparison.props.style.color).toBe("#6b7280");
    expect(screen.getByTestId("highlight-comparison").props.style.backgroundColor).toBe(
      "#6b728015"
    );
  });

  it("does not render a comparison treatment when today equals the average", () => {
    renderCard();

    expect(screen.queryByText(/average/)).toBeNull();
  });
});
