import { beforeEach, describe, expect, it, vi } from "vitest";

const updateApplicationContext = vi.fn();
const getApplicationContext = vi.fn();
const getIsWatchAppInstalled = vi.fn(async () => true);
const sharedSessionCapsule = JSON.stringify({
  version: 1,
  revision: 7,
  lineage: "session-lineage",
  session: JSON.stringify({
    access_token: "access-token",
    refresh_token: "refresh-token",
  }),
});
const readSharedSession = vi.fn(async () => sharedSessionCapsule);

vi.mock("react-native", () => ({
  NativeModules: {
    SharedSupabaseSession: {
      readSession: readSharedSession,
      writeSession: vi.fn(),
      removeSession: vi.fn(),
      acquireSessionLock: vi.fn(),
      releaseSessionLock: vi.fn(),
    },
  },
  Platform: { OS: "ios" },
}));
vi.mock("react-native-watch-connectivity", () => ({
  updateApplicationContext,
  getApplicationContext,
  sendMessage: vi.fn(),
  getReachability: vi.fn(async () => true),
  getIsWatchAppInstalled,
  watchEvents: { addListener: vi.fn(() => vi.fn()) },
}));

const widgetData = { babyId: "baby-1", babyName: "Sofi" } as never;
const authContext = {
  supabaseUrl: "https://example.supabase.co",
  supabaseAnonKey: "anon-key",
  accessToken: "access-token",
  userId: "user-1",
  householdId: "household-1",
};

async function loadWatchService() {
  vi.resetModules();
  return import("./watch-service");
}

