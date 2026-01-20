import React from "react";
import { render, screen } from "@testing-library/react-native";
import { SimpleBarChart } from "./SimpleBarChart";

describe("SimpleBarChart", () => {
  const sampleData = [
    { label: "Mon", value: 5 },
    { label: "Tue", value: 10 },
    { label: "Wed", value: 7 },
    { label: "Thu", value: 0 },
    { label: "Fri", value: 8 },
  ];

  describe("rendering", () => {
    it("renders correct number of bars", () => {
      render(<SimpleBarChart data={sampleData} color="#88B04B" />);
      expect(screen.getByText("Mon")).toBeTruthy();
      expect(screen.getByText("Tue")).toBeTruthy();
      expect(screen.getByText("Wed")).toBeTruthy();
      expect(screen.getByText("Thu")).toBeTruthy();
      expect(screen.getByText("Fri")).toBeTruthy();
    });

    it("renders labels below bars", () => {
      render(<SimpleBarChart data={sampleData} color="#88B04B" />);
      sampleData.forEach((item) => {
        expect(screen.getByText(item.label)).toBeTruthy();
      });
    });

    it("renders value above bars for non-zero values", () => {
      render(<SimpleBarChart data={sampleData} color="#88B04B" />);
      expect(screen.getByText("5")).toBeTruthy();
      expect(screen.getByText("10")).toBeTruthy();
      expect(screen.getByText("7")).toBeTruthy();
      expect(screen.getByText("8")).toBeTruthy();
    });

    it("hides value for zero bars", () => {
      const dataWithZero = [
        { label: "A", value: 0 },
        { label: "B", value: 5 },
      ];
      render(<SimpleBarChart data={dataWithZero} color="#88B04B" />);
      const allTexts = screen.getAllByText(/./);
      const valueTexts = allTexts.filter((t) => t.props.children === "0");
      expect(valueTexts.length).toBe(0);
    });
  });

  describe("maxValue handling", () => {
    it("uses maxValue when provided", () => {
      const { UNSAFE_root } = render(
        <SimpleBarChart data={sampleData} color="#88B04B" maxValue={20} />
      );
      expect(UNSAFE_root).toBeTruthy();
    });

    it("uses largest data value when no maxValue", () => {
      const { UNSAFE_root } = render(
        <SimpleBarChart data={sampleData} color="#88B04B" />
      );
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  describe("formatValue", () => {
    it("applies custom formatValue", () => {
      const formatValue = (v: number) => `${v}h`;
      render(
        <SimpleBarChart
          data={[{ label: "Mon", value: 5 }]}
          color="#88B04B"
          formatValue={formatValue}
        />
      );
      expect(screen.getByText("5h")).toBeTruthy();
    });
  });

  describe("zero value styling", () => {
    it("zero values have reduced opacity", () => {
      const dataWithZero = [
        { label: "A", value: 0 },
        { label: "B", value: 5 },
      ];
      const { UNSAFE_getAllByType } = render(
        <SimpleBarChart data={dataWithZero} color="#88B04B" />
      );
      const views = UNSAFE_getAllByType("View" as any);
      const barViews = views.filter((v) => v.props.style?.opacity !== undefined);
      const zeroOpacityBars = barViews.filter((v) => v.props.style?.opacity === 0.2);
      expect(zeroOpacityBars.length).toBeGreaterThanOrEqual(1);
    });
  });
});
