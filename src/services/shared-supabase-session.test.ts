import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

const asyncStorage = {
  getItem: vi
    .fn<(key: string) => Promise<string | null>>()
    .mockResolvedValue(null),
  setItem: vi
    .fn<(key: string, value: string) => Promise<void>>()
    .mockResolvedValue(undefined),
  removeItem: vi
    .fn<(key: string) => Promise<void>>()
    .mockResolvedValue(undefined),
};

import {
  buildSharedSessionEnvelope,
  createSharedSupabaseClientOptions,
  decodeSupabaseSessionLineage,
  type SharedSupabaseSessionBridge,
  type SharedSupabaseSessionLock,
} from "./shared-supabase-session";

const SESSION_KEY = "sb-ref-auth-token";

function jwt(payload: Record<string, unknown>): string {
  const header = JSON.stringify({ alg: "HS256", typ: "JWT" });
  const payloadJson = JSON.stringify(payload);
  const b64url = (s: string) =>
    Buffer.from(s, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${b64url(header)}.${b64url(payloadJson)}.signature`;
}

function sessionJson(
  accessToken: string,
  refreshToken = "refresh-1",
  expiresAt = 1234567890
): string {
  return JSON.stringify({
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 3600,
    token_type: "bearer",
    user: { id: "user-1" },
    expires_at: expiresAt,
  });
}

function envelopeJson(
  revision: number,
  accessToken: string,
  refreshToken = "refresh-1",
  expiresAt?: number
): string {
  return JSON.stringify(
    buildSharedSessionEnvelope(
      revision,
      sessionJson(accessToken, refreshToken, expiresAt)
    )
  );
}

function immediateLock(): SharedSupabaseSessionLock {
  return { withLock: <T>(fn: () => Promise<T>) => fn() };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

class ExclusiveTestLock implements SharedSupabaseSessionLock {
  private tail: Promise<void> = Promise.resolve();
  readonly events: string[] = [];

  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const predecessor = this.tail;
    const released = deferred<void>();
    this.tail = released.promise;
    await predecessor;
    this.events.push("lock:entered");
    try {
      return await fn();
    } finally {
      this.events.push("lock:released");
      released.resolve();
    }
  }
}

function makeBridge(): SharedSupabaseSessionBridge & {
  reads: number;
  writes: { envelope: string }[];
  removed: number;
  setNext(value: string | null): void;
} {
  let value: string | null = null;
  return {
    reads: 0,
    writes: [],
    removed: 0,
    setNext(next) {
      value = next;
    },
    async readSession() {
      this.reads += 1;
      return value;
    },
    async writeSession(envelope) {
      value = envelope;
      this.writes.push({ envelope });
    },
    async removeSession() {
      this.removed += 1;
      value = null;
    },
  };
}

describe("SharedSupabaseAuthStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asyncStorage.getItem.mockResolvedValue(null);
    asyncStorage.setItem.mockResolvedValue(undefined);
    asyncStorage.removeItem.mockResolvedValue(undefined);
  });

  it("round-trips a session through the shared store", async () => {
    const bridge = makeBridge();
    const { storage } = createSharedSupabaseClientOptions({
      isIOS: true,
      bridge,
      sessionKey: SESSION_KEY,
      legacyStorage: asyncStorage,
      appLock: immediateLock(),
    });

    const lineage = jwt({ session_id: "lineage-a", sub: "user-1" });
    const session = sessionJson(lineage, "refresh-1");
    await storage.setItem(SESSION_KEY, session);

    expect(bridge.writes).toHaveLength(1);
    const envelope = JSON.parse(bridge.writes[0].envelope);
    expect(envelope.version).toBe(1);
    expect(envelope.revision).toBe(1);
    expect(envelope.lineage).toBe("lineage-a");
    expect(envelope.session).toBe(session);

    const readBack = await storage.getItem(SESSION_KEY);
    expect(readBack).toBe(session);
  });

  it("bumps the envelope revision when the session rotates", async () => {
    const bridge = makeBridge();
    bridge.setNext(
      envelopeJson(3, jwt({ session_id: "lineage-a", sub: "user-1" }))
    );
    const { storage } = createSharedSupabaseClientOptions({
      isIOS: true,
      bridge,
      sessionKey: SESSION_KEY,
      legacyStorage: asyncStorage,
      appLock: immediateLock(),
    });

    const rotated = sessionJson(
      jwt({ session_id: "lineage-a", sub: "user-1" }),
      "refresh-2"
    );
    await storage.setItem(SESSION_KEY, rotated);

    expect(bridge.writes).toHaveLength(1);
    const envelope = JSON.parse(bridge.writes[0].envelope);
    expect(envelope.revision).toBe(4);
    expect(envelope.session).toBe(rotated);
  });

  it("picks up a pair the Widget wrote back", async () => {
    const bridge = makeBridge();
    const widgetToken = jwt({ session_id: "lineage-a", sub: "user-1" });
    bridge.setNext(envelopeJson(9, widgetToken, "refresh-widget"));

    const { storage } = createSharedSupabaseClientOptions({
      isIOS: true,
      bridge,
      sessionKey: SESSION_KEY,
      legacyStorage: asyncStorage,
      appLock: immediateLock(),
    });

    const readBack = await storage.getItem(SESSION_KEY);
    expect(readBack).toBe(sessionJson(widgetToken, "refresh-widget"));
  });

  it("migrates an iOS AsyncStorage session into the shared store exactly once", async () => {
    const bridge = makeBridge();
    const lineage = jwt({ session_id: "lineage-a", sub: "user-1" });
    const legacy = sessionJson(lineage, "refresh-1");
    asyncStorage.getItem.mockResolvedValue(legacy);

    const { storage } = createSharedSupabaseClientOptions({
      isIOS: true,
      bridge,
      sessionKey: SESSION_KEY,
      legacyStorage: asyncStorage,
      appLock: immediateLock(),
    });

    const first = await storage.getItem(SESSION_KEY);
    expect(first).toBe(legacy);
    expect(bridge.writes).toHaveLength(1);
    const envelope = JSON.parse(bridge.writes[0].envelope);
    expect(envelope.revision).toBe(1);
    expect(envelope.lineage).toBe("lineage-a");
    expect(asyncStorage.removeItem).toHaveBeenCalledWith(SESSION_KEY);

    bridge.setNext(bridge.writes[0].envelope);
    const second = await storage.getItem(SESSION_KEY);
    expect(second).toBe(legacy);
    expect(bridge.writes).toHaveLength(1);
    expect(asyncStorage.removeItem).toHaveBeenCalledTimes(1);
  });

  it("delegates non-session keys to AsyncStorage", async () => {
    const bridge = makeBridge();
    const { storage } = createSharedSupabaseClientOptions({
      isIOS: true,
      bridge,
      sessionKey: SESSION_KEY,
      legacyStorage: asyncStorage,
      appLock: immediateLock(),
    });

    await storage.setItem("pkce-verifier", "abc");
    await storage.getItem("pkce-verifier");
    await storage.removeItem("pkce-verifier");

    expect(asyncStorage.setItem).toHaveBeenCalledWith("pkce-verifier", "abc");
    expect(asyncStorage.getItem).toHaveBeenCalledWith("pkce-verifier");
    expect(asyncStorage.removeItem).toHaveBeenCalledWith("pkce-verifier");
    expect(bridge.writes).toHaveLength(0);
    expect(bridge.removed).toBe(0);
  });

  it("removes the shared session without nested lock acquisition", async () => {
    const bridge = makeBridge();
    const lockCalls: string[] = [];
    const { storage } = createSharedSupabaseClientOptions({
      isIOS: true,
      bridge,
      sessionKey: SESSION_KEY,
      legacyStorage: asyncStorage,
      appLock: {
        withLock: <T>(fn: () => Promise<T>) => {
          lockCalls.push("lock");
          return fn();
        },
      },
    });

    await storage.removeItem(SESSION_KEY);
    expect(bridge.removed).toBe(1);
    expect(lockCalls).toHaveLength(0);
  });

  it("returns an auth-js lock on iOS that owns one native flock", async () => {
    const { lock } = createSharedSupabaseClientOptions({
      isIOS: true,
      bridge: makeBridge(),
      sessionKey: SESSION_KEY,
      legacyStorage: asyncStorage,
      appLock: immediateLock(),
    });
    expect(lock).toBeTypeOf("function");
  });

  it("holds the shared POSIX lock across Supabase refresh read, redeem, and write", async () => {
    const bridge = makeBridge();
    const lock = new ExclusiveTestLock();
    const accessToken = jwt({
      session_id: "lineage-a",
      sub: "user-1",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    bridge.setNext(
      envelopeJson(
        1,
        accessToken,
        "refresh-1",
        Math.floor(Date.now() / 1000) + 3600
      )
    );

    const refreshStarted = deferred<void>();
    const refreshResponse = deferred<Response>();
    const fetchMock = vi.fn(async () => {
      refreshStarted.resolve();
      return refreshResponse.promise;
    });
    const authOptions = createSharedSupabaseClientOptions({
      isIOS: true,
      bridge,
      sessionKey: SESSION_KEY,
      legacyStorage: asyncStorage,
      appLock: lock,
    });
    const client = createClient("https://ref.supabase.co", "anon-key", {
      auth: {
        ...authOptions,
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: false,
      },
      global: { fetch: fetchMock },
    });
    await client.auth.initialize();
    expect(fetchMock).not.toHaveBeenCalled();

    const appRefresh = client.auth.refreshSession();
    await refreshStarted.promise;

    let widgetEntered = false;
    let widgetSawRotatedPair = false;
    const widgetRefresh = lock.withLock(async () => {
      widgetEntered = true;
      const latest = JSON.parse(bridge.writes.at(-1)?.envelope ?? "null");
      widgetSawRotatedPair =
        JSON.parse(latest.session).refresh_token === "refresh-2";
    });
    await Promise.resolve();

    expect(widgetEntered).toBe(false);

    const rotatedAccessToken = jwt({
      session_id: "lineage-a",
      sub: "user-1",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    refreshResponse.resolve(
      new Response(
        JSON.stringify({
          access_token: rotatedAccessToken,
          refresh_token: "refresh-2",
          expires_in: 3600,
          token_type: "bearer",
          user: { id: "user-1" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await expect(appRefresh).resolves.toMatchObject({ error: null });
    await widgetRefresh;

    const written = JSON.parse(bridge.writes.at(-1)?.envelope ?? "null");
    expect(JSON.parse(written.session).refresh_token).toBe("refresh-2");
    expect(widgetSawRotatedPair).toBe(true);
  });

  it("leaves Android and web on AsyncStorage with no cross-process lock", async () => {
    const { storage, lock } = createSharedSupabaseClientOptions({
      isIOS: false,
      bridge: makeBridge(),
      sessionKey: SESSION_KEY,
      legacyStorage: asyncStorage,
      appLock: immediateLock(),
    });

    expect(storage).toBe(asyncStorage);
    expect(lock).toBeUndefined();
  });

  it("returns null for a malformed shared envelope", async () => {
    const bridge = makeBridge();
    bridge.setNext("not-json");
    const { storage } = createSharedSupabaseClientOptions({
      isIOS: true,
      bridge,
      sessionKey: SESSION_KEY,
      legacyStorage: asyncStorage,
      appLock: immediateLock(),
    });

    await expect(storage.getItem(SESSION_KEY)).resolves.toBeNull();
  });
});

describe("decodeSupabaseSessionLineage", () => {
  it("extracts session_id from an access token", () => {
    const token = jwt({ session_id: "lineage-a", sub: "user-1" });
    expect(decodeSupabaseSessionLineage(token)).toBe("lineage-a");
  });

  it("returns null when the claim is absent", () => {
    expect(decodeSupabaseSessionLineage(jwt({ sub: "user-1" }))).toBeNull();
    expect(decodeSupabaseSessionLineage("not-a-jwt")).toBeNull();
  });
});
