import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  NativeModules: {},
  Platform: { OS: "ios" },
}));

import { createSharedSupabaseSessionLock } from "./shared-supabase-session-native";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("createSharedSupabaseSessionLock", () => {
  it("queues app callers before entering the serial native module queue", async () => {
    const events: string[] = [];
    let nextHandle = 0;
    const nativeModule = {
      acquireSessionLock: vi.fn(async () => {
        const handle = `handle-${++nextHandle}`;
        events.push(`acquire:${handle}`);
        return handle;
      }),
      releaseSessionLock: vi.fn(async (handle: string) => {
        events.push(`release:${handle}`);
      }),
    };
    const firstBody = deferred<void>();
    const lock = createSharedSupabaseSessionLock(nativeModule);

    const first = lock.withLock(async () => {
      events.push("body:first");
      await firstBody.promise;
    });
    await vi.waitFor(() => expect(nativeModule.acquireSessionLock).toHaveBeenCalledTimes(1));

    const second = lock.withLock(async () => {
      events.push("body:second");
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(nativeModule.acquireSessionLock).toHaveBeenCalledTimes(1);
    firstBody.resolve();
    await Promise.all([first, second]);

    expect(events).toEqual([
      "acquire:handle-1",
      "body:first",
      "release:handle-1",
      "acquire:handle-2",
      "body:second",
      "release:handle-2",
    ]);
  });

  it("advances the queue when a lock body rejects", async () => {
    let nextHandle = 0;
    const nativeModule = {
      acquireSessionLock: vi.fn(async () => `handle-${++nextHandle}`),
      releaseSessionLock: vi.fn(async () => undefined),
    };
    const lock = createSharedSupabaseSessionLock(nativeModule);

    await expect(
      lock.withLock(async () => {
        throw new Error("body failed");
      })
    ).rejects.toThrow("body failed");
    await expect(lock.withLock(async () => "next")).resolves.toBe("next");
    expect(nativeModule.releaseSessionLock).toHaveBeenCalledTimes(2);
  });
});
