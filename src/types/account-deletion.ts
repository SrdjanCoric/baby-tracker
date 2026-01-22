/**
 * Account Deletion type definitions
 * Types for in-app account and data deletion
 */

export interface DeletionPreview {
  feedings: number;
  sleep: number;
  diapers: number;
  pumping: number;
  growth: number;
  tummyTime: number;
  babies: BabyInfo[];
  householdWillBeDeleted: boolean;
  hasOtherCaregivers: boolean;
}

export interface BabyInfo {
  id: string;
  name: string;
}

export interface DeletionResult {
  success: boolean;
  error?: string;
}

export type DeletionStep =
  | "warning"
  | "confirmation"
  | "processing"
  | "complete"
  | "error";

export interface DeletionState {
  step: DeletionStep;
  preview: DeletionPreview | null;
  isLoading: boolean;
  error: string | null;
}

export const CONFIRMATION_TEXT = "DELETE" as const;
