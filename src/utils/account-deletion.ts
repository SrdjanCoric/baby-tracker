/**
 * Account Deletion Utilities
 * Helper functions for account deletion functionality
 */

import type { DeletionPreview } from "@/types/account-deletion";

export const CONFIRMATION_TEXT = "DELETE" as const;

export function validateDeletionConfirmation(input: string): boolean {
  const trimmed = input.trim();
  return trimmed === CONFIRMATION_TEXT;
}

export function calculateTotalRecords(preview: DeletionPreview): number {
  return (
    preview.feedings +
    preview.sleep +
    preview.diapers +
    preview.pumping +
    preview.growth +
    preview.tummyTime
  );
}
