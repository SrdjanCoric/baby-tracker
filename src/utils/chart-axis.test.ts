import { describe, expect, it } from "vitest";
import {
  computeNiceBottleYAxis,
  computeNiceCountYAxis,
  computeNiceYAxis,
} from "./chart-axis";

describe("statistics chart axes", () => {
  it.each([
    { peak: 4, labels: [0, 3, 6, 9, 12] },
    { peak: 8, labels: [0, 3, 6, 9, 12] },
    { peak: 12, labels: [0, 3, 6, 9, 12, 15] },
    { peak: 30, labels: [0, 10, 20, 30, 40] },
  ])("uses count-sized labels for a peak of $peak diaper changes", ({ peak, labels }) => {
    expect(computeNiceCountYAxis([{ value: peak }], 12).labels).toEqual(labels);
  });

  it.each([
    { chart: "tummy time below", value: 10, minimum: 20, expectedMax: 30 },
    { chart: "tummy time equal", value: 20, minimum: 20, expectedMax: 30 },
    { chart: "tummy time above", value: 45, minimum: 20, expectedMax: 60 },
  ])("rounds the $chart baseline to a nice ceiling", ({ value, minimum, expectedMax }) => {
    expect(computeNiceYAxis([{ value }], minimum).maxY).toBe(expectedMax);
  });

  it.each([
    { chart: "metric pumping below", valueMl: 300, unit: "ml" as const, expectedMax: 600 },
    { chart: "metric pumping equal", valueMl: 600, unit: "ml" as const, expectedMax: 750 },
    { chart: "metric pumping above", valueMl: 1200, unit: "ml" as const, expectedMax: 1500 },
    { chart: "imperial pumping below", valueMl: 300, unit: "oz" as const, expectedMax: 20 },
    {
      chart: "imperial pumping equal",
      valueMl: 20 / 0.033814,
      unit: "oz" as const,
      expectedMax: 25,
    },
    { chart: "imperial pumping above", valueMl: 1500, unit: "oz" as const, expectedMax: 65 },
  ])("rounds the $chart baseline to a nice ceiling", ({ valueMl, unit, expectedMax }) => {
    const minimum = unit === "oz" ? 20 : 600;
    expect(computeNiceBottleYAxis([{ value: valueMl }], unit, minimum).maxY).toBe(
      expectedMax
    );
  });
});
