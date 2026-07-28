import { fetchAndSyncHouseholdBabies } from "@/services/baby-sync-service";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";

export type NewOwnerAuthResumeResult =
  | "not-pending"
  | "profile-pending"
  | "existing-account"
  | "baby-setup";

export async function resumeNewOwnerOnboardingAfterAuth(
  householdId: string | null
): Promise<NewOwnerAuthResumeResult> {
  const state = await NewOwnerOnboardingStorageService.getState("system");
  if (state.screen !== "auth-pending") return "not-pending";
  if (!householdId) return "profile-pending";

  const babies = await fetchAndSyncHouseholdBabies(householdId);
  const hasBabies = babies.length > 0;
  await NewOwnerOnboardingStorageService.resumeAuthenticatedAccount(hasBabies);
  return hasBabies ? "existing-account" : "baby-setup";
}
