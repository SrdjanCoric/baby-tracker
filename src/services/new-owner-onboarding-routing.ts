import type { NewOwnerOnboardingState } from "@/types/new-owner-onboarding";

type PreviewOwnerLeaf =
  | undefined
  | null
  | "account"
  | "restore"
  | "join"
  | "baby"
  | "invitation"
  | "saved"
  | "activity";

type PreviewRoute =
  | "/(tabs)"
  | "/auth/sign-in?resumeOnboarding=true"
  | "/onboarding/owner"
  | "/onboarding/owner/account"
  | "/onboarding/owner/restore"
  | "/onboarding/owner/join"
  | "/onboarding/owner/baby"
  | "/onboarding/owner/invitation"
  | "/onboarding/owner/saved"
  | "/onboarding/owner/activity";

export interface NewOwnerPreviewDestination {
  route: PreviewRoute;
  ownerLeaf: PreviewOwnerLeaf;
}

export function getNewOwnerPreviewDestination(
  state: NewOwnerOnboardingState
): NewOwnerPreviewDestination {
  if (state.screen === "completed" || state.screen === "returning-restored") {
    return { route: "/(tabs)", ownerLeaf: null };
  }
  if (state.screen === "welcome" || state.screen === "returning-signed-out") {
    return { route: "/onboarding/owner", ownerLeaf: undefined };
  }
  if (state.screen === "account-choice") {
    return { route: "/onboarding/owner/account", ownerLeaf: "account" };
  }
  if (state.screen === "auth-pending" ||
    state.screen === "join-auth-pending" ||
    state.screen === "returning-auth") {
    return { route: "/auth/sign-in?resumeOnboarding=true", ownerLeaf: null };
  }
  if (state.screen === "returning-restoring" ||
    state.screen === "returning-verified-empty" ||
    state.screen === "returning-unavailable") {
    return { route: "/onboarding/owner/restore", ownerLeaf: "restore" };
  }
  if (state.screen === "join-code" ||
    state.screen === "join-confirmation" ||
    state.screen === "joining" ||
    state.screen === "join-refresh" ||
    state.screen === "join-failure") {
    return { route: "/onboarding/owner/join", ownerLeaf: "join" };
  }
  if (state.screen === "owner-baby") {
    return { route: "/onboarding/owner/baby", ownerLeaf: "baby" };
  }
  if (state.screen === "invitation") {
    return { route: "/onboarding/owner/invitation", ownerLeaf: "invitation" };
  }
  if (state.screen === "activity-saved") {
    return { route: "/onboarding/owner/saved", ownerLeaf: "saved" };
  }
  return { route: "/onboarding/owner/activity", ownerLeaf: "activity" };
}
