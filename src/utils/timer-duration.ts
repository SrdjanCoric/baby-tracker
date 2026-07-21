const PRODUCTION_MINIMUM_TIMER_DURATION_SECONDS = 60;

export function shouldDiscardTimerDuration(
  durationSeconds: number,
  configuredMinimum = process.env.EXPO_PUBLIC_E2E_TIMER_MINIMUM_SECONDS
): boolean {
  const minimumDuration = configuredMinimum === "0"
    ? 0
    : PRODUCTION_MINIMUM_TIMER_DURATION_SECONDS;
  return durationSeconds < minimumDuration;
}
