import { NewOwnerOnboardingStorageService } from "./new-owner-onboarding-storage";
import { OnboardingStorageService } from "./onboarding-storage";
import type { LanguageCode } from "./language-storage";

export interface DevelopmentOnboardingToolDependencies {
  clearLegacyProgress: () => Promise<void>;
  clearVersionedState: () => Promise<void>;
  clearUnfinishedDraft: () => Promise<void>;
  beginReturningAuthentication: (language: LanguageCode) => Promise<void>;
  beginReturningRestoration: () => Promise<number | null>;
}

const defaultDependencies: DevelopmentOnboardingToolDependencies = {
  clearLegacyProgress: () => OnboardingStorageService.clearOnboardingProgress(),
  clearVersionedState: () => NewOwnerOnboardingStorageService.startOver(),
  clearUnfinishedDraft: () => NewOwnerOnboardingStorageService.clearUnfinishedDraft(),
  beginReturningAuthentication: language =>
    NewOwnerOnboardingStorageService.beginReturningAuthentication(language),
  beginReturningRestoration: () =>
    NewOwnerOnboardingStorageService.beginReturningRestoration(),
};

interface FirstLaunchReplayOptions {
  isAuthenticated: boolean;
  language: LanguageCode;
}

export async function runFirstLaunchRoutingAgain(
  options: FirstLaunchReplayOptions,
  dependencies: DevelopmentOnboardingToolDependencies = defaultDependencies
): Promise<void> {
  await dependencies.clearLegacyProgress();
  await dependencies.clearVersionedState();

  if (options.isAuthenticated) {
    await dependencies.beginReturningAuthentication(options.language);
    await dependencies.beginReturningRestoration();
  }
}

export function clearUnfinishedOnboardingDraft(
  dependencies: DevelopmentOnboardingToolDependencies = defaultDependencies
): Promise<void> {
  return dependencies.clearUnfinishedDraft();
}