describe("watch language transport", () => {
  beforeEach(() => {
    updateApplicationContext.mockClear();
    getApplicationContext.mockReset();
    getApplicationContext.mockResolvedValue(null);
    getIsWatchAppInstalled.mockResolvedValue(true);
    readSharedSession.mockReset();
    readSharedSession.mockResolvedValue(sharedSessionCapsule);
  });

  it("refreshes and republishes credentials when the Watch requests sync", async () => {
    const renewedSessionCapsule = JSON.stringify({
      version: 1,
      revision: 8,
      lineage: "session-lineage",
      session: JSON.stringify({
        access_token: "renewed-access-token",
        refresh_token: "renewed-refresh-token",
      }),
    });
    let currentCapsule = sharedSessionCapsule;
    readSharedSession.mockImplementation(async () => currentCapsule);
    getApplicationContext.mockResolvedValue({
      widgetData: JSON.stringify(widgetData),
      supabaseUrl: authContext.supabaseUrl,
      supabaseAnonKey: authContext.supabaseAnonKey,
      userId: authContext.userId,
      householdId: authContext.householdId,
      sessionCapsule: sharedSessionCapsule,
    });
    const refreshSession = vi.fn(async () => {
      currentCapsule = renewedSessionCapsule;
    });
    const { refreshWatchCredentialsFromPhone } = await loadWatchService();

    await refreshWatchCredentialsFromPhone(refreshSession);

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(updateApplicationContext).toHaveBeenCalledWith(
      expect.objectContaining({
        widgetData: JSON.stringify(widgetData),
        sessionCapsule: renewedSessionCapsule,
        userId: authContext.userId,
      })
    );
  });

  it("republishes a fresh shared session without rotating its refresh-token family", async () => {
    const freshSessionCapsule = JSON.stringify({
      version: 1,
      revision: 7,
      lineage: "session-lineage",
      session: JSON.stringify({
        access_token: "fresh-access-token",
        refresh_token: "fresh-refresh-token",
        expires_at: 4_000_000_000,
      }),
    });
    readSharedSession.mockResolvedValue(freshSessionCapsule);
    getApplicationContext.mockResolvedValue({
      widgetData: JSON.stringify(widgetData),
      supabaseUrl: authContext.supabaseUrl,
      supabaseAnonKey: authContext.supabaseAnonKey,
      userId: authContext.userId,
      householdId: authContext.householdId,
      sessionCapsule: freshSessionCapsule,
    });
    const refreshSession = vi.fn(async () => undefined);
    const { refreshWatchCredentialsFromPhone } = await loadWatchService();

    await refreshWatchCredentialsFromPhone(refreshSession);

    expect(refreshSession).not.toHaveBeenCalled();
    expect(updateApplicationContext).toHaveBeenCalledWith(
      expect.objectContaining({ sessionCapsule: freshSessionCapsule })
    );
  });

  it("holds the language until the watch session can receive it", async () => {
    // WCSession activates asynchronously during launch, and a context published
    // before it is ready is discarded with no error the JS side can observe.
    getIsWatchAppInstalled.mockResolvedValue(false);
    const { setWatchLanguage } = await loadWatchService();

    await setWatchLanguage("pt-PT");

    expect(updateApplicationContext).not.toHaveBeenCalled();
  });

  it("delivers the held language once the watch becomes available", async () => {
    getIsWatchAppInstalled.mockResolvedValue(false);
    const { setWatchLanguage, flushPendingWatchLanguage } = await loadWatchService();
    await setWatchLanguage("pt-PT");

    getIsWatchAppInstalled.mockResolvedValue(true);
    await flushPendingWatchLanguage();

    expect(updateApplicationContext).toHaveBeenCalledTimes(1);
    expect(updateApplicationContext.mock.calls[0][0]).toEqual({ language: "pt-PT" });
  });

  it("does nothing on flush when no language was held back", async () => {
    const { setWatchLanguage, flushPendingWatchLanguage } = await loadWatchService();
    await setWatchLanguage("de");
    updateApplicationContext.mockClear();

    await flushPendingWatchLanguage();

    expect(updateApplicationContext).not.toHaveBeenCalled();
  });

  it("carries the resolved language in the application context", async () => {
    const { setWatchLanguage, syncToWatch } = await loadWatchService();

    await setWatchLanguage("pt-PT");
    await syncToWatch(widgetData, undefined, authContext);

    // The sync carries the language alongside the data and renewable session.
    expect(updateApplicationContext.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        language: "pt-PT",
        sessionCapsule: sharedSessionCapsule,
      })
    );
    expect(updateApplicationContext.mock.calls.at(-1)?.[0].accessToken).toBeUndefined();
  });

  it("republishes the previous context when the language changes instead of erasing it", async () => {
    const { setWatchLanguage, syncToWatch } = await loadWatchService();

    await setWatchLanguage("pt-PT");
    await syncToWatch(widgetData, undefined, authContext);
    updateApplicationContext.mockClear();

    await setWatchLanguage("de");

    expect(updateApplicationContext).toHaveBeenCalledTimes(1);
    const republished = updateApplicationContext.mock.calls[0][0];
    expect(republished).toEqual(
      expect.objectContaining({
        language: "de",
        sessionCapsule: sharedSessionCapsule,
        supabaseUrl: "https://example.supabase.co",
        userId: "user-1",
      })
    );
    expect(republished.widgetData).toBe(JSON.stringify(widgetData));
  });

  it("still delivers the language before any data has been synced", async () => {
    const { setWatchLanguage } = await loadWatchService();

    await setWatchLanguage("fr");

    expect(updateApplicationContext).toHaveBeenCalledTimes(1);
    const published = updateApplicationContext.mock.calls[0][0];
    expect(published).toEqual({ language: "fr" });
  });

  it("stops republishing a signed-out session's credentials to the watch", async () => {
    const { clearWatchContext, setWatchLanguage, syncToWatch } = await loadWatchService();

    await syncToWatch(widgetData, undefined, authContext);
    await clearWatchContext();
    updateApplicationContext.mockClear();

    await setWatchLanguage("de");

    const published = updateApplicationContext.mock.calls[0][0];
    expect(published).toEqual({ language: "de" });
    expect(published.accessToken).toBeUndefined();
    expect(published.sessionCapsule).toBeUndefined();
    expect(published.supabaseAnonKey).toBeUndefined();
    expect(published.userId).toBeUndefined();
    expect(published.widgetData).toBeUndefined();
  });

  it("publishes a sign-out marker so Watch invalidates the visible account scope", async () => {
    const { clearWatchContext, syncToWatch } = await loadWatchService();
    await syncToWatch(widgetData, undefined, authContext);
    updateApplicationContext.mockClear();

    await clearWatchContext();

    expect(updateApplicationContext).toHaveBeenCalledWith({ signedOut: true });
  });

  it("publishes sign-out before any prior Watch sync loaded connectivity", async () => {
    const { clearWatchContext } = await loadWatchService();

    await clearWatchContext();

    expect(updateApplicationContext).toHaveBeenCalledWith({ signedOut: true });
  });

  it("carries the household generation with Watch credentials", async () => {
    const { syncToWatch } = await loadWatchService();

    await syncToWatch(widgetData, undefined, authContext);

    expect(updateApplicationContext.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ householdId: "household-1", userId: "user-1" })
    );
  });

  it("publishes the exact versioned shared-session capsule instead of a static bearer", async () => {
    const { syncToWatch } = await loadWatchService();

    await syncToWatch(widgetData, undefined, authContext);

    expect(readSharedSession).toHaveBeenCalledTimes(1);
    const published = updateApplicationContext.mock.calls.at(-1)?.[0];
    expect(published.sessionCapsule).toBe(sharedSessionCapsule);
    expect(published.accessToken).toBeUndefined();
  });

  it("keeps the latest language on subsequent syncs without repeating the language call", async () => {
    const { setWatchLanguage, syncToWatch } = await loadWatchService();

    await setWatchLanguage("it");
    await syncToWatch(widgetData, undefined, authContext);
    updateApplicationContext.mockClear();

    await syncToWatch(widgetData, undefined, authContext);

    expect(updateApplicationContext).toHaveBeenCalledTimes(1);
    expect(updateApplicationContext.mock.calls[0][0]).toEqual(
      expect.objectContaining({ language: "it" })
    );
  });
});
