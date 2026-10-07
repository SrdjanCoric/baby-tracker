const ML_PER_FL_OZ = 29.5735;
const KG_PER_LB = 0.45359237;
const CM_PER_INCH = 2.54;

export const VOLUME_ML: Record<string, number> = {
  ml: 1,
  oz: ML_PER_FL_OZ,
  floz: ML_PER_FL_OZ,
  "fl.oz": ML_PER_FL_OZ,
};
export const WEIGHT_KG: Record<string, number> = {
  kg: 1,
  kgs: 1,
  g: 0.001,
  lb: KG_PER_LB,
  lbs: KG_PER_LB,
};
export const LENGTH_CM: Record<string, number> = {
  cm: 1,
  mm: 0.1,
  in: CM_PER_INCH,
  inch: CM_PER_INCH,
  inches: CM_PER_INCH,
};

/** Factor for a unit spelled in any case, with or without spaces or underscores. */
export function unitFactor(
  units: Record<string, number>,
  unit: string | undefined
): number | undefined {
  const key = (unit ?? "").toLowerCase().replace(/[\s_]/g, "");
  return Object.prototype.hasOwnProperty.call(units, key)
    ? units[key]
    : undefined;
}

/** Rounds to the decimals the growth columns store, so device and server values agree. */
export function toStoredPrecision(
  value: number | undefined,
  decimals: 2 | 3
): number | undefined {
  return value === undefined ? undefined : Number(value.toFixed(decimals));
}
