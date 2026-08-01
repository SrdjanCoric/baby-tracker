import { beforeEach, describe, expect, it, vi } from "vitest";

const updateApplicationContext = vi.fn();

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("react-native-watch-connectivity", () => ({
  updateApplicationContext,
  sendMessage: vi.fn(),
  getReachability: vi.fn(async () => true),
  watchEvents: { addListener: vi.fn(() => vi.fn()) },
}));

const widgetData = { babyId: "baby-1", babyName: "Sofi" } as never;
const authContext = {
  supabaseUrl: "https://example.supabase.co",
  supabaseAnonKey: "anon-key",
  accessToken: "access-token",
  userId: "user-1",
};

async function loadWatchService() {
  vi.resetModules();
  return import("./watch-service");
}

describe("watch language transport", () => {
  beforeEach(() => {
    updateApplicationContext.mockClear();
  });

  it("carries the resolved language in the application context", async () => {
    const { setWatchLanguage, syncToWatch } = await loadWatchService();

    await setWatchLanguage("pt-PT");
    await syncToWatch(widgetData, undefined, authContext);

    // The sync carries the language alongside the data and credentials.
    expect(updateApplicationContext.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ language: "pt-PT", accessToken: "access-token" })
    );
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
        accessToken: "access-token",
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
    clearWatchContext();
    updateApplicationContext.mockClear();

    await setWatchLanguage("de");

    const published = updateApplicationContext.mock.calls[0][0];
    expect(published).toEqual({ language: "de" });
    expect(published.accessToken).toBeUndefined();
    expect(published.supabaseAnonKey).toBeUndefined();
    expect(published.userId).toBeUndefined();
    expect(published.widgetData).toBeUndefined();
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
