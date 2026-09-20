import { describe, expect, it, vi } from "vitest";

const mockAppState = vi.hoisted(() => ({ currentState: "background" }));
const mockObservability = vi.hoisted(() => ({
  recordBreadcrumb: vi.fn(),
  reportIssue: vi.fn(),
}));

vi.mock("react-native", () => ({
  NativeModules: {},
  Platform: { OS: "ios" },
  AppState: mockAppState,
}));
vi.mock("@/utils/observability-sink", () => mockObservability);

import {
  consumeSharedSupabaseSessionLockAbandonment,
  createSharedSupabaseSessionLock,
  createSharedSupabaseSessionNativeAdapter,
} from "./shared-supabase-session-native";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("shared-session abandonment classification", () => {
  it("does not consume an untrusted error with a native lock code", () => {
    mockAppState.currentState = "background";
    mockObservability.recordBreadcrumb.mockClear();
    mockObservability.reportIssue.mockClear();

    const serverError = Object.assign(new Error("auth failed"), {
      code: "LOCK_REVOKED",
    });

    expect(consumeSharedSupabaseSessionLockAbandonment(serverError)).toBe(false);
    expect(mockObservability.recordBreadcrumb).not.toHaveBeenCalled();
    expect(mockObservability.reportIssue).not.toHaveBeenCalled();
  });
});

