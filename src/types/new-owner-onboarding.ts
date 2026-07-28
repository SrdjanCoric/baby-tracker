import type { LanguageCode } from "@/services/language-storage";

export const NEW_OWNER_ONBOARDING_VERSION = 2 as const;

export interface BabyProfileDraft {
  name: string;
  birthDate: string | null;
  gender: "male" | "female" | null;
}

export interface NewOwnerWelcomeState {
  version: typeof NEW_OWNER_ONBOARDING_VERSION;
  screen: "welcome";
  language: LanguageCode;
  entryPath: null;
  babyDraft: BabyProfileDraft;
}

export type OnboardingAuthIntent = "sign-in" | "create-account";

export interface NewOwnerAccountChoiceState {
  version: typeof NEW_OWNER_ONBOARDING_VERSION;
  screen: "account-choice";
  language: LanguageCode;
  entryPath: "owner";
}

export interface NewOwnerAuthPendingState {
  version: typeof NEW_OWNER_ONBOARDING_VERSION;
  screen: "auth-pending";
  language: LanguageCode;
  entryPath: "owner";
  authIntent: OnboardingAuthIntent;
}

export interface NewOwnerBabyState {
  version: typeof NEW_OWNER_ONBOARDING_VERSION;
  screen: "owner-baby";
  language: LanguageCode;
  entryPath: "owner";
  accountMode: "guest" | "authenticated";
  babyDraft: BabyProfileDraft;
}

export interface NewOwnerInvitationState {
  version: typeof NEW_OWNER_ONBOARDING_VERSION;
  screen: "invitation";
  language: LanguageCode;
  entryPath: "owner";
  babyId: string;
  invitation:
    | { status: "pending" }
    | { status: "ready"; invitationId: string };
}

export interface NewOwnerFirstActivityState {
  version: typeof NEW_OWNER_ONBOARDING_VERSION;
  screen: "first-activity";
  language: LanguageCode;
  entryPath: "owner";
  babyId: string;
  firstActivity: { status: "pending" };
}

export interface NewOwnerActivitySavedState {
  version: typeof NEW_OWNER_ONBOARDING_VERSION;
  screen: "activity-saved";
  language: LanguageCode;
  entryPath: "owner";
  babyId: string;
  firstActivity: { status: "saved"; activityType: FirstActivityType };
}

export interface NewOwnerCompletedState {
  version: typeof NEW_OWNER_ONBOARDING_VERSION;
  screen: "completed";
  language: LanguageCode;
  entryPath: "legacy" | "owner" | "authenticated-existing";
  babyId: string | null;
  firstActivity:
    | { status: "legacy-completed" }
    | { status: "existing-account" }
    | { status: "skipped" }
    | { status: "timer-started"; activityType: FirstActivityType }
    | { status: "saved"; activityType: FirstActivityType };
}

export type FirstActivityType =
  | "feeding"
  | "sleep"
  | "diaper"
  | "pumping"
  | "growth"
  | "tummyTime"
  | "health"
  | "milestones";

export type NewOwnerOnboardingState =
  | NewOwnerWelcomeState
  | NewOwnerAccountChoiceState
  | NewOwnerAuthPendingState
  | NewOwnerBabyState
  | NewOwnerInvitationState
  | NewOwnerFirstActivityState
  | NewOwnerActivitySavedState
  | NewOwnerCompletedState;
