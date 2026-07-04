import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setStorageUserId } from "../storage-prefix";
import { AsyncStorageClockStorage, HLC_STORAGE_KEY } from "./crdt-storage";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

const getItem = AsyncStorage.getItem as ReturnType<typeof vi.fn>;
const setItem = AsyncStorage.setItem as ReturnType<typeof vi.fn>;
const removeItem = AsyncStorage.removeItem as ReturnType<typeof vi.fn>;

describe("AsyncStorageClockStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    setStorageUserId(null);
  });

  it("uses a device-global key that does not change when the active user changes", async () => {
    // The HLC is a per-device logical clock; scoping its state per user would let it
    // regress to 0 across an account switch on the same device.
    const storage = new AsyncStorageClockStorage();

    setStorageUserId("user-a");
    await storage.save({ millis: 10, counter: 0 });
    setStorageUserId("user-b");
    await storage.save({ millis: 20, counter: 0 });

    expect(setItem.mock.calls[0][0]).toBe(HLC_STORAGE_KEY);
    expect(setItem.mock.calls[1][0]).toBe(HLC_STORAGE_KEY);
  });

  it("persists a versioned payload and reads it back", async () => {
    const storage = new AsyncStorageClockStorage();
    await storage.save({ millis: 1234, counter: 5 });

    expect(setItem).toHaveBeenCalledOnce();
    const [key, written] = setItem.mock.calls[0];
    expect(key).toBe(HLC_STORAGE_KEY);

    getItem.mockResolvedValueOnce(written);
    expect(await storage.load()).toEqual({ millis: 1234, counter: 5 });
  });

  it("returns null when nothing is stored", async () => {
    getItem.mockResolvedValueOnce(null);
    expect(await new AsyncStorageClockStorage().load()).toBeNull();
  });

  it("resets and returns null on corrupt data", async () => {
    getItem.mockResolvedValueOnce("not json{");
    const storage = new AsyncStorageClockStorage();

    expect(await storage.load()).toBeNull();
    expect(removeItem).toHaveBeenCalledWith(HLC_STORAGE_KEY);
  });

  it("ignores a payload written under a different version", async () => {
    getItem.mockResolvedValueOnce(JSON.stringify({ value: { millis: 1, counter: 1 }, version: 999 }));
    const storage = new AsyncStorageClockStorage();

    expect(await storage.load()).toBeNull();
    expect(removeItem).toHaveBeenCalledWith(HLC_STORAGE_KEY);
  });
});
