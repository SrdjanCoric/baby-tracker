export function canLaunchNewOwnerOnboardingPreview(
  isDevelopment: boolean,
  launchArgument: string | boolean | undefined
): boolean {
  return isDevelopment && (launchArgument === true || launchArgument === "true");
}
