export interface NapSlotWindow {
  slotIndex: number;
  label: string;
  durationMinutes: number;
}

export interface WakeWindowConfig {
  enabled: boolean;
  napCount: number;
  slots: NapSlotWindow[];
  source: "age_based" | "custom";
  dayStartHour?: number;
  dayEndHour?: number;
  dayBoundariesConfigured?: boolean;
  napContinuationMinutes?: number;
}

export interface WakeWindowReminderSettings {
  enabled: boolean;
}
