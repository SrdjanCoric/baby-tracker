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

export type CaregiverCodeValidationReason =
  | "inviteCodeRequired"
  | "inviteCodeLength"
  | "inviteCodeInvalidChars";

export type CaregiverJoinFailureReason =
  | "invalidInvitation"
  | "alreadyInHousehold"
  | "ownHousehold"
  | "sharedHousehold"
  | "rateLimitExceeded"
  | "joinFailed"
  | "offline"
  | "refreshFailed";

interface CaregiverJoinStateBase {
  version: typeof NEW_OWNER_ONBOARDING_VERSION;
  language: LanguageCode;
  entryPath: "caregiver";
  pendingCode: string;
}

export interface CaregiverJoinCodeState extends CaregiverJoinStateBase {
  screen: "join-code";
}

export interface CaregiverJoinAuthPendingState extends CaregiverJoinStateBase {
  screen: "join-auth-pending";
  authIntent: "join-family";
}

export interface CaregiverJoinConfirmationState extends CaregiverJoinStateBase {
  screen: "join-confirmation";
  sourceHouseholdId: string;
}

export interface CaregiverJoiningState extends CaregiverJoinStateBase {
  screen: "joining";
  sourceHouseholdId: string;
}

export interface CaregiverJoinRefreshState extends CaregiverJoinStateBase {
  screen: "join-refresh";
  householdId: string;
}

export interface CaregiverJoinFailureState extends CaregiverJoinStateBase {
  screen: "join-failure";
  recovery: "confirmation" | "refresh" | "reconcile";
  reason: CaregiverJoinFailureReason;
  householdId: string;
}

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
  entryPath: "legacy" | "owner" | "authenticated-existing" | "caregiver";
  babyId: string | null;
  firstActivity:
    | { status: "legacy-completed" }
    | { status: "existing-account" }
    | { status: "joined-household" }
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
  | CaregiverJoinCodeState
  | CaregiverJoinAuthPendingState
  | CaregiverJoinConfirmationState
  | CaregiverJoiningState
  | CaregiverJoinRefreshState
  | CaregiverJoinFailureState
  | NewOwnerAccountChoiceState
  | NewOwnerAuthPendingState
  | NewOwnerBabyState
  | NewOwnerInvitationState
  | NewOwnerFirstActivityState
  | NewOwnerActivitySavedState
  | NewOwnerCompletedState;