describe("createSharedSupabaseSessionLock", () => {
  it.each(["LOCK_NO_ASSERTION", "LOCK_REVOKED", "LOCK_OPEN"])(
    "consumes %s without invoking the body while in the background",
    async (code) => {
      mockAppState.currentState = "background";
      mockObservability.recordBreadcrumb.mockClear();
      mockObservability.reportIssue.mockClear();
      const nativeModule = {
        acquireSessionLock: vi.fn(async () => {
          throw Object.assign(new Error(code), { code });
        }),
        releaseSessionLock: vi.fn(async () => undefined),
      };
      const body = vi.fn(async () => "body result");
      const lock = createSharedSupabaseSessionLock(nativeModule);

      await expect(lock.withLock(body)).resolves.toBeUndefined();

      expect(body).not.toHaveBeenCalled();
      expect(mockObservability.recordBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "shared_session",
          data: { code },
        })
      );
      expect(mockObservability.reportIssue).not.toHaveBeenCalled();
    }
  );

  it("reports one foreground warning for repeated abandonments and never an error", async () => {
    mockAppState.currentState = "active";
    mockObservability.recordBreadcrumb.mockClear();
    mockObservability.reportIssue.mockClear();
    const nativeModule = {
      acquireSessionLock: vi.fn(async () => {
        throw Object.assign(new Error("abandoned"), {
          code: "LOCK_REVOKED",
        });
      }),
      releaseSessionLock: vi.fn(async () => undefined),
    };
    const lock = createSharedSupabaseSessionLock(nativeModule);

    await expect(lock.withLock(async () => "first")).resolves.toBeUndefined();
    await expect(lock.withLock(async () => "second")).resolves.toBeUndefined();

    expect(mockObservability.recordBreadcrumb).not.toHaveBeenCalled();
    expect(mockObservability.reportIssue).toHaveBeenCalledTimes(1);
    expect(mockObservability.reportIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "shared_session.lock_abandoned",
        level: "warning",
        tags: { code: "LOCK_REVOKED" },
      })
    );
  });

  it.each(["LOCK_TIMEOUT", "LOCK_UNKNOWN"])(
    "keeps %s as a rejection",
    async (code) => {
      mockAppState.currentState = "background";
      const nativeModule = {
        acquireSessionLock: vi.fn(async () => {
          throw Object.assign(new Error(code), { code });
        }),
        releaseSessionLock: vi.fn(async () => undefined),
      };
      const lock = createSharedSupabaseSessionLock(nativeModule);

      await expect(lock.withLock(async () => "body result")).rejects.toThrow(code);
    }
  );

  it("persists a redeemed envelope under a fresh handle after revocation", async () => {
    let nextHandle = 0;
    const writes: {
      envelope: string;
      revision: number | null;
      handle: string;
    }[] = [];
    const nativeModule = {
      readSession: vi.fn(async () => null),
      writeSession: vi.fn(
        async (envelope: string, revision: number | null, handle: string) => {
          writes.push({ envelope, revision, handle });
          if (handle === "handle-1") {
            throw Object.assign(new Error("expired"), { code: "LOCK_REVOKED" });
          }
        }
      ),
      removeSession: vi.fn(async () => undefined),
      purgeSession: vi.fn(async () => undefined),
      acquireSessionLock: vi.fn(async () => `handle-${++nextHandle}`),
      releaseSessionLock: vi.fn(async () => undefined),
    };
    const adapter = createSharedSupabaseSessionNativeAdapter(nativeModule);

    await adapter.lock.withLock(async () => {
      await adapter.writeSession("redeemed-envelope", 7);
    });

    expect(writes).toEqual([
      { envelope: "redeemed-envelope", revision: 7, handle: "handle-1" },
      { envelope: "redeemed-envelope", revision: 7, handle: "handle-2" },
    ]);
    expect(nativeModule.releaseSessionLock).toHaveBeenCalledTimes(2);
  });

  it("retains a redeemed envelope when its first recovery assertion is denied", async () => {
    const events: string[] = [];
    let acquireAttempt = 0;
    const nativeModule = {
      readSession: vi.fn(async () => null),
      writeSession: vi.fn(
        async (envelope: string, revision: number | null, handle: string) => {
          events.push(`write:${envelope}:${revision}:${handle}`);
          if (handle === "handle-1") {
            throw Object.assign(new Error("expired"), { code: "LOCK_REVOKED" });
          }
        }
      ),
      removeSession: vi.fn(async () => undefined),
      purgeSession: vi.fn(async () => undefined),
      acquireSessionLock: vi.fn(async () => {
        acquireAttempt += 1;
        if (acquireAttempt === 2) {
          throw Object.assign(new Error("suspending"), {
            code: "LOCK_NO_ASSERTION",
          });
        }
        return `handle-${acquireAttempt}`;
      }),
      releaseSessionLock: vi.fn(async (handle: string) => {
        events.push(`release:${handle}`);
      }),
    };
    const adapter = createSharedSupabaseSessionNativeAdapter(nativeModule);

    await expect(
      adapter.lock.withLock(async () => {
        await adapter.writeSession("redeemed-envelope", 7);
        return "refreshed-session";
      })
    ).resolves.toBe("refreshed-session");

    await adapter.lock.withLock(async () => {
      events.push("body:next");
    });

    expect(events).toEqual([
      "write:redeemed-envelope:7:handle-1",
      "release:handle-1",
      "write:redeemed-envelope:7:handle-3",
      "body:next",
      "release:handle-3",
    ]);
  });

  it("preserves all revoked mutations until a recovery assertion is available", async () => {
    const events: string[] = [];
    let acquireAttempt = 0;
    const revoked = () =>
      Object.assign(new Error("expired"), { code: "LOCK_REVOKED" });
    const nativeModule = {
      readSession: vi.fn(async () => null),
      writeSession: vi.fn(
        async (_envelope: string, _revision: number | null, handle: string) => {
          events.push(`write:${handle}`);
          if (handle === "handle-1") throw revoked();
        }
      ),
      removeSession: vi.fn(
        async (_revision: number, _lineage: string, handle: string) => {
          events.push(`remove:${handle}`);
          if (handle === "handle-1") throw revoked();
        }
      ),
      purgeSession: vi.fn(async () => undefined),
      acquireSessionLock: vi.fn(async () => {
        acquireAttempt += 1;
        if (acquireAttempt === 2) {
          throw Object.assign(new Error("suspending"), {
            code: "LOCK_NO_ASSERTION",
          });
        }
        return `handle-${acquireAttempt}`;
      }),
      releaseSessionLock: vi.fn(async () => undefined),
    };
    const adapter = createSharedSupabaseSessionNativeAdapter(nativeModule);

    await adapter.lock.withLock(async () => {
      await adapter.writeSession("redeemed-envelope", 7);
      await adapter.removeSession(8, "lineage-a");
    });
    await adapter.lock.withLock(async () => {
      events.push("body:next");
    });

    expect(events).toEqual([
      "write:handle-1",
      "remove:handle-1",
      "write:handle-3",
      "remove:handle-3",
      "body:next",
    ]);
  });

  it("preserves a newer capsule when a revoked removal is retried", async () => {
    let nextHandle = 0;
    const removals: { revision: number; lineage: string; handle: string }[] =
      [];
    const nativeModule = {
      readSession: vi.fn(async () => null),
      writeSession: vi.fn(async () => undefined),
      removeSession: vi.fn(
        async (revision: number, lineage: string, handle: string) => {
          removals.push({ revision, lineage, handle });
          if (handle === "handle-1") {
            throw Object.assign(new Error("expired"), { code: "LOCK_REVOKED" });
          }
          throw Object.assign(new Error("widget won"), {
            code: "SESSION_CHANGED",
          });
        }
      ),
      purgeSession: vi.fn(async () => undefined),
      acquireSessionLock: vi.fn(async () => `handle-${++nextHandle}`),
      releaseSessionLock: vi.fn(async () => undefined),
    };
    const adapter = createSharedSupabaseSessionNativeAdapter(nativeModule);

    await adapter.lock.withLock(async () => {
      await adapter.removeSession(5, "lineage-a");
    });

    expect(removals).toEqual([
      { revision: 5, lineage: "lineage-a", handle: "handle-1" },
      { revision: 5, lineage: "lineage-a", handle: "handle-2" },
    ]);
    expect(nativeModule.purgeSession).not.toHaveBeenCalled();
  });

  it("passes the issued native handle to its lock body", async () => {
    const nativeModule = {
      acquireSessionLock: vi.fn(async () => "handle-owned-by-body"),
      releaseSessionLock: vi.fn(async () => undefined),
    };
    const lock = createSharedSupabaseSessionLock(nativeModule);

    await expect(
      lock.withLock(async (handle?: string) => handle)
    ).resolves.toBe("handle-owned-by-body");
  });

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
    await vi.waitFor(() =>
      expect(nativeModule.acquireSessionLock).toHaveBeenCalledTimes(1)
    );

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

  it("preserves a lock body error when after-release recovery also rejects", async () => {
    const bodyError = new Error("body failed");
    const nativeModule = {
      acquireSessionLock: vi.fn(async () => "handle-1"),
      releaseSessionLock: vi.fn(async () => undefined),
    };
    const lock = createSharedSupabaseSessionLock(
      nativeModule,
      undefined,
      async () => {
        throw new Error("recovery failed");
      }
    );

    await expect(
      lock.withLock(async () => {
        throw bodyError;
      })
    ).rejects.toBe(bodyError);
  });

  it("preserves a lock body result when best-effort recovery rejects", async () => {
    const nativeModule = {
      acquireSessionLock: vi.fn(async () => "handle-1"),
      releaseSessionLock: vi.fn(async () => undefined),
    };
    const lock = createSharedSupabaseSessionLock(
      nativeModule,
      undefined,
      async () => {
        throw new Error("recovery failed");
      }
    );

    await expect(lock.withLock(async () => "body result")).resolves.toBe(
      "body result"
    );
  });
});

