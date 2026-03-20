export function celsiusToFahrenheit(celsius: number): number {
  return Number((celsius * 9 / 5 + 32).toFixed(1));
}

export function fahrenheitToCelsius(fahrenheit: number): number {
  return Number(((fahrenheit - 32) * 5 / 9).toFixed(1));
}

export function formatTemperature(celsius: number, unit: "°C" | "°F"): string {
  if (unit === "°F") {
    return `${celsiusToFahrenheit(celsius)}°F`;
  }
  return `${celsius.toFixed(1)}°C`;
}

export type FeverStatus = "normal" | "low_fever" | "fever" | "high_fever";

export type TemperatureMeasurementMethod = "forehead" | "ear" | "rectal" | "armpit";

const FEVER_THRESHOLDS: Record<TemperatureMeasurementMethod | "default", { lowFever: number; fever: number; highFever: number }> = {
  rectal: { lowFever: 38.0, fever: 39.0, highFever: 40.0 },
  ear: { lowFever: 38.0, fever: 39.0, highFever: 40.0 },
  forehead: { lowFever: 38.0, fever: 39.0, highFever: 40.0 },
  armpit: { lowFever: 37.2, fever: 38.0, highFever: 39.0 },
  default: { lowFever: 37.5, fever: 38.5, highFever: 39.5 },
};

export function getFeverStatus(celsius: number, method?: TemperatureMeasurementMethod | null): FeverStatus {
  const thresholds = method ? FEVER_THRESHOLDS[method] : FEVER_THRESHOLDS.default;
  if (celsius >= thresholds.highFever) return "high_fever";
  if (celsius >= thresholds.fever) return "fever";
  if (celsius >= thresholds.lowFever) return "low_fever";
  return "normal";
}

export function getFeverColor(status: FeverStatus): { light: string; dark: string } {
  switch (status) {
    case "normal":
      return { light: "#22c55e", dark: "#4ade80" };
    case "low_fever":
      return { light: "#f59e0b", dark: "#fbbf24" };
    case "fever":
      return { light: "#ef4444", dark: "#f87171" };
    case "high_fever":
      return { light: "#dc2626", dark: "#ef4444" };
  }
}

export const TEMP_RANGE_CELSIUS = { min: 35.0, max: 42.0 };
export const TEMP_SLIDER_CELSIUS = { min: 36.0, max: 41.0, step: 0.1 };
export const DEFAULT_TEMP_CELSIUS = 36.5;

export const QUICK_TEMPS_CELSIUS = [36.5, 37.0, 37.5, 38.0, 38.5, 39.0];
