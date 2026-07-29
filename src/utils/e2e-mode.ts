import { Platform, NativeModules, Settings } from "react-native";
import { LaunchArguments } from "react-native-launch-arguments";
import {
  canUseRoleBasedDevelopmentOnboarding,
  isDevelopmentOnboardingReplayEnabled,
} from "./development-onboarding";

interface E2ELaunchArgs {
  e2eMode?: string | boolean;
  e2eEmail?: string;
  e2ePassword?: string;
  onboardingPreview?: string | boolean;
}

function getArgs(): E2ELaunchArgs {
  try {
    const args = LaunchArguments.value<E2ELaunchArgs>();
    if (args.e2eMode || args.onboardingPreview) {
      return args;
    }
  } catch {
    // LaunchArguments not available
  }

  if (Platform.OS === "ios") {
    try {
      const e2eMode = Settings.get("e2eMode");
      const onboardingPreview = Settings.get("onboardingPreview");
      if (e2eMode || onboardingPreview) {
        return {
          e2eMode: e2eMode ? String(e2eMode) : undefined,
          e2eEmail: Settings.get("e2eEmail"),
          e2ePassword: Settings.get("e2ePassword"),
          onboardingPreview: onboardingPreview ? String(onboardingPreview) : undefined,
        };
      }
    } catch {
      // Settings not available
    }

    try {
      const { SettingsManager } = NativeModules;
      if (SettingsManager?.settings?.e2eMode || SettingsManager?.settings?.onboardingPreview) {
        return {
          e2eMode: SettingsManager.settings.e2eMode
            ? String(SettingsManager.settings.e2eMode)
            : undefined,
          e2eEmail: SettingsManager.settings.e2eEmail,
          e2ePassword: SettingsManager.settings.e2ePassword,
          onboardingPreview: SettingsManager.settings.onboardingPreview
            ? String(SettingsManager.settings.onboardingPreview)
            : undefined,
        };
      }
    } catch {
      // SettingsManager not available
    }
  }

  return {};
}

export function isE2EMode(): boolean {
  const args = getArgs();
  return args.e2eMode === "true" || args.e2eMode === true;
}

export function isNewOwnerOnboardingPreviewEnabled(): boolean {
  return canUseRoleBasedDevelopmentOnboarding(
    __DEV__,
    getArgs().onboardingPreview,
    isDevelopmentOnboardingReplayEnabled(__DEV__)
  );
}

export function getE2ECredentials(): { email: string; password: string } | null {
  const args = getArgs();
  if ((args.e2eMode === "true" || args.e2eMode === true) && args.e2eEmail && args.e2ePassword) {
    return { email: args.e2eEmail, password: args.e2ePassword };
  }
  return null;
}
