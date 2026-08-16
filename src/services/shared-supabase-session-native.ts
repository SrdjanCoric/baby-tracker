import { NativeModules, Platform } from "react-native";
import type {
  SharedSupabaseSessionBridge,
  SharedSupabaseSessionLock,
} from "./shared-supabase-session";

export interface SharedSupabaseSessionNativeModule {
  readSession(): Promise<string | null>;
  writeSession(
    envelopeJson: string,
    expectedRevision: number | null,
    handle: string
  ): Promise<void>;
  removeSession(
    expectedRevision: number,
    expectedLineage: string,
    handle: string
  ): Promise<void>;
  purgeSession(): Promise<void>;
  acquireSessionLock(): Promise<string>;
  releaseSessionLock(handle: string): Promise<void>;
}

type SharedSupabaseSessionNativeLockModule = Pick<
  SharedSupabaseSessionNativeModule,
  "acquireSessionLock" | "releaseSessionLock"
>;

export interface SharedSupabaseSessionBridgeAndLock extends SharedSupabaseSessionBridge {
  lock: SharedSupabaseSessionLock;
  purgeSession(): Promise<void>;
}

export function createSharedSupabaseSessionLock(
  module: SharedSupabaseSessionNativeLockModule,
  setActiveHandle: (handle: string | null) => void = () => undefined,
  afterRelease: () => Promise<void> = async () => undefined,
  beforeBody: (handle: string) => Promise<void> = async () => undefined
): SharedSupabaseSessionLock {
  // React Native dispatches this module's methods through one serial native
  // queue. Queue app callers here so a waiting acquire cannot sit ahead of the
  // current holder's release and force both calls to time out.
  let tail: Promise<void> = Promise.resolve();

  return {
    withLock: async <T>(fn: (handle: string) => Promise<T>): Promise<T> => {
      const predecessor = tail;
      let advanceQueue!: () => void;
      tail = new Promise<void>((resolve) => {
        advanceQueue = resolve;
      });

      await predecessor;
      try {
        const handle = await module.acquireSessionLock();
        setActiveHandle(handle);
        let bodyCompleted = false;
        let bodyResult: T | undefined;
        let bodyError: unknown;
        try {
          await beforeBody(handle);
          bodyResult = await fn(handle);
          bodyCompleted = true;
        } catch (error) {
          bodyError = error;
        } finally {
          try {
            await module.releaseSessionLock(handle);
          } finally {
            setActiveHandle(null);
          }
        }
        try {
          await afterRelease();
        } catch {
          // Recovery is best effort here. Any pending mutation remains queued
          // and is retried under the next issued handle before its body runs.
        }
        if (!bodyCompleted) throw bodyError;
        return bodyResult as T;
      } finally {
        advanceQueue();
      }
    },
  };
}

function nativeErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error == null || !("code" in error)) {
    return null;
  }
  return typeof error.code === "string" ? error.code : null;
}

export function createSharedSupabaseSessionNativeAdapter(
  module: SharedSupabaseSessionNativeModule
): SharedSupabaseSessionBridgeAndLock {
  let activeHandle: string | null = null;
  type PendingMutation =
    | {
        kind: "write";
        envelopeJson: string;
        expectedRevision: number | null;
      }
    | {
        kind: "remove";
        expectedRevision: number;
        expectedLineage: string;
      };
  const pendingMutations: PendingMutation[] = [];

  const applyPendingMutation = async (
    pending: PendingMutation,
    handle: string
  ): Promise<void> => {
    try {
      if (pending.kind === "write") {
        await module.writeSession(
          pending.envelopeJson,
          pending.expectedRevision,
          handle
        );
      } else {
        await module.removeSession(
          pending.expectedRevision,
          pending.expectedLineage,
          handle
        );
      }
    } catch (error) {
      // A newer capsule won while the original handle was revoked. Its
      // unspent token is already durable, so never overwrite it.
      if (nativeErrorCode(error) !== "SESSION_CHANGED") throw error;
    }
  };

  const flushPendingMutationsWithHandle = async (
    handle: string
  ): Promise<void> => {
    while (pendingMutations.length > 0) {
      const pending = pendingMutations[0];
      await applyPendingMutation(pending, handle);
      pendingMutations.shift();
    }
  };

  const flushPendingMutations = async (): Promise<void> => {
    if (pendingMutations.length === 0) return;

    const recoveryHandle = await module.acquireSessionLock();
    activeHandle = recoveryHandle;
    try {
      await flushPendingMutationsWithHandle(recoveryHandle);
    } finally {
      try {
        await module.releaseSessionLock(recoveryHandle);
      } finally {
        activeHandle = null;
      }
    }
  };

  const bridge: SharedSupabaseSessionBridge = {
    readSession: () => module.readSession(),
    writeSession: async (envelopeJson, expectedRevision = null) => {
      try {
        await module.writeSession(
          envelopeJson,
          expectedRevision,
          activeHandle ?? ""
        );
      } catch (error) {
        if (nativeErrorCode(error) !== "LOCK_REVOKED") throw error;
        pendingMutations.push({
          kind: "write",
          envelopeJson,
          expectedRevision,
        });
      }
    },
    removeSession: async (expectedRevision, expectedLineage) => {
      try {
        await module.removeSession(
          expectedRevision,
          expectedLineage,
          activeHandle ?? ""
        );
      } catch (error) {
        if (nativeErrorCode(error) !== "LOCK_REVOKED") throw error;
        pendingMutations.push({
          kind: "remove",
          expectedRevision,
          expectedLineage,
        });
      }
    },
  };

  const lock = createSharedSupabaseSessionLock(
    module,
    (handle) => {
      activeHandle = handle;
    },
    flushPendingMutations,
    flushPendingMutationsWithHandle
  );

  return { ...bridge, lock, purgeSession: () => module.purgeSession() };
}

/**
 * Load the native SharedSupabaseSession bridge and its cross-process lock.
 * Returns `null` when the native module is unavailable (non-iOS, Expo Go, or a
 * prebuilt client without the module) so the Supabase client can fall back to
 * AsyncStorage storage without crashing.
 */
export function loadSharedSupabaseSessionBridge(): SharedSupabaseSessionBridgeAndLock | null {
  if (Platform.OS !== "ios") return null;

  const module = NativeModules.SharedSupabaseSession as
    | SharedSupabaseSessionNativeModule
    | undefined;
  if (!module) return null;

  return createSharedSupabaseSessionNativeAdapter(module);
}
