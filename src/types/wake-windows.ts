export interface NapSlotWindow {
  slotIndex: number;
  label: string;
  durationMinutes: number;
}

export interface WakeWindowConfig {
  napCount: number;
  slots: NapSlotWindow[];
  source: "age_based" | "custom" | "smart";
  sourceExplicitlyChosen?: boolean;
  dayStartHour?: number;
  dayEndHour?: number;
  napContinuationMinutes?: number;
}

export interface SmartSleepPrediction {
  rangeStartMs: number;
  rangeEndMs: number;
  slotType: "nap" | "bedtime";
  slotIndex: number;
  confidence: "personalized" | "age_based";
  isEligible: boolean;
  centerMinutes: number;
  isTransitioning?: boolean;
  transitionNapCount?: number;
}

export interface WakeWindowReminderSettings {
  enabled: boolean;
}
