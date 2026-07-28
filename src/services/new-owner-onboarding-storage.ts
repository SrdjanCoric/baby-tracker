import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LanguageCode } from "@/services/language-storage";
import { OnboardingStorageService } from "@/services/onboarding-storage";
import {
  NEW_OWNER_ONBOARDING_VERSION,
  type BabyProfileDraft,
  type FirstActivityType,
  type NewOwnerOnboardingState,
} from "@/types/new-owner-onboarding";

const NEW_OWNER_ONBOARDING_KEY = "@new_owner_onboarding_v2";
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

function isStoredState(value: unknown): value is NewOwnerOnboardingState {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  if (state.version !== NEW_OWNER_ONBOARDING_VERSION || !isLanguage(state.language)) return false;

  if (state.screen === "welcome") {
    return state.entryPath === null && isBabyDraft(state.babyDraft);
  }
  if (state.screen === "owner-baby") {
    return state.entryPath === "owner" && isBabyDraft(state.babyDraft);
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
    return hasOwnerCompletion || hasLegacyCompletion;
  }
  return false;
}

async function readStoredState(): Promise<NewOwnerOnboardingState | null> {
  const stored = await AsyncStorage.getItem(NEW_OWNER_ONBOARDING_KEY);
  if (!stored) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    return isStoredState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function persistState(state: NewOwnerOnboardingState): Promise<void> {
  await AsyncStorage.setItem(NEW_OWNER_ONBOARDING_KEY, JSON.stringify(state));
}

let mutationTail = Promise.resolve();

function enqueueMutation(operation: () => Promise<void>): Promise<void> {
  const result = mutationTail.then(operation);
  mutationTail = result.catch(() => undefined);
  return result;
}

export const NewOwnerOnboardingStorageService = {
  async getState(language: LanguageCode): Promise<NewOwnerOnboardingState> {
    const [storedState, legacyStatus] = await Promise.all([
      readStoredState(),
      OnboardingStorageService.getOnboardingStatus(),
    ]);
    if (storedState?.screen === "completed") return storedState;
    if (legacyStatus.hasCompleted || legacyStatus.skipped) {
      return {
        version: NEW_OWNER_ONBOARDING_VERSION,
        screen: "completed",
        language: storedState?.language ?? language,
        entryPath: "legacy",
        babyId: null,
        firstActivity: { status: "legacy-completed" },
      };
    }
    return storedState ?? createInitialState(language);
  },

  updateLanguage(language: LanguageCode): Promise<void> {
    return enqueueMutation(async () => {
      const current = await readStoredState();
      await persistState(current ? { ...current, language } : createInitialState(language));
    });
  },

  beginOwnerPath(language: LanguageCode): Promise<void> {
    return enqueueMutation(() => persistState({
      version: NEW_OWNER_ONBOARDING_VERSION,
      screen: "owner-baby",
      language,
      entryPath: "owner",
      babyDraft: createEmptyDraft(),
    }));
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
      await OnboardingStorageService.markOnboardingComplete(false);
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
      await OnboardingStorageService.markOnboardingComplete(false);
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
      await OnboardingStorageService.markOnboardingComplete(false);
    });
  },

  startOver(): Promise<void> {
    return enqueueMutation(() => AsyncStorage.removeItem(NEW_OWNER_ONBOARDING_KEY));
  },
};
