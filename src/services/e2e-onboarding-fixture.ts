import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLegacyOnboardingFixture, isE2EMode } from "@/utils/e2e-mode";

const VERSIONED_ONBOARDING_KEY = "@new_owner_onboarding_v2";
const LEGACY_ONBOARDING_STATUS_KEY = "@onboarding_status";

export async function seedLegacyOnboardingFixture(isDevelopment: boolean): Promise<void> {
  if (!isDevelopment || !isE2EMode()) return;
  const status = getLegacyOnboardingFixture();
  if (!status) return;

  const [versionedState, legacyState] = await Promise.all([
    AsyncStorage.getItem(VERSIONED_ONBOARDING_KEY),
    AsyncStorage.getItem(LEGACY_ONBOARDING_STATUS_KEY),
  ]);
  if (versionedState || legacyState) return;

  await AsyncStorage.setItem(LEGACY_ONBOARDING_STATUS_KEY, JSON.stringify({
    hasCompleted: status === "completed",
    completedAt: status === "completed" ? "2000-01-01T00:00:00.000Z" : null,
    skipped: status === "skipped",
  }));
}
