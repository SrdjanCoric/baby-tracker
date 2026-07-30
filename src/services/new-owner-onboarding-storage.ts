import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LanguageCode } from "@/services/language-storage";
import {
  NEW_OWNER_ONBOARDING_VERSION,
  type BabyProfileDraft,
  type CaregiverCodeValidationReason,
  type CaregiverJoinFailureReason,
  type FirstActivityType,
  type NewOwnerOnboardingState,
  type OnboardingAuthIntent,
  type ReturningRestorationFailureReason,
} from "@/types/new-owner-onboarding";
import { normalizeInviteCode, validateInviteCode } from "@/utils/inviteCode";

const NEW_OWNER_ONBOARDING_KEY = "@new_owner_onboarding_v2";
const LEGACY_ONBOARDING_STATUS_KEY = "@onboarding_status";
const VALID_LANGUAGES: LanguageCode[] = [
  "en",
  "sr",
  "es",
  "es-ES",
  "fr",
  "pt-PT",
  "pt-BR",
  "de",
  "it",
  "system",
];
const FIRST_ACTIVITY_TYPES: FirstActivityType[] = [
  "feeding",
  "sleep",
  "diaper",
  "pumping",
  "growth",
  "tummyTime",
  "health",
  "milestones",
];

function createEmptyDraft(): BabyProfileDraft {
  return { name: "", birthDate: null, gender: null };
}

function createInitialState(language: LanguageCode): NewOwnerOnboardingState {
  return {
    version: NEW_OWNER_ONBOARDING_VERSION,
    screen: "welcome",
    language,
    entryPath: null,
    babyDraft: createEmptyDraft(),
  };
}

function isLanguage(value: unknown): value is LanguageCode {
  return typeof value === "string" && VALID_LANGUAGES.includes(value as LanguageCode);
}

function isFirstActivityType(value: unknown): value is FirstActivityType {
  return (
    typeof value === "string" &&
    FIRST_ACTIVITY_TYPES.includes(value as FirstActivityType)
  );
}

function isBabyDraft(value: unknown): value is BabyProfileDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  return (
    typeof draft.name === "string" &&
    (draft.birthDate === null || typeof draft.birthDate === "string") &&
    (draft.gender === null || draft.gender === "male" || draft.gender === "female")
  );
}

function isValidPendingCode(value: unknown, allowEmpty = false): value is string {
  if (typeof value !== "string") return false;
  if (allowEmpty && value === "") return true;
  return validateInviteCode(value).isValid && normalizeInviteCode(value) === value;
}

function toCaregiverCodeValidationReason(error: string | undefined): CaregiverCodeValidationReason {
  if (error === "inviteCodeRequired" || error === "inviteCodeLength") return error;
  return "inviteCodeInvalidChars";
}

function isCaregiverJoinFailureReason(value: unknown): value is CaregiverJoinFailureReason {
  return value === "invalidInvitation" ||
    value === "alreadyInHousehold" ||
    value === "ownHousehold" ||
    value === "sharedHousehold" ||
    value === "rateLimitExceeded" ||
    value === "joinFailed" ||
    value === "offline" ||
    value === "refreshFailed";
}

