import { beforeEach, describe, expect, it, vi } from "vitest";

const updateApplicationContext = vi.fn();
const appGroupStorage = new Map<string, string>();
const reloadWidget = vi.fn(async () => undefined);
const setExtensionValue = vi.fn(async (key: string, value: string) => {
  appGroupStorage.set(key, value);
});

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("react-native-watch-connectivity", () => ({
  updateApplicationContext,
  sendMessage: vi.fn(),
  getReachability: vi.fn(async () => true),
  getIsWatchAppInstalled: vi.fn(async () => true),
  watchEvents: { addListener: vi.fn(() => vi.fn()) },
}));
vi.mock("@/services/extension-storage", () => ({
  loadExtensionStorage: vi.fn(async () => ({
    get: async (key: string) => appGroupStorage.get(key) ?? null,
    set: setExtensionValue,
    reloadWidget,
  })),
}));

const widgetData = { babyId: "baby-1", babyName: "Sofi" } as never;
const authContext = {
  supabaseUrl: "https://example.supabase.co",
  supabaseAnonKey: "anon-key",
  accessToken: "access-token",
  userId: "user-1",
};

async function loadModules() {
  vi.resetModules();
  const nativeLanguage = await import("./native-language-service");
  const watch = await import("./watch-service");
  return { ...nativeLanguage, ...watch };
}

describe("native language publishing", () => {
  beforeEach(() => {
    appGroupStorage.clear();
    updateApplicationContext.mockClear();
    reloadWidget.mockClear();
    setExtensionValue.mockClear();
  });

  it("writes the resolved language into the shared App Group and reloads the widget", async () => {
    const { publishNativeLanguage, NATIVE_LANGUAGE_KEY } = await loadModules();

    await publishNativeLanguage("pt-PT");

    expect(setExtensionValue).toHaveBeenCalledWith(
      NATIVE_LANGUAGE_KEY,
      "pt-PT",
      "group.com.sofibaby.app"
    );
    expect(appGroupStorage.get(NATIVE_LANGUAGE_KEY)).toBe("pt-PT");
    expect(reloadWidget).toHaveBeenCalled();
  });

  it("reaches an already-synced Watch without discarding its credentials", async () => {
    const { publishNativeLanguage, syncToWatch } = await loadModules();

    await syncToWatch(widgetData, undefined, authContext);
    updateApplicationContext.mockClear();

    await publishNativeLanguage("de");

    expect(updateApplicationContext).toHaveBeenCalledTimes(1);
    expect(updateApplicationContext.mock.calls[0][0]).toEqual(
      expect.objectContaining({ language: "de", accessToken: "access-token" })
    );
  });

  it("still reaches the Watch when the App Group write fails", async () => {
    const { publishNativeLanguage, syncToWatch } = await loadModules();

    await syncToWatch(widgetData, undefined, authContext);
    updateApplicationContext.mockClear();
    setExtensionValue.mockRejectedValueOnce(new Error("app group unavailable"));

    await publishNativeLanguage("de");

    // A widget-side failure must not strand the Watch in the old language.
    expect(updateApplicationContext.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ language: "de" })
    );
  });

  it("applies a later language change to both surfaces", async () => {
    const { publishNativeLanguage, syncToWatch, NATIVE_LANGUAGE_KEY } = await loadModules();

    await syncToWatch(widgetData, undefined, authContext);
    await publishNativeLanguage("pt-PT");
    updateApplicationContext.mockClear();

    await publishNativeLanguage("it");

    expect(appGroupStorage.get(NATIVE_LANGUAGE_KEY)).toBe("it");
    expect(updateApplicationContext.mock.calls[0][0]).toEqual(
      expect.objectContaining({ language: "it" })
    );
  });
});
