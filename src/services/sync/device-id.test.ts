import { describe, it, expect, beforeEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDeviceId, DEVICE_ID_STORAGE_KEY, __resetDeviceIdForTests } from "./device-id";

vi.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    default: {
      getItem: vi.fn(async (k: string) => store.get(k) ?? null),
      setItem: vi.fn(async (k: string, v: string) => {
        store.set(k, v);
      }),
      removeItem: vi.fn(async (k: string) => {
        store.delete(k);
      }),
      __store: store,
    },
  };
});

const store = (AsyncStorage as unknown as { __store: Map<string, string> }).__store;

describe("getDeviceId", () => {
  beforeEach(() => {
    store.clear();
    __resetDeviceIdForTests();
    vi.clearAllMocks();
  });

  it("generates and persists a device id on first call", async () => {
    const id = await getDeviceId(() => "generated-id");
    expect(id).toBe("generated-id");
    expect(store.get(DEVICE_ID_STORAGE_KEY)).toBe("generated-id");
  });

  it("returns the persisted id on subsequent calls without regenerating", async () => {
    const first = await getDeviceId(() => "first-id");
    const second = await getDeviceId(() => "SHOULD-NOT-BE-USED");
    expect(second).toBe(first);
  });

  it("reuses an id already in storage across a fresh module state", async () => {
    store.set(DEVICE_ID_STORAGE_KEY, "existing-device");
    const id = await getDeviceId(() => "SHOULD-NOT-BE-USED");
    expect(id).toBe("existing-device");
  });

  it("device id contains no path separators (safe inside HLC strings)", async () => {
    const id = await getDeviceId();
    expect(id.length).toBeGreaterThan(0);
    expect(id).not.toContain(":");
  });
});
