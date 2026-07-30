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

  it("starts caregiver code entry without authentication or household access", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.beginCaregiverPath("fr");

    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toEqual({
      version: 2,
      screen: "join-code",
      language: "fr",
      entryPath: "caregiver",
      pendingCode: "",
    });
  });

  it("validates and persists a normalized caregiver code through auth cancellation and restart", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.beginCaregiverPath("en");
    await expect(
      NewOwnerOnboardingStorageService.beginCaregiverAuthentication("bad")
    ).resolves.toEqual({ success: false, error: "inviteCodeLength" });
    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "join-code",
      pendingCode: "",
    });

    await expect(
      NewOwnerOnboardingStorageService.beginCaregiverAuthentication("abcd-2345")
    ).resolves.toEqual({ success: true });
    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "join-auth-pending",
      pendingCode: "ABCD2345",
    });

    await NewOwnerOnboardingStorageService.cancelAuthentication();

    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "join-code",
      entryPath: "caregiver",
      pendingCode: "ABCD2345",
    });
  });

  it("lets an authenticated caregiver replace a rejected code without repeating authentication", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.beginCaregiverPath("en");
    await NewOwnerOnboardingStorageService.beginCaregiverAuthentication("ABCD2345");
    await NewOwnerOnboardingStorageService.resumeCaregiverAuthentication("solo-household");

    await expect(
      NewOwnerOnboardingStorageService.updateCaregiverCode("WXYZ-6789")
    ).resolves.toEqual({ success: true, pendingCode: "WXYZ6789" });
    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "join-confirmation",
      pendingCode: "WXYZ6789",
      sourceHouseholdId: "solo-household",
    });
  });

  it("persists caregiver confirmation, joining, refresh failure, retry, and completion", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.beginCaregiverPath("en");
    await NewOwnerOnboardingStorageService.beginCaregiverAuthentication("ABCD2345");
    await NewOwnerOnboardingStorageService.resumeCaregiverAuthentication("solo-household");
    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "join-confirmation",
      pendingCode: "ABCD2345",
      sourceHouseholdId: "solo-household",
    });

    await NewOwnerOnboardingStorageService.beginCaregiverJoin();
    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "joining",
      pendingCode: "ABCD2345",
    });

    await NewOwnerOnboardingStorageService.markCaregiverJoinRedeemed("shared-household");
    await NewOwnerOnboardingStorageService.markCaregiverRefreshFailure();
    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "join-failure",
      recovery: "refresh",
      reason: "refreshFailed",
      householdId: "shared-household",
    });

    await NewOwnerOnboardingStorageService.retryCaregiverJoin();
    await NewOwnerOnboardingStorageService.completeCaregiverJoin("shared-baby");
    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toEqual({
      version: 2,
      screen: "completed",
      language: "en",
      entryPath: "caregiver",
      babyId: "shared-baby",
      firstActivity: { status: "joined-household" },
    });
    expect(storage.get("@new_owner_onboarding_v2")).not.toContain("ABCD2345");
    expect(storage.has("@onboarding_status")).toBe(false);
  });

  it("persists reconciliation-only recovery when an interrupted join outcome is unknown", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.beginCaregiverPath("en");
    await NewOwnerOnboardingStorageService.beginCaregiverAuthentication("ABCD2345");
    await NewOwnerOnboardingStorageService.resumeCaregiverAuthentication("solo-household");
    await NewOwnerOnboardingStorageService.beginCaregiverJoin();
    await NewOwnerOnboardingStorageService.markCaregiverReconciliationFailure();

    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "join-failure",
      recovery: "reconcile",
      reason: "offline",
      householdId: "solo-household",
    });

    await NewOwnerOnboardingStorageService.retryCaregiverJoin();
    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "joining",
      sourceHouseholdId: "solo-household",
    });
  });

  it("recovers an interrupted join without redeeming the invitation again", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.beginCaregiverPath("en");
    await NewOwnerOnboardingStorageService.beginCaregiverAuthentication("ABCD2345");
    await NewOwnerOnboardingStorageService.resumeCaregiverAuthentication("solo-household");
    await NewOwnerOnboardingStorageService.beginCaregiverJoin();
    await NewOwnerOnboardingStorageService.recoverInterruptedCaregiverJoin("shared-household");

    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "join-refresh",
      householdId: "shared-household",
      pendingCode: "ABCD2345",
    });
  });

  it("resumes authenticated account creation without babies at baby setup", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.beginOwnerPath("en");
    await NewOwnerOnboardingStorageService.beginAuthentication("create-account");
    await NewOwnerOnboardingStorageService.resumeAuthenticatedAccount(null);

    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "owner-baby",
      accountMode: "authenticated",
      babyDraft: { name: "", birthDate: null, gender: null },
    });
  });

  it("persists returning authentication through restoring, unavailable, retry, and sign out", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.beginReturningAuthentication("en");
    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "returning-auth",
      entryPath: "returning",
      authIntent: "returning-user",
    });

    const firstAttempt = await NewOwnerOnboardingStorageService.beginReturningRestoration();
    expect(firstAttempt).toBe(1);
    await NewOwnerOnboardingStorageService.markReturningUnavailable(firstAttempt, "profile");
    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "returning-unavailable",
      attempt: 1,
      reason: "profile",
    });

    const retryAttempt = await NewOwnerOnboardingStorageService.retryReturningRestoration();
    expect(retryAttempt).toBe(2);
    await NewOwnerOnboardingStorageService.markReturningSignedOut();
    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "returning-signed-out",
      entryPath: "returning",
    });
  });

  it("returns cancelled returning authentication to Welcome", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.beginReturningAuthentication("fr");
    await NewOwnerOnboardingStorageService.cancelAuthentication();

    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "welcome",
      language: "fr",
      entryPath: null,
    });
  });

  it("does not offer creation transitions from unavailable returning data", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.beginReturningAuthentication("en");
    const attempt = await NewOwnerOnboardingStorageService.beginReturningRestoration();
    await NewOwnerOnboardingStorageService.markReturningUnavailable(attempt, "babies");
    await NewOwnerOnboardingStorageService.continueReturningWithBaby();
    await NewOwnerOnboardingStorageService.continueReturningWithFamilyJoin();

    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "returning-unavailable",
      reason: "babies",
    });
  });

  it("allows baby setup or family joining only from a verified-empty returning account", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.beginReturningAuthentication("en");
    const attempt = await NewOwnerOnboardingStorageService.beginReturningRestoration();
    await NewOwnerOnboardingStorageService.attachReturningHousehold(attempt, "household-1");
    await NewOwnerOnboardingStorageService.markReturningVerifiedEmpty(attempt, "household-1");

    await NewOwnerOnboardingStorageService.continueReturningWithBaby();
    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "owner-baby",
      accountMode: "authenticated",
    });

    await NewOwnerOnboardingStorageService.beginReturningAuthentication("en");
    const joinAttempt = await NewOwnerOnboardingStorageService.beginReturningRestoration();
    await NewOwnerOnboardingStorageService.attachReturningHousehold(joinAttempt, "household-1");
    await NewOwnerOnboardingStorageService.markReturningVerifiedEmpty(joinAttempt, "household-1");
    await NewOwnerOnboardingStorageService.continueReturningWithFamilyJoin();
    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "join-code",
      entryPath: "caregiver",
    });
  });

  it("revalidates a persisted restoration result with a new attempt", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.beginReturningAuthentication("en");
    const attempt = await NewOwnerOnboardingStorageService.beginReturningRestoration();
    await NewOwnerOnboardingStorageService.attachReturningHousehold(attempt, "household-1");
    await NewOwnerOnboardingStorageService.markReturningVerifiedEmpty(attempt, "household-1");

    await expect(NewOwnerOnboardingStorageService.revalidateReturningRestoration()).resolves.toBe(2);
    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "returning-restoring",
      attempt: 2,
      householdId: null,
    });
  });

  it("records the selected baby and ignores stale restoration completion", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.beginReturningAuthentication("en");
    const firstAttempt = await NewOwnerOnboardingStorageService.beginReturningRestoration();
    await NewOwnerOnboardingStorageService.markReturningUnavailable(firstAttempt, "babies");
    const currentAttempt = await NewOwnerOnboardingStorageService.retryReturningRestoration();
    await NewOwnerOnboardingStorageService.attachReturningHousehold(currentAttempt, "household-1");

    await NewOwnerOnboardingStorageService.markReturningRestored(
      firstAttempt,
      "household-1",
      "stale-baby"
    );
    await NewOwnerOnboardingStorageService.markReturningRestored(
      currentAttempt,
      "household-1",
      "baby-2"
    );

    await expect(NewOwnerOnboardingStorageService.getState("system")).resolves.toMatchObject({
      screen: "returning-restored",
      householdId: "household-1",
      babyId: "baby-2",
    });
    expect(storage.has("@onboarding_status")).toBe(false);
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
    await NewOwnerOnboardingStorageService.resumeAuthenticatedAccount(null);
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
    await NewOwnerOnboardingStorageService.resumeAuthenticatedAccount(null);
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
    expect(storage.has("@onboarding_status")).toBe(false);
  });

  it("starts over by clearing the versioned onboarding state", async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

    await NewOwnerOnboardingStorageService.startOver();

    expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("@new_owner_onboarding_v2");
  });

  it("clears legacy completion before versioned state for development replay", async () => {
    vi.mocked(AsyncStorage.removeItem).mockResolvedValue(undefined);

    await NewOwnerOnboardingStorageService.resetForDevelopment();

    expect(vi.mocked(AsyncStorage.removeItem).mock.calls).toEqual([
      ["@onboarding_status"],
      ["@new_owner_onboarding_v2"],
    ]);
  });

  it("clears an unfinished versioned draft without touching other storage", async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify({
      version: 2,
      screen: "owner-baby",
      language: "en",
      entryPath: "owner",
      accountMode: "guest",
      babyDraft: { name: "Mila", birthDate: null, gender: null },
    }));

    await NewOwnerOnboardingStorageService.clearUnfinishedDraft();

    expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("@new_owner_onboarding_v2");
  });

  it.each(["completed", "returning-restored"])(
    "preserves terminal %s onboarding state when clearing a draft",
    async screen => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify({
        version: 2,
        screen,
        language: "en",
        entryPath: screen === "completed" ? "owner" : "returning",
        babyId: "baby-1",
        firstActivity: { status: "skipped" },
        attempt: 1,
        householdId: "household-1",
      }));

      await NewOwnerOnboardingStorageService.clearUnfinishedDraft();

      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    }
  );

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

  it("round-trips authenticated completion with the restored baby ID", async () => {
    const storage = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key => storage.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
      storage.set(key, value);
    });

    await NewOwnerOnboardingStorageService.beginOwnerPath("en");
    await NewOwnerOnboardingStorageService.beginAuthentication("sign-in");
    await NewOwnerOnboardingStorageService.resumeAuthenticatedAccount("baby-1");

    await expect(NewOwnerOnboardingStorageService.getState("en")).resolves.toMatchObject({
      screen: "completed",
      entryPath: "authenticated-existing",
      babyId: "baby-1",
      firstActivity: { status: "existing-account" },
    });
  });

  it.each([
    { hasCompleted: true, completedAt: "2026-07-28T12:00:00.000Z", skipped: false },
    { hasCompleted: false, completedAt: null, skipped: true },
  ])("migrates legacy completed and skipped records: %j", async legacyStatus => {
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key =>
      key === "@onboarding_status" ? JSON.stringify(legacyStatus) : null
    );

    const expectedState = {
      version: 2 as const,
      screen: "completed" as const,
      language: "en" as const,
      entryPath: "legacy" as const,
      babyId: null,
      firstActivity: { status: "legacy-completed" as const },
    };

    await expect(NewOwnerOnboardingStorageService.getState("en")).resolves.toEqual(expectedState);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "@new_owner_onboarding_v2",
      JSON.stringify(expectedState)
    );
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(
      "@onboarding_status",
      expect.any(String)
    );
  });

  it("ignores malformed legacy completion records", async () => {
    vi.mocked(AsyncStorage.getItem).mockImplementation(async key =>
      key === "@onboarding_status" ? JSON.stringify({ hasCompleted: true }) : null
    );

    await expect(NewOwnerOnboardingStorageService.getState("en")).resolves.toMatchObject({
      screen: "welcome",
    });
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});