describe("unlocked session mutations", () => {
  function makeModule() {
    let nextHandle = 0;
    const writes: { envelope: string; revision: number | null; handle: string }[] = [];
    const removals: { revision: number; lineage: string; handle: string }[] = [];
    const issued = new Set<string>();
    const module = {
      readSession: vi.fn(async () => null),
      writeSession: vi.fn(
        async (envelope: string, revision: number | null, handle: string) => {
          if (!issued.has(handle)) {
            throw Object.assign(new Error(`Unknown lock handle: ${handle}`), {
              code: "LOCK_HANDLE",
            });
          }
          writes.push({ envelope, revision, handle });
        }
      ),
      removeSession: vi.fn(
        async (revision: number, lineage: string, handle: string) => {
          if (!issued.has(handle)) {
            throw Object.assign(new Error(`Unknown lock handle: ${handle}`), {
              code: "LOCK_HANDLE",
            });
          }
          removals.push({ revision, lineage, handle });
        }
      ),
      purgeSession: vi.fn(async () => undefined),
      acquireSessionLock: vi.fn(async () => {
        const handle = `handle-${++nextHandle}`;
        issued.add(handle);
        return handle;
      }),
      releaseSessionLock: vi.fn(async (handle: string) => {
        issued.delete(handle);
      }),
    };
    return { module, writes, removals };
  }

  it("acquires the flock for a sign-in session write issued outside the auth lock", async () => {
    const { module, writes } = makeModule();
    const adapter = createSharedSupabaseSessionNativeAdapter(module);

    await adapter.writeSession("fresh-sign-in-envelope", null);

    expect(writes).toEqual([
      { envelope: "fresh-sign-in-envelope", revision: null, handle: "handle-1" },
    ]);
    expect(module.acquireSessionLock).toHaveBeenCalledTimes(1);
    expect(module.releaseSessionLock).toHaveBeenCalledWith("handle-1");
  });

  it("queues an unlocked session write when lock acquisition is abandoned", async () => {
    const writes: { envelope: string; revision: number | null; handle: string }[] = [];
    let acquireCount = 0;
    const nativeModule = {
      readSession: vi.fn(async () => null),
      writeSession: vi.fn(
        async (envelope: string, revision: number | null, handle: string) => {
          writes.push({ envelope, revision, handle });
        }
      ),
      removeSession: vi.fn(async () => undefined),
      purgeSession: vi.fn(async () => undefined),
      acquireSessionLock: vi.fn(async () => {
        acquireCount += 1;
        if (acquireCount === 1) {
          throw Object.assign(new Error("suspending"), {
            code: "LOCK_REVOKED",
          });
        }
        return `handle-${acquireCount}`;
      }),
      releaseSessionLock: vi.fn(async () => undefined),
    };
    const adapter = createSharedSupabaseSessionNativeAdapter(nativeModule);

    await adapter.writeSession("queued-envelope", 9);
    expect(writes).toEqual([]);

    await adapter.lock.withLock(async () => undefined);

    expect(writes).toEqual([
      { envelope: "queued-envelope", revision: 9, handle: "handle-2" },
    ]);
  });

  it("acquires the flock for a session removal issued outside the auth lock", async () => {
    const { module, removals } = makeModule();
    const adapter = createSharedSupabaseSessionNativeAdapter(module);

    await adapter.removeSession(3, "lineage-a");

    expect(removals).toEqual([
      { revision: 3, lineage: "lineage-a", handle: "handle-1" },
    ]);
    expect(module.acquireSessionLock).toHaveBeenCalledTimes(1);
    expect(module.releaseSessionLock).toHaveBeenCalledWith("handle-1");
  });

  it("still reuses the held handle for writes inside the auth lock", async () => {
    const { module, writes } = makeModule();
    const adapter = createSharedSupabaseSessionNativeAdapter(module);

    await adapter.lock.withLock(async () => {
      await adapter.writeSession("locked-envelope", 2);
    });

    expect(writes).toEqual([
      { envelope: "locked-envelope", revision: 2, handle: "handle-1" },
    ]);
    expect(module.acquireSessionLock).toHaveBeenCalledTimes(1);
  });
});
