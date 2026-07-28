export type MorningClassificationState =
  | "automatic"
  | "unresolved"
  | "confirmed_first_nap"
  | "confirmed_night_continuation";

export const MORNING_CLASSIFICATION_VERSION = 1;
