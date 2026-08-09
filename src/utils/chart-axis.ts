export function computeNiceBottleYAxis(
  data: { value: number }[],
  unit: "ml" | "oz",
  minimum = unit === "oz" ? 4 : 100
) {
  const dataMax = Math.max(...data.map((d) => d.value), 0);
  if (unit === "oz") {
    const maxOz = dataMax * 0.033814;
    const ceiling = Math.ceil(Math.max(maxOz * 1.2, minimum));
    const niceSteps = [1, 2, 4, 5, 8, 10];
    const step =
      niceSteps.find((candidate) => Math.ceil(ceiling / candidate) <= 5) ??
      Math.ceil(ceiling / 5);
    const count = Math.ceil(ceiling / step);
    const labels = Array.from({ length: count + 1 }, (_, index) => index * step);
    return { maxY: count * step, labels };
  }
  const ceiling = Math.ceil(Math.max(dataMax * 1.2, minimum));
  const niceSteps = [25, 50, 100, 150, 200, 250];
  const step =
    niceSteps.find((candidate) => Math.ceil(ceiling / candidate) <= 5) ??
    Math.ceil(ceiling / 5 / 50) * 50;
  const count = Math.ceil(ceiling / step);
  const labels = Array.from({ length: count + 1 }, (_, index) => index * step);
  return { maxY: count * step, labels };
}

export function computeNiceYAxis(data: { value: number }[], minimum = 60) {
  const dataMax = Math.max(...data.map((d) => d.value), 0);
  const ceiling = Math.ceil(Math.max(dataMax * 1.2, minimum));
  const niceSteps = [15, 30, 45, 60, 90, 120];
  const step =
    niceSteps.find((candidate) => Math.ceil(ceiling / candidate) <= 5) ??
    Math.ceil(ceiling / 5 / 60) * 60;
  const count = Math.ceil(ceiling / step);
  const labels = Array.from({ length: count + 1 }, (_, index) => index * step);
  return { maxY: count * step, labels };
}
