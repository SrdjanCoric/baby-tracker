/**
 * Unit preference utilities for baby tracker
 * Handles validation and defaults for metric/imperial units
 */

export type UnitSystem = "metric" | "imperial";

const VALID_UNIT_SYSTEMS: UnitSystem[] = ["metric", "imperial"];

export const DEFAULT_UNIT_SYSTEM: UnitSystem = "metric";

export function isValidUnitSystem(value: unknown): value is UnitSystem {
  return typeof value === "string" && VALID_UNIT_SYSTEMS.includes(value as UnitSystem);
}

export function getWeightUnit(system: UnitSystem): "kg" | "lbs" {
  return system === "imperial" ? "lbs" : "kg";
}

export function getHeightUnit(system: UnitSystem): "cm" | "in" {
  return system === "imperial" ? "in" : "cm";
}

export function getVolumeUnit(system: UnitSystem): "ml" | "oz" {
  return system === "imperial" ? "oz" : "ml";
}

export function getTemperatureUnit(system: UnitSystem): "°C" | "°F" {
  return system === "imperial" ? "°F" : "°C";
}
