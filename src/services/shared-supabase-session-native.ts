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
  removeSession(): Promise<void>;
  acquireSessionLock(): Promise<string>;
  releaseSessionLock(handle: string): Promise<void>;
}

type SharedSupabaseSessionNativeLockModule = Pick<
  SharedSupabaseSessionNativeModule,
  "acquireSessionLock" | "releaseSessionLock"
>;

export interface SharedSupabaseSessionBridgeAndLock
  extends SharedSupabaseSessionBridge {
  lock: SharedSupabaseSessionLock;
}

export function createSharedSupabaseSessionLock(
  module: SharedSupabaseSessionNativeLockModule,
  setActiveHandle: (handle: string | null) => void = () => undefined,
  afterRelease: () => Promise<void> = async () => undefined
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
        await afterRelease();
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
  let pendingWrite:
    | { envelopeJson: string; expectedRevision: number | null }
    | undefined;

  const flushPendingWrite = async (): Promise<void> => {
    const pending = pendingWrite;
    pendingWrite = undefined;
    if (!pending) return;

    const recoveryHandle = await module.acquireSessionLock();
    activeHandle = recoveryHandle;
    try {
      try {
        await module.writeSession(
          pending.envelopeJson,
          pending.expectedRevision,
          recoveryHandle
        );
      } catch (error) {
        // A newer capsule won while the original handle was revoked. Its
        // unspent token is already durable, so never overwrite it.
        if (nativeErrorCode(error) !== "SESSION_CHANGED") throw error;
      }
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
        pendingWrite = { envelopeJson, expectedRevision };
      }
    },
    removeSession: () => module.removeSession(),
  };

  const lock = createSharedSupabaseSessionLock(
    module,
    (handle) => {
      activeHandle = handle;
    },
    flushPendingWrite
  );

  return { ...bridge, lock };
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
