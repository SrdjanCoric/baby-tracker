import { describe, expect, it, vi } from "vitest";
import { createLiveActivityTokenSynchronizer } from "./live-activity-push-token-sync";

describe("Live Activity token sync", () => {
  it("acknowledges foreign tombstones without using the new account to delete them", async () => {
    const acknowledge = vi.fn();
    const remove = vi.fn();
    const synchronizer = createLiveActivityTokenSynchronizer("new-owner", {
      read: async () => [{ activityId: "old", babyId: "baby", timerInstanceId: "run", userId: "old-owner", ended: true }],
      register: vi.fn(), remove, acknowledge, end: vi.fn(),
    });
    await synchronizer.sync();
    expect(acknowledge).toHaveBeenCalledWith("old");
    expect(remove).not.toHaveBeenCalled();
  });

  it("drains a request arriving after the loop exits but before its promise settles", async () => {
    const record = { activityId: "a", babyId: "baby", timerInstanceId: "run",
      userId: "owner", token: "rotated", ended: false };
    const register = vi.fn().mockResolvedValue(true);
    let reads = 0;
    let late: Promise<void> | undefined;
    const synchronizer = createLiveActivityTokenSynchronizer("owner", {
      read: async () => {
        if (++reads === 1) {
          queueMicrotask(() => queueMicrotask(() => { late = synchronizer.sync(); }));
          return [];
        }
        return [record];
      },
      register, remove: vi.fn(), acknowledge: vi.fn(), end: vi.fn(),
    });
    await synchronizer.sync();
    await late;
    expect(register).toHaveBeenCalledWith(record);
  });

  it("rotates tokens without duplicate uploads and never uploads another account's token", async () => {
    let token = "initial";
    const register = vi.fn().mockResolvedValue(true);
    const record = {
      activityId: "a",
      babyId: "baby",
      timerInstanceId: "run",
      userId: "owner",
      ended: false,
    };
    const sync = createLiveActivityTokenSynchronizer("owner", {
      read: async () => [
        { ...record, token },
        { ...record, activityId: "foreign", userId: "other", token: "secret" },
      ],
      register,
      remove: vi.fn(),
      acknowledge: vi.fn(),
      end: vi.fn(),
    });
    await sync.sync();
    await sync.sync();
    expect(register).toHaveBeenCalledTimes(1);
    token = "rotated";
    await sync.sync();
    expect(register).toHaveBeenCalledTimes(2);
    expect(register).toHaveBeenLastCalledWith({ ...record, token: "rotated" });
    sync.dispose();
    token = "after-signout";
    await sync.sync();
    expect(register).toHaveBeenCalledTimes(2);
  });

  it("ends locally when the server already stopped the timer before token registration", async () => {
    let ended = false;
    let acknowledged = false;
    const remove = vi.fn();
    const end = vi.fn(async () => {
      ended = true;
    });
    const sync = createLiveActivityTokenSynchronizer("owner", {
      read: async () =>
        acknowledged
          ? []
          : [
              {
                activityId: "a",
                babyId: "baby",
                timerInstanceId: "run",
                userId: "owner",
                token: "late",
                ended,
              },
            ],
      register: async () => false,
      remove,
      end,
      acknowledge: async () => {
        acknowledged = true;
      },
    });
    await sync.sync();
    expect(end).toHaveBeenCalledWith("a");
    expect(remove).toHaveBeenCalledOnce();
    expect(acknowledged).toBe(true);
  });
  it("serializes a stop arriving during registration and retries failed cleanup", async () => {
    let finishRegistration!: () => void;
    const registering = new Promise<void>((resolve) => {
      finishRegistration = resolve;
    });
    let ended = false;
    const record = {
      activityId: "native-id",
      babyId: "baby",
      timerInstanceId: "timer-run",
      userId: "owner",
      token: "token",
      ended: false,
    };
    const register = vi.fn().mockImplementation(async () => {
      await registering;
      return true;
    });
    const remove = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);
    const acknowledge = vi.fn();
    const synchronizer = createLiveActivityTokenSynchronizer("owner", {
      read: async () => [{ ...record, ended }],
      register,
      remove,
      acknowledge,
      end: vi.fn(),
    });
    const first = synchronizer.sync();
    await vi.waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    ended = true;
    const second = synchronizer.sync();
    finishRegistration();
    await expect(first).rejects.toThrow("offline");
    await expect(second).rejects.toThrow("offline");
    expect(acknowledge).not.toHaveBeenCalled();
    await synchronizer.sync();
    expect(remove).toHaveBeenCalledTimes(2);
    expect(acknowledge).toHaveBeenCalledWith("native-id");
    expect(register).toHaveBeenCalledWith(record);
  });
});
