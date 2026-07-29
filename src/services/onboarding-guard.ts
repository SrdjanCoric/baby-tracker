import { getOnboardingDestination } from "@/services/new-owner-onboarding-routing";
import type { NewOwnerOnboardingState } from "@/types/new-owner-onboarding";

const FIRST_ACTIVITY_ROUTES = new Set([
  "feeding",
  "sleep",
  "diaper",
  "pumping",
  "growth",
  "tummyTime",
  "health",
  "milestones",
]);

export function shouldStartReturningRestoration(
  state: NewOwnerOnboardingState,
  isAuthenticated: boolean
): boolean {
  return isAuthenticated &&
    (state.screen === "welcome" || state.screen === "returning-signed-out");
}

export function getOnboardingRedirect(
  state: NewOwnerOnboardingState,
  segments: readonly string[]
): ReturnType<typeof getOnboardingDestination>["route"] | null {
  const currentSegment = segments[0];
  if (currentSegment === "login-callback") return null;

  const destination = getOnboardingDestination(state);
  const inOnboardingGroup = currentSegment === "onboarding";
  const inOwnerGroup = inOnboardingGroup && segments[1] === "owner";
  const inAuthGroup = currentSegment === "auth";

  if (destination.route === "/(tabs)") {
    return inOnboardingGroup || inAuthGroup ? destination.route : null;
  }

  if (destination.route === "/auth/sign-in?resumeOnboarding=true") {
    return inAuthGroup ? null : destination.route;
  }

  const inFirstActivityForm = state.screen === "first-activity" &&
    typeof currentSegment === "string" &&
    FIRST_ACTIVITY_ROUTES.has(currentSegment);
  if (inFirstActivityForm) return null;

  const onExpectedOwnerRoute = destination.ownerLeaf !== null &&
    inOwnerGroup &&
    (destination.ownerLeaf === undefined
      ? segments[2] === undefined
      : segments[2] === destination.ownerLeaf);

  return onExpectedOwnerRoute ? null : destination.route;
}
