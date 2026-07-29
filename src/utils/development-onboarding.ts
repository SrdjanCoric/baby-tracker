let developmentOnboardingReplayEnabled = false;

export function canLaunchNewOwnerOnboardingPreview(
  isDevelopment: boolean,
  launchArgument: string | boolean | undefined
): boolean {
  return isDevelopment && (launchArgument === true || launchArgument === "true");
}

export function canUseRoleBasedDevelopmentOnboarding(
  isDevelopment: boolean,
  launchArgument: string | boolean | undefined,
  sessionReplayEnabled: boolean
): boolean {
  return isDevelopment && (
    sessionReplayEnabled ||
    launchArgument === true ||
    launchArgument === "true"
  );
}

export function canRenderDevelopmentOnboardingTools(isDevelopment: boolean): boolean {
  return isDevelopment;
}

export function enableDevelopmentOnboardingReplay(isDevelopment: boolean): boolean {
  if (!isDevelopment) return false;
  developmentOnboardingReplayEnabled = true;
  return true;
}

export function isDevelopmentOnboardingReplayEnabled(isDevelopment: boolean): boolean {
  return isDevelopment && developmentOnboardingReplayEnabled;
}

export function resetDevelopmentOnboardingReplay(): void {
  developmentOnboardingReplayEnabled = false;
}