function isStoredState(value: unknown): value is NewOwnerOnboardingState {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  if (state.version !== NEW_OWNER_ONBOARDING_VERSION || !isLanguage(state.language)) return false;

  if (state.screen === "welcome") {
    return state.entryPath === null && isBabyDraft(state.babyDraft);
  }
  if (state.screen === "returning-auth") {
    return state.entryPath === "returning" && state.authIntent === "returning-user";
  }
  if (state.screen === "returning-restoring") {
    return state.entryPath === "returning" &&
      Number.isInteger(state.attempt) &&
      Number(state.attempt) > 0 &&
      (state.householdId === null || typeof state.householdId === "string");
  }
  if (state.screen === "returning-restored") {
    return state.entryPath === "returning" &&
      Number.isInteger(state.attempt) &&
      Number(state.attempt) > 0 &&
      typeof state.householdId === "string" &&
      typeof state.babyId === "string";
  }
  if (state.screen === "returning-verified-empty") {
    return state.entryPath === "returning" &&
      Number.isInteger(state.attempt) &&
      Number(state.attempt) > 0 &&
      typeof state.householdId === "string";
  }
  if (state.screen === "returning-unavailable") {
    return state.entryPath === "returning" &&
      Number.isInteger(state.attempt) &&
      Number(state.attempt) > 0 &&
      (state.householdId === null || typeof state.householdId === "string") &&
      (state.reason === "auth" ||
        state.reason === "profile" ||
        state.reason === "household" ||
        state.reason === "babies" ||
        state.reason === "selection");
  }
  if (state.screen === "returning-signed-out") {
    return state.entryPath === "returning";
  }
  if (state.screen === "join-code") {
    return state.entryPath === "caregiver" && isValidPendingCode(state.pendingCode, true);
  }
  if (state.screen === "join-auth-pending") {
    return state.entryPath === "caregiver" &&
      state.authIntent === "join-family" &&
      isValidPendingCode(state.pendingCode);
  }
  if (state.screen === "join-confirmation" || state.screen === "joining") {
    return state.entryPath === "caregiver" &&
      typeof state.sourceHouseholdId === "string" &&
      isValidPendingCode(state.pendingCode);
  }
  if (state.screen === "join-refresh") {
    return state.entryPath === "caregiver" &&
      typeof state.householdId === "string" &&
      isValidPendingCode(state.pendingCode);
  }
  if (state.screen === "join-failure") {
    return state.entryPath === "caregiver" &&
      (state.recovery === "confirmation" ||
        state.recovery === "refresh" ||
        state.recovery === "reconcile") &&
      isCaregiverJoinFailureReason(state.reason) &&
      typeof state.householdId === "string" &&
      isValidPendingCode(state.pendingCode);
  }
  if (state.screen === "account-choice") {
    return state.entryPath === "owner";
  }
  if (state.screen === "auth-pending") {
    return (
      state.entryPath === "owner" &&
      (state.authIntent === "sign-in" || state.authIntent === "create-account")
    );
  }
  if (state.screen === "owner-baby") {
    return (
      state.entryPath === "owner" &&
      (state.accountMode === "guest" || state.accountMode === "authenticated") &&
      isBabyDraft(state.babyDraft)
    );
  }
  if (state.screen === "invitation") {
    const invitation = state.invitation as Record<string, unknown> | undefined;
    return (
      state.entryPath === "owner" &&
      typeof state.babyId === "string" &&
      (invitation?.status === "pending" ||
        (invitation?.status === "ready" && typeof invitation.invitationId === "string"))
    );
  }
  if (state.screen === "first-activity") {
    const firstActivity = state.firstActivity as Record<string, unknown> | undefined;
    return (
      state.entryPath === "owner" &&
      typeof state.babyId === "string" &&
      firstActivity?.status === "pending"
    );
  }
  if (state.screen === "activity-saved") {
    const firstActivity = state.firstActivity as Record<string, unknown> | undefined;
    return (
      state.entryPath === "owner" &&
      typeof state.babyId === "string" &&
      firstActivity?.status === "saved" &&
      isFirstActivityType(firstActivity.activityType)
    );
  }
  if (state.screen === "completed") {
    const firstActivity = state.firstActivity as Record<string, unknown> | undefined;
    const hasOwnerCompletion =
      state.entryPath === "owner" &&
      typeof state.babyId === "string" &&
      (firstActivity?.status === "skipped" ||
        ((firstActivity?.status === "timer-started" || firstActivity?.status === "saved") &&
          isFirstActivityType(firstActivity.activityType)));
    const hasLegacyCompletion =
      state.entryPath === "legacy" &&
      state.babyId === null &&
      firstActivity?.status === "legacy-completed";
    const hasExistingAccountCompletion =
      state.entryPath === "authenticated-existing" &&
      typeof state.babyId === "string" &&
      firstActivity?.status === "existing-account";
    const hasCaregiverCompletion =
      state.entryPath === "caregiver" &&
      typeof state.babyId === "string" &&
      firstActivity?.status === "joined-household";
    return hasOwnerCompletion || hasLegacyCompletion || hasExistingAccountCompletion || hasCaregiverCompletion;
  }
  return false;
}

