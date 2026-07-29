import {
  BabyStorageService,
  type StoredBabyProfile,
} from "@/services/baby-storage";
import type { ReturningRestorationFailureReason } from "@/types/new-owner-onboarding";

interface ReturningUserProfile {
  householdId: string | null;
  displayName: string | null;
  isOwner: boolean;
}

interface ReturningUserRestorationDependencies {
  userId: string | null;
  refreshUserProfile: () => Promise<ReturningUserProfile>;
  refreshHousehold: (householdId: string) => Promise<void>;
  refreshBabies: (householdId: string) => Promise<StoredBabyProfile[]>;
}

export type ReturningUserRestorationResult =
  | { status: "restored"; householdId: string; babyId: string }
  | { status: "verified-empty"; householdId: string }
  | { status: "unavailable"; reason: ReturningRestorationFailureReason };

export async function restoreReturningUserAccount(
  dependencies: ReturningUserRestorationDependencies
): Promise<ReturningUserRestorationResult> {
  if (!dependencies.userId) return { status: "unavailable", reason: "auth" };

  let profile: ReturningUserProfile;
  try {
    profile = await dependencies.refreshUserProfile();
  } catch {
    return { status: "unavailable", reason: "profile" };
  }
  if (!profile.householdId) return { status: "unavailable", reason: "profile" };

  try {
    await dependencies.refreshHousehold(profile.householdId);
  } catch {
    return { status: "unavailable", reason: "household" };
  }

  let babies: StoredBabyProfile[];
  try {
    babies = await dependencies.refreshBabies(profile.householdId);
  } catch {
    return { status: "unavailable", reason: "babies" };
  }
  if (babies.length === 0) {
    return { status: "verified-empty", householdId: profile.householdId };
  }

  try {
    const storageScope = BabyStorageService.scopeForUser(
      dependencies.userId,
      profile.householdId
    );
    const persistedBabyId = await BabyStorageService.getSelectedBabyId(storageScope);
    const selectedBaby = persistedBabyId
      ? babies.find(baby => baby.id === persistedBabyId) ?? null
      : null;
    const babyId = selectedBaby?.id ?? babies[0].id;
    if (!selectedBaby) {
      await BabyStorageService.setSelectedBabyId(babyId, storageScope);
    }
    return { status: "restored", householdId: profile.householdId, babyId };
  } catch {
    return { status: "unavailable", reason: "selection" };
  }
}
