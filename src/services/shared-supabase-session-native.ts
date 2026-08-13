import { NativeModules, Platform } from "react-native";
import type {
  SharedSupabaseSessionBridge,
  SharedSupabaseSessionLock,
} from "./shared-supabase-session";

interface SharedSupabaseSessionNativeModule {
  readSession(): Promise<string | null>;
  writeSession(envelopeJson: string): Promise<void>;
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
  module: SharedSupabaseSessionNativeLockModule
): SharedSupabaseSessionLock {
  // React Native dispatches this module's methods through one serial native
  // queue. Queue app callers here so a waiting acquire cannot sit ahead of the
  // current holder's release and force both calls to time out.
  let tail: Promise<void> = Promise.resolve();

  return {
    withLock: async <T>(fn: () => Promise<T>): Promise<T> => {
      const predecessor = tail;
      let advanceQueue!: () => void;
      tail = new Promise<void>((resolve) => {
        advanceQueue = resolve;
      });

      await predecessor;
      try {
        const handle = await module.acquireSessionLock();
        try {
          return await fn();
        } finally {
          await module.releaseSessionLock(handle);
        }
      } finally {
        advanceQueue();
      }
    },
  };
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

  const bridge: SharedSupabaseSessionBridge = {
    readSession: () => module.readSession(),
    writeSession: (envelopeJson) => module.writeSession(envelopeJson),
    removeSession: () => module.removeSession(),
  };

  const lock = createSharedSupabaseSessionLock(module);

  return { ...bridge, lock };
}