async function readStoredState(): Promise<NewOwnerOnboardingState | null> {
  const stored = await AsyncStorage.getItem(NEW_OWNER_ONBOARDING_KEY);
  if (!stored) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (parsed && typeof parsed === "object") {
      const legacyState = parsed as Record<string, unknown>;
      if (
        legacyState.version === NEW_OWNER_ONBOARDING_VERSION &&
        legacyState.screen === "owner-baby" &&
        legacyState.entryPath === "owner" &&
        legacyState.accountMode === undefined &&
        isLanguage(legacyState.language) &&
        isBabyDraft(legacyState.babyDraft)
      ) {
        return {
          version: NEW_OWNER_ONBOARDING_VERSION,
          screen: "owner-baby",
          language: legacyState.language,
          entryPath: "owner",
          accountMode: "guest",
          babyDraft: legacyState.babyDraft,
        };
      }
    }
    return isStoredState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function persistState(state: NewOwnerOnboardingState): Promise<void> {
  await AsyncStorage.setItem(NEW_OWNER_ONBOARDING_KEY, JSON.stringify(state));
}

async function hasLegacyCompletion(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(LEGACY_ONBOARDING_STATUS_KEY);
  if (!stored) return false;

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") return false;
    const status = parsed as Record<string, unknown>;
    const isValid =
      typeof status.hasCompleted === "boolean" &&
      (status.completedAt === null || typeof status.completedAt === "string") &&
      typeof status.skipped === "boolean";
    return isValid && (status.hasCompleted === true || status.skipped === true);
  } catch {
    return false;
  }
}

class CaregiverCodeValidationError extends Error {
  constructor(readonly reason: CaregiverCodeValidationReason) {
    super(reason);
  }
}

let mutationTail = Promise.resolve();

function enqueueMutation(operation: () => Promise<void>): Promise<void> {
  const result = mutationTail.then(operation);
  mutationTail = result.catch(() => undefined);
  return result;
}

