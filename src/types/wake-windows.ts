export interface NapSlotWindow {
  slotIndex: number;
  label: string;
  durationMinutes: number;
}

export interface WakeWindowConfig {
  napCount: number;
  slots: NapSlotWindow[];
  source: "age_based" | "custom";
  dayStartHour?: number;
  dayEndHour?: number;
  napContinuationMinutes?: number;
}

export interface WakeWindowReminderSettings {
  enabled: boolean;
}
