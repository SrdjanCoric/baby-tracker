import { beforeEach, describe, expect, it, vi } from "vitest";

// Shared mutable mock state resettable per-test.
let platformOS = "ios";
const asyncStorageStore = new Map<string, string>();
const extensionStorageRemove = vi
  .fn<(key: string, groupId: string) => Promise<void>>()
  .mockResolvedValue(undefined);
const bridgeRemoveSession = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
const loadExtensionStorageMock = vi.fn(async () => ({ remove: extensionStorageRemove }));
let bridgeReturnValue: { removeSession: () => Promise<void> } | null = {
  removeSession: bridgeRemoveSession,
};

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (k: string) => asyncStorageStore.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      asyncStorageStore.set(k, v);
    }),
    removeItem: vi.fn(async (k: string) => {
      asyncStorageStore.delete(k);
    }),
  },
}));

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return platformOS;
    },
  },
}));

vi.mock("@/services/extension-storage", () => ({
  loadExtensionStorage: () => loadExtensionStorageMock(),
}));

vi.mock("@/services/shared-supabase-session-native", () => ({
  loadSharedSupabaseSessionBridge: () => bridgeReturnValue,
}));

const { purgeLegacyAppGroupAccessToken, purgeStaleSharedSessionOnFirstLaunch } = await import(
  "@/services/widget-data-service"
);

describe("purgeLegacyAppGroupAccessToken (TR-5)", () => {
  beforeEach(() => {
    extensionStorageRemove.mockClear();
    loadExtensionStorageMock.mockClear();
    platformOS = "ios";
  });

  it("removes the legacy App Group supabaseAccessToken bearer on iOS", async () => {
    await purgeLegacyAppGroupAccessToken();
    expect(loadExtensionStorageMock).toHaveBeenCalledTimes(1);
    expect(extensionStorageRemove).toHaveBeenCalledWith(
      "supabaseAccessToken",
      "group.com.sofibaby.app"
    );
  });

  it("skips the purge off iOS", async () => {
    platformOS = "android";
    await purgeLegacyAppGroupAccessToken();
    expect(loadExtensionStorageMock).not.toHaveBeenCalled();
    expect(extensionStorageRemove).not.toHaveBeenCalled();
  });
});

describe("purgeStaleSharedSessionOnFirstLaunch (TR-6)", () => {
  beforeEach(() => {
    asyncStorageStore.clear();
    bridgeRemoveSession.mockClear();
    platformOS = "ios";
    bridgeReturnValue = { removeSession: bridgeRemoveSession };
  });

  it("removes the shared Keychain capsule when no first-launch marker exists", async () => {
    await purgeStaleSharedSessionOnFirstLaunch();
    expect(bridgeRemoveSession).toHaveBeenCalledTimes(1);
    expect(asyncStorageStore.get("sharedSessionFirstLaunchPurgeDone")).toBe("1");
  });

  it("does not remove the Keychain capsule when the marker already exists", async () => {
    asyncStorageStore.set("sharedSessionFirstLaunchPurgeDone", "1");
    await purgeStaleSharedSessionOnFirstLaunch();
    expect(bridgeRemoveSession).not.toHaveBeenCalled();
  });

  it("still sets the marker when the bridge is unavailable on iOS (Expo Go / prebuild)", async () => {
    bridgeReturnValue = null;
    await purgeStaleSharedSessionOnFirstLaunch();
    expect(bridgeRemoveSession).not.toHaveBeenCalled();
    expect(asyncStorageStore.get("sharedSessionFirstLaunchPurgeDone")).toBe("1");
  });

  it("skips the purge off iOS", async () => {
    platformOS = "android";
    await purgeStaleSharedSessionOnFirstLaunch();
    expect(bridgeRemoveSession).not.toHaveBeenCalled();
    expect(asyncStorageStore.get("sharedSessionFirstLaunchPurgeDone")).toBeUndefined();
  });
});