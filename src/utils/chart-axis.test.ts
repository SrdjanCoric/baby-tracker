import { describe, expect, it } from "vitest";
import { computeNiceBottleYAxis, computeNiceYAxis } from "./chart-axis";

describe("statistics chart axes", () => {
  it.each([
    { chart: "diapers below", value: 6, minimum: 12, expectedMax: 15 },
    { chart: "diapers equal", value: 12, minimum: 12, expectedMax: 15 },
    { chart: "diapers above", value: 30, minimum: 12, expectedMax: 45 },
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
