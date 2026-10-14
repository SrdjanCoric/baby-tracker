import type { CreatePumpingInput } from "../pumping-storage";

/**
 * Exports carry pump volume per side but one duration, so only a one-sided
 * session can say how long each side ran.
 */
export function pumpSideSeconds(
  side: "left" | "right" | "both",
  durationSeconds: number | undefined
): Pick<CreatePumpingInput, "leftDurationSeconds" | "rightDurationSeconds"> {
  if (durationSeconds === undefined || durationSeconds <= 0) return {};
  if (side === "left") return { leftDurationSeconds: durationSeconds };
  if (side === "right") return { rightDurationSeconds: durationSeconds };
  return {};
}
