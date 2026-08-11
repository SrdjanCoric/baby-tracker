import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

import { createSharedSupabaseClientOptions } from "@/services/shared-supabase-session";
import { loadSharedSupabaseSessionBridge } from "@/services/shared-supabase-session-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please check your .env file."
  );
}

// Must match the storage key supabase-js derives for the auth session, so the
// shared Keychain capsule replaces exactly the value the SDK persists.
const projectRef = (() => {
  try {
    return new URL(supabaseUrl).hostname.split(".")[0];
  } catch {
    return "supabase";
  }
})();
const sessionStorageKey = `sb-${projectRef}-auth-token`;

const sharedBridge = loadSharedSupabaseSessionBridge();
const { storage, lock } = sharedBridge
  ? createSharedSupabaseClientOptions({
      isIOS: true,
      bridge: sharedBridge,
      appLock: sharedBridge.lock,
      sessionKey: sessionStorageKey,
      legacyStorage: AsyncStorage,
    })
  : { storage: AsyncStorage, lock: undefined };

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    lock,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});