export const NewOwnerOnboardingStorageService = {
  async getState(language: LanguageCode): Promise<NewOwnerOnboardingState> {
    const [storedState, legacyCompleted] = await Promise.all([
      readStoredState(),
      hasLegacyCompletion(),
    ]);
    if (storedState?.screen === "completed" || storedState?.screen === "returning-restored") {
      return storedState;
    }
    if (legacyCompleted) {
      const migratedState: NewOwnerOnboardingState = {
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "completed",
        language: storedState?.language ?? language,
        entryPath: "legacy",
        babyId: null,
        firstActivity: { status: "legacy-completed" },
      };
      await persistState(migratedState);
      return migratedState;
    }
    return storedState ?? createInitialState(language);
  },

  updateLanguage(language: LanguageCode): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      await persistState(current ? { ...current, language } : createInitialState(language));
    });
  },

  beginReturningAuthentication(language: LanguageCode): Promise<void> {
    return enqueueMutation(() => persistState({
      version: NEW_OWNER_ONBOARDING_VERSION,
      screen: "returning-auth",
      language,
      entryPath: "returning",
      authIntent: "returning-user",
    }));
  },

  beginReturningRestoration(): Promise<number | null> {
    let attempt: number | null = null;
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current) return;
      if (current.screen === "returning-restoring") {
        attempt = current.attempt;
        return;
      }
      if (current.screen !== "returning-auth") return;
      attempt = 1;
      await persistState({
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "returning-restoring",
        language: current.language,
        entryPath: "returning",
        attempt,
        householdId: null,
      });
    }).then(() => attempt);
  },

  attachReturningHousehold(attempt: number, householdId: string): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "returning-restoring" || current.attempt !== attempt) return;
      await persistState({ ...current, householdId });
    });
  },

  markReturningUnavailable(
    attempt: number,
    reason: ReturningRestorationFailureReason
  ): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "returning-restoring" || current.attempt !== attempt) return;
      await persistState({
        ...current,
        screen: "returning-unavailable",
        reason,
      });
    });
  },

  retryReturningRestoration(): Promise<number | null> {
    let attempt: number | null = null;
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "returning-unavailable") return;
      attempt = current.attempt + 1;
      await persistState({
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "returning-restoring",
        language: current.language,
        entryPath: "returning",
        attempt,
        householdId: null,
      });
    }).then(() => attempt);
  },

  revalidateReturningRestoration(): Promise<number | null> {
    let attempt: number | null = null;
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current ||
        (current.screen !== "returning-verified-empty" &&
          current.screen !== "returning-restored")) return;
      attempt = current.attempt + 1;
      await persistState({
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "returning-restoring",
        language: current.language,
        entryPath: "returning",
        attempt,
        householdId: null,
      });
    }).then(() => attempt);
  },

  markReturningVerifiedEmpty(attempt: number, householdId: string): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current ||
        current.screen !== "returning-restoring" ||
        current.attempt !== attempt ||
        current.householdId !== householdId) return;
      await persistState({
        ...current,
        screen: "returning-verified-empty",
        householdId,
      });
    });
  },

  markReturningRestored(
    attempt: number,
    householdId: string,
    babyId: string
  ): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current ||
        current.screen !== "returning-restoring" ||
        current.attempt !== attempt ||
        current.householdId !== householdId) return;
      await persistState({
        ...current,
        screen: "returning-restored",
        householdId,
        babyId,
      });
    });
  },

  continueReturningWithBaby(): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "returning-verified-empty") return;
      await persistState({
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "owner-baby",
        language: current.language,
        entryPath: "owner",
        accountMode: "authenticated",
        babyDraft: createEmptyDraft(),
      });
    });
  },

  continueReturningWithFamilyJoin(): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "returning-verified-empty") return;
      await persistState({
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "join-code",
        language: current.language,
        entryPath: "caregiver",
        pendingCode: "",
      });
    });
  },

  markReturningSignedOut(): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || !current.screen.startsWith("returning-")) return;
      await persistState({
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "returning-signed-out",
        language: current.language,
        entryPath: "returning",
      });
    });
  },

  beginCaregiverPath(language: LanguageCode): Promise<void> {
    return enqueueMutation(() => persistState({
      version: NEW_OWNER_ONBOARDING_VERSION,
      screen: "join-code",
      language,
      entryPath: "caregiver",
      pendingCode: "",
    }));
  },

  beginCaregiverAuthentication(inviteCode: string): Promise<
    { success: true } | { success: false; error: CaregiverCodeValidationReason }
  > {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || (current.screen !== "join-code" && current.screen !== "join-confirmation")) {
        return;
      }
      const validation = validateInviteCode(inviteCode);
      if (!validation.isValid) {
        throw new CaregiverCodeValidationError(toCaregiverCodeValidationReason(validation.error));
      }
      await persistState({
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "join-auth-pending",
        language: current.language,
        entryPath: "caregiver",
        pendingCode: normalizeInviteCode(inviteCode),
        authIntent: "join-family",
      });
    }).then(
      () => ({ success: true as const }),
      error => error instanceof CaregiverCodeValidationError
        ? { success: false as const, error: error.reason }
        : Promise.reject(error)
    );
  },

  updateCaregiverCode(inviteCode: string): Promise<
    | { success: true; pendingCode: string }
    | { success: false; error: CaregiverCodeValidationReason }
  > {
    let pendingCode = "";
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "join-confirmation") return;
      const validation = validateInviteCode(inviteCode);
      if (!validation.isValid) {
        throw new CaregiverCodeValidationError(toCaregiverCodeValidationReason(validation.error));
      }
      pendingCode = normalizeInviteCode(inviteCode);
      await persistState({ ...current, pendingCode });
    }).then(
      () => ({ success: true as const, pendingCode }),
      error => error instanceof CaregiverCodeValidationError
        ? { success: false as const, error: error.reason }
        : Promise.reject(error)
    );
  },

  beginOwnerPath(language: LanguageCode): Promise<void> {
    return enqueueMutation(() => persistState({
      version: NEW_OWNER_ONBOARDING_VERSION,
      screen: "account-choice",
      language,
      entryPath: "owner",
    }));
  },

  beginAuthentication(authIntent: OnboardingAuthIntent): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || (current.screen !== "account-choice" && current.screen !== "auth-pending")) return;
      await persistState({
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "auth-pending",
        language: current.language,
        entryPath: "owner",
        authIntent,
      });
    });
  },

  cancelAuthentication(): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current) return;
      if (current.screen === "returning-auth") {
        await persistState(createInitialState(current.language));
        return;
      }
      if (current.screen === "join-auth-pending") {
        await persistState({
          version: NEW_OWNER_ONBOARDING_VERSION,
          screen: "join-code",
          language: current.language,
          entryPath: "caregiver",
          pendingCode: current.pendingCode,
        });
        return;
      }
      if (current.screen !== "auth-pending") return;
      await persistState({
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "account-choice",
        language: current.language,
        entryPath: "owner",
      });
    });
  },

  resumeCaregiverAuthentication(sourceHouseholdId: string): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "join-auth-pending") return;
      await persistState({
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "join-confirmation",
        language: current.language,
        entryPath: "caregiver",
        pendingCode: current.pendingCode,
        sourceHouseholdId,
      });
    });
  },

  beginCaregiverJoin(): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "join-confirmation") return;
      await persistState({ ...current, screen: "joining" });
    });
  },

  recoverInterruptedCaregiverJoin(currentHouseholdId: string): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "joining") return;
      if (currentHouseholdId !== current.sourceHouseholdId) {
        await persistState({
          version: NEW_OWNER_ONBOARDING_VERSION,
          screen: "join-refresh",
          language: current.language,
          entryPath: "caregiver",
          pendingCode: current.pendingCode,
          householdId: currentHouseholdId,
        });
        return;
      }
      await persistState({ ...current, screen: "join-confirmation" });
    });
  },

  markCaregiverJoinRedeemed(householdId: string): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "joining") return;
      await persistState({
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "join-refresh",
        language: current.language,
        entryPath: "caregiver",
        pendingCode: current.pendingCode,
        householdId,
      });
    });
  },

  markCaregiverJoinFailure(reason: CaregiverJoinFailureReason): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "joining") return;
      await persistState({
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "join-failure",
        language: current.language,
        entryPath: "caregiver",
        pendingCode: current.pendingCode,
        recovery: "confirmation",
        reason,
        householdId: current.sourceHouseholdId,
      });
    });
  },

  markCaregiverReconciliationFailure(): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "joining") return;
      await persistState({
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "join-failure",
        language: current.language,
        entryPath: "caregiver",
        pendingCode: current.pendingCode,
        recovery: "reconcile",
        reason: "offline",
        householdId: current.sourceHouseholdId,
      });
    });
  },

  markCaregiverRefreshFailure(): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "join-refresh") return;
      await persistState({
        ...current,
        screen: "join-failure",
        recovery: "refresh",
        reason: "refreshFailed",
      });
    });
  },

  retryCaregiverJoin(): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "join-failure") return;
      if (current.recovery === "reconcile") {
        await persistState({
          version: NEW_OWNER_ONBOARDING_VERSION,
          screen: "joining",
          language: current.language,
          entryPath: "caregiver",
          pendingCode: current.pendingCode,
          sourceHouseholdId: current.householdId,
        });
        return;
      }
      if (current.recovery === "refresh") {
        await persistState({
          version: NEW_OWNER_ONBOARDING_VERSION,
          screen: "join-refresh",
          language: current.language,
          entryPath: "caregiver",
          pendingCode: current.pendingCode,
          householdId: current.householdId,
        });
        return;
      }
      await persistState({
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "join-confirmation",
        language: current.language,
        entryPath: "caregiver",
        pendingCode: current.pendingCode,
        sourceHouseholdId: current.householdId,
      });
    });
  },

  completeCaregiverJoin(babyId: string): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "join-refresh") return;
      await persistState({
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "completed",
        language: current.language,
        entryPath: "caregiver",
        babyId,
        firstActivity: { status: "joined-household" },
      });
    });
  },

  resumeAuthenticatedAccount(babyId: string | null): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "auth-pending") return;
      if (babyId) {
        await persistState({
          version: NEW_OWNER_ONBOARDING_VERSION,
          screen: "completed",
          language: current.language,
          entryPath: "authenticated-existing",
          babyId,
          firstActivity: { status: "existing-account" },
        });
        return;
      }
      await persistState({
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "owner-baby",
        language: current.language,
        entryPath: "owner",
        accountMode: "authenticated",
        babyDraft: createEmptyDraft(),
      });
    });
  },

  continueOnDevice(): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "account-choice") return;
      await persistState({
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "owner-baby",
        language: current.language,
        entryPath: "owner",
        accountMode: "guest",
        babyDraft: createEmptyDraft(),
      });
    });
  },

  updateBabyDraft(draft: BabyProfileDraft): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "owner-baby") return;
      await persistState({ ...current, babyDraft: draft });
    });
  },

  markBabyCreated(babyId: string): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "owner-baby") return;
      if (current.accountMode === "authenticated") {
        await persistState({
          version: NEW_OWNER_ONBOARDING_VERSION,
          screen: "invitation",
          language: current.language,
          entryPath: "owner",
          babyId,
          invitation: { status: "pending" },
        });
        return;
      }
      await persistState({
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "first-activity",
        language: current.language,
        entryPath: "owner",
        babyId,
        firstActivity: { status: "pending" },
      });
    });
  },

  markInvitationReady(invitationId: string): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "invitation") return;
      await persistState({
        ...current,
        invitation: { status: "ready", invitationId },
      });
    });
  },

  completeRemainingSetup(): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "invitation") return;
      await persistState({
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "completed",
        language: current.language,
        entryPath: "owner",
        babyId: current.babyId,
        firstActivity: { status: "skipped" },
      });
    });
  },

  skipInvitation(): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "invitation") return;
      await persistState({
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "first-activity",
        language: current.language,
        entryPath: "owner",
        babyId: current.babyId,
        firstActivity: { status: "pending" },
      });
    });
  },

  markActivitySaved(activityType: FirstActivityType): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "first-activity") return;
      await persistState({
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "activity-saved",
        language: current.language,
        entryPath: "owner",
        babyId: current.babyId,
        firstActivity: { status: "saved", activityType },
      });
    });
  },

  completeSavedActivity(): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "activity-saved") return;
      await persistState({
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "completed",
        language: current.language,
        entryPath: "owner",
        babyId: current.babyId,
        firstActivity: current.firstActivity,
      });
    });
  },

  completeWithoutActivity(): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "first-activity") return;
      await persistState({
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "completed",
        language: current.language,
        entryPath: "owner",
        babyId: current.babyId,
        firstActivity: { status: "skipped" },
      });
    });
  },

  completeTimerStarted(activityType: FirstActivityType): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen !== "first-activity") return;
      await persistState({
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "completed",
        language: current.language,
        entryPath: "owner",
        babyId: current.babyId,
        firstActivity: { status: "timer-started", activityType },
      });
    });
  },

  clearUnfinishedDraft(): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      if (!current || current.screen === "completed" || current.screen === "returning-restored") {
        return;
      }
      await AsyncStorage.removeItem(NEW_OWNER_ONBOARDING_KEY);
    });
  },

  startOver(): Promise<void> {
    return enqueueMutation(() => AsyncStorage.removeItem(NEW_OWNER_ONBOARDING_KEY));
  },

  resetForDevelopment(): Promise<void> {
    return enqueueMutation(async () => {
      await AsyncStorage.removeItem(LEGACY_ONBOARDING_STATUS_KEY);
      await AsyncStorage.removeItem(NEW_OWNER_ONBOARDING_KEY);
    });
  },
};
