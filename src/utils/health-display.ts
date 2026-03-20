import type { TFunction } from "i18next";
import { COMMON_MEDICATION_KEYS, COMMON_VACCINE_KEYS } from "@/constants/activities";

export function getHealthDisplayName(
  storedName: string,
  type: "medication" | "vaccine",
  t: TFunction
): string {
  const keys = type === "medication" ? COMMON_MEDICATION_KEYS : COMMON_VACCINE_KEYS;
  if ((keys as readonly string[]).includes(storedName)) {
    const prefix = type === "medication" ? "commonMedication" : "commonVaccine";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return t(`health.${prefix}.${storedName}` as any);
  }
  return storedName;
}
