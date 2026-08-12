import { describe, expect, it, vi } from "vitest";
import { createForegroundRefreshCoordinator } from "./foreground-refresh-coordinator";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("foreground refresh coordinator", () => {
  it("coalesces a wake and reconnect into one successful online pass", async () => {
    const coordinator = createForegroundRefreshCoordinator();
    const gate = deferred();
    const loader = vi.fn(() => gate.promise);
    coordinator.register("feedings", loader);
    coordinator.startWakeCycle();

    const wake = coordinator.trigger(true);
    const reconnect = coordinator.trigger(true);
    await Promise.resolve();
    expect(loader).toHaveBeenCalledTimes(1);

    gate.resolve();
    await Promise.all([wake, reconnect]);
    await coordinator.trigger(true);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("runs one online catch-up after an offline wake pass", async () => {
    const coordinator = createForegroundRefreshCoordinator();
    const loader = vi.fn().mockResolvedValue(undefined);
    coordinator.register("feedings", loader);
    coordinator.startWakeCycle();

    await coordinator.trigger(false);
    await Promise.all([coordinator.trigger(true), coordinator.trigger(true)]);

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("runs a new catch-up after a later offline period", async () => {
    const coordinator = createForegroundRefreshCoordinator();
    const loader = vi.fn().mockResolvedValue(undefined);
    coordinator.register("feedings", loader);

    await coordinator.trigger(true);
    coordinator.noteOffline();
    await coordinator.trigger(true);

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("waits for every loader and retries after any loader rejects", async () => {
    const coordinator = createForegroundRefreshCoordinator();
    const slow = deferred();
    const first = vi.fn(() => slow.promise);
    const failing = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    coordinator.register("slow", first);
    coordinator.register("failing", failing);
    coordinator.startWakeCycle();

    let settled = false;
    const pass = coordinator.trigger(true).then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    slow.resolve();
    await pass;

    await coordinator.trigger(true);
    expect(first).toHaveBeenCalledTimes(2);
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it("deduplicates online joiners when their catch-up pass fails", async () => {
    const coordinator = createForegroundRefreshCoordinator();
    const offlinePass = deferred();
    const loader = vi.fn()
      .mockImplementationOnce(() => offlinePass.promise)
      .mockRejectedValue(new Error("still offline"));
    coordinator.register("feedings", loader);
    coordinator.startWakeCycle();

    const wake = coordinator.trigger(false);
    const firstReconnect = coordinator.trigger(true);
    const secondReconnect = coordinator.trigger(true);
    offlinePass.resolve();

    await Promise.all([wake, firstReconnect, secondReconnect]);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("unregisters loaders without disturbing other providers", async () => {
    const coordinator = createForegroundRefreshCoordinator();
    const removed = vi.fn().mockResolvedValue(undefined);
    const retained = vi.fn().mockResolvedValue(undefined);
    const unregister = coordinator.register("feedings", removed);
    coordinator.register("sleep", retained);
    unregister();
    coordinator.startWakeCycle();

    await coordinator.trigger(true);

    expect(removed).not.toHaveBeenCalled();
    expect(retained).toHaveBeenCalledTimes(1);
  });
});
