import { beforeEach, describe, expect, it, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NewOwnerOnboardingStorageService } from "./new-owner-onboarding-storage";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe("NewOwnerOnboardingStorageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts a new versioned flow at the named welcome state", async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toEqual({
      version: 2,
      screen: "welcome",
      language: "system",
      entryPath: null,
      babyDraft: {
        name: "",
        birthDate: null,
        gender: null,
      },
    });
  });

  it("persists a language choice before an entry path is selected", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.updateLanguage("it");

    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "welcome",
      language: "it",
    });
  });

  it("asks for an account choice before starting guest baby setup", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.beginOwnerPath("de");

    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "account-choice",
      language: "de",
      entryPath: "owner",
    });

    await NewOwnerOnboardingStorageService.continueOnDevice();

    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "owner-baby",
      accountMode: "guest",
    });
  });

  it("resumes authenticated accounts without babies at baby setup", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.beginOwnerPath("en");
    await NewOwnerOnboardingStorageService.beginAuthentication("create-account");
    await NewOwnerOnboardingStorageService.resumeAuthenticatedAccount(false);

    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "owner-baby",
      accountMode: "authenticated",
      babyDraft: { name: "", birthDate: null, gender: null },
    });
  });

  it("completes onboarding when authentication restores an account with babies", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.beginOwnerPath("en");
    await NewOwnerOnboardingStorageService.beginAuthentication("sign-in");
    await NewOwnerOnboardingStorageService.resumeAuthenticatedAccount(true);

    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "completed",
      entryPath: "authenticated-existing",
      firstActivity: { status: "existing-account" },
    });
    expect(JSON.parse(storage.get("@onboarding_status") ?? "null")).toMatchObject({
      hasCompleted: true,
      skipped: false,
    });
  });

  it("persists the named owner baby state and partial profile", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.beginOwnerPath("de");
    await NewOwnerOnboardingStorageService.continueOnDevice();
    await NewOwnerOnboardingStorageService.updateBabyDraft({
      name: "Mila",
      birthDate: "2026-06-12T00:00:00.000Z",
      gender: "female",
    });

    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toEqual({
      version: 2,
      screen: "owner-baby",
      language: "de",
      entryPath: "owner",
      accountMode: "guest",
      babyDraft: {
        name: "Mila",
        birthDate: "2026-06-12T00:00:00.000Z",
        gender: "female",
      },
    });
  });

  it("serializes rapid draft writes so the latest entered value wins", async () => {
    const storage = new Map<string, string>();
    let releaseFirstWrite: (() => void) | undefined;
    const firstWriteBlocked = new Promise<void>(resolve => {
      releaseFirstWrite = resolve;
    });
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      const parsed = JSON.parse(value) as { babyDraft?: { name?: string } };
      if (key === "@new_owner_onboarding_v2" && parsed.babyDraft?.name === "M") {
        await firstWriteBlocked;
      }
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.beginOwnerPath("en");
    await NewOwnerOnboardingStorageService.continueOnDevice();
    const first = NewOwnerOnboardingStorageService.updateBabyDraft({
      name: "M",
      birthDate: null,
      gender: null,
    });
    const second = NewOwnerOnboardingStorageService.updateBabyDraft({
      name: "Mila",
      birthDate: null,
      gender: null,
    });
    await Promise.resolve();
    releaseFirstWrite?.();
    await Promise.all([first, second]);

    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      babyDraft: { name: "Mila" },
    });
  });

  it("offers an invitation after an authenticated baby is created", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.beginOwnerPath("en");
    await NewOwnerOnboardingStorageService.beginAuthentication("create-account");
    await NewOwnerOnboardingStorageService.resumeAuthenticatedAccount(false);
    await NewOwnerOnboardingStorageService.markBabyCreated("baby-1");

    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "invitation",
      babyId: "baby-1",
      invitation: { status: "pending" },
    });
  });

  it("continues from the optional invitation to first activity", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.beginOwnerPath("en");
    await NewOwnerOnboardingStorageService.beginAuthentication("create-account");
    await NewOwnerOnboardingStorageService.resumeAuthenticatedAccount(false);
    await NewOwnerOnboardingStorageService.markBabyCreated("baby-1");
    await NewOwnerOnboardingStorageService.skipInvitation();

    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "first-activity",
      babyId: "baby-1",
      firstActivity: { status: "pending" },
    });
  });

  it("resumes first-activity setup after a baby is created", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.beginOwnerPath("sr");
    await NewOwnerOnboardingStorageService.continueOnDevice();
    await NewOwnerOnboardingStorageService.markBabyCreated("baby-1");

    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toEqual({
      version: 2,
      screen: "first-activity",
      language: "sr",
      entryPath: "owner",
      babyId: "baby-1",
      firstActivity: { status: "pending" },
    });
  });

  it("resumes at the saved confirmation after a real activity is recorded", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.beginOwnerPath("en");
    await NewOwnerOnboardingStorageService.continueOnDevice();
    await NewOwnerOnboardingStorageService.markBabyCreated("baby-1");
    await NewOwnerOnboardingStorageService.markActivitySaved("diaper");

    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toEqual({
      version: 2,
      screen: "activity-saved",
      language: "en",
      entryPath: "owner",
      babyId: "baby-1",
      firstActivity: { status: "saved", activityType: "diaper" },
    });
  });

  it("completes immediately when a first-activity timer starts", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.beginOwnerPath("en");
    await NewOwnerOnboardingStorageService.continueOnDevice();
    await NewOwnerOnboardingStorageService.markBabyCreated("baby-1");
    await NewOwnerOnboardingStorageService.completeTimerStarted("sleep");

    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toEqual({
      version: 2,
      screen: "completed",
      language: "en",
      entryPath: "owner",
      babyId: "baby-1",
      firstActivity: { status: "timer-started", activityType: "sleep" },
    });
    expect(JSON.parse(storage.get("@onboarding_status") ?? "null")).toMatchObject({
      hasCompleted: true,
      skipped: false,
    });
  });

  it("starts over by clearing only the unfinished versioned draft", async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

    await NewOwnerOnboardingStorageService.startOver();

    expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("@new_owner_onboarding_v2");
  });

  it("recovers an unfinished version 2 baby draft created before account choice", async () => {
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => {
      if (key === "@new_owner_onboarding_v2") {
        return JSON.stringify({
          version: 2,
          screen: "owner-baby",
          language: "en",
          entryPath: "owner",
          babyDraft: { name: "Mila", birthDate: null, gender: null },
        });
      }
      return null;
    });

    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "owner-baby",
      accountMode: "guest",
      babyDraft: { name: "Mila" },
    });
  });

  it("treats legacy completed and skipped records as completed", async () => {
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => {
      if (key === "@onboarding_status") {
        return JSON.stringify({
          hasCompleted: true,
          completedAt: "2026-07-28T12:00:00.000Z",
          skipped: true,
        });
      }
      return null;
    });

    await expect(NewOwnerOnboardingStorageService.getState("en")).resolves.toEqual({
      version: 2,
      screen: "completed",
      language: "en",
      entryPath: "legacy",
      babyId: null,
      firstActivity: { status: "legacy-completed" },
    });
  });
});
