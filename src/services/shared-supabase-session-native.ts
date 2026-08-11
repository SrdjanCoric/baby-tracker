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

export interface SharedSupabaseSessionBridgeAndLock
  extends SharedSupabaseSessionBridge {
  lock: SharedSupabaseSessionLock;
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

  const lock: SharedSupabaseSessionLock = {
    withLock: async <T>(fn: () => Promise<T>): Promise<T> => {
      const handle = await module.acquireSessionLock();
      try {
        return await fn();
      } finally {
        await module.releaseSessionLock(handle);
      }
    },
  };

  return { ...bridge, lock };
}