import { fetchAndSyncHouseholdBabies } from "@/services/baby-sync-service";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";
import type { NewOwnerOnboardingState } from "@/types/new-owner-onboarding";

export function getOnboardingAuthCallbackRoute(
  state: NewOwnerOnboardingState
): "/auth/sign-in?resumeOnboarding=true" | "/(tabs)" {
  return state.screen === "auth-pending" ||
    state.screen === "join-auth-pending" ||
    state.screen === "returning-auth" ||
    state.screen === "returning-restoring"
    ? "/auth/sign-in?resumeOnboarding=true"
    : "/(tabs)";
}

export type NewOwnerAuthResumeResult =
  | "not-pending"
  | "profile-pending"
  | "caregiver-confirmation"
  | "caregiver-recovery"
  | "returning-restoration"
  | "existing-account"
  | "baby-setup";

export async function resumeNewOwnerOnboardingAfterAuth(
  householdId: string | null
): Promise<NewOwnerAuthResumeResult> {
  const state = await NewOwnerOnboardingStorageService.getState("system");
  const isPostSubmitCaregiverRecovery = state.screen === "joining" ||
    state.screen === "join-refresh" ||
    (state.screen === "join-failure" && state.recovery !== "confirmation");
  if (isPostSubmitCaregiverRecovery) {
    return householdId ? "caregiver-recovery" : "profile-pending";
  }
  if (state.screen === "returning-auth") {
    await NewOwnerOnboardingStorageService.beginReturningRestoration();
    return "returning-restoration";
  }
  if (state.screen === "returning-restoring") {
    return "returning-restoration";
  }
  if (state.screen !== "auth-pending" && state.screen !== "join-auth-pending") {
    return "not-pending";
  }
  if (!householdId) return "profile-pending";

  if (state.screen === "join-auth-pending") {
    await NewOwnerOnboardingStorageService.resumeCaregiverAuthentication(householdId);
    return "caregiver-confirmation";
  }

  const babies = await fetchAndSyncHouseholdBabies(householdId);
  const hasBabies = babies.length > 0;
  await NewOwnerOnboardingStorageService.resumeAuthenticatedAccount(hasBabies);
  return hasBabies ? "existing-account" : "baby-setup";
}
