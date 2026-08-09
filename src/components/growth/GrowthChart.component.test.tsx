import React from "react";
import { render, screen } from "@testing-library/react-native";
import { GrowthChart } from "./GrowthChart";

describe("GrowthChart percentile notation", () => {
  it("uses P notation for every percentile legend entry", () => {
    render(
      <GrowthChart gender="female" measurementType="weight" measurements={[]} />
    );

    expect(screen.getByText("P3")).toBeTruthy();
    expect(screen.getByText("P15")).toBeTruthy();
    expect(screen.getByText("P50 (median)")).toBeTruthy();
    expect(screen.getByText("P85")).toBeTruthy();
    expect(screen.getByText("P97")).toBeTruthy();
  });
});
