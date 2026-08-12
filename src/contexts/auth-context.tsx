import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import { isE2EMode, getE2ECredentials } from "@/utils/e2e-mode";

// Dynamic import for Google Sign-In (native module not available in Expo Go)
let GoogleSignin: typeof import("@react-native-google-signin/google-signin").GoogleSignin | null = null;
let isErrorWithCode: typeof import("@react-native-google-signin/google-signin").isErrorWithCode | null = null;
let statusCodes: typeof import("@react-native-google-signin/google-signin").statusCodes | null = null;

try {
  const googleSignIn = require("@react-native-google-signin/google-signin");
  GoogleSignin = googleSignIn.GoogleSignin;
  isErrorWithCode = googleSignIn.isErrorWithCode;
  statusCodes = googleSignIn.statusCodes;
} catch {
  console.log("[Auth] Google Sign-In native module not available (Expo Go)");
}

// Required for web browser auth session to work properly
WebBrowser.maybeCompleteAuthSession();
import { supabase } from "@/services/supabase";
import { setStorageUserId } from "@/services/storage-prefix";
import { clearSyncData } from "@/contexts/sync-context";
import { clearWidgetData, purgeLegacyAppGroupAccessToken, purgeStaleSharedSessionOnFirstLaunch } from "@/services/widget-data-service";
import { clearWatchContext } from "@/services/watch-service";
import { AUTH_CONFIG } from "@/constants/auth";
import type { User, Session, AuthError } from "@supabase/supabase-js";

const APP_STORAGE_PREFIXES = [
  "@babies",
  "@selected_baby_id",
  "@feedings:",
  "@active_feeding_timer:",
  "@sleeps:",
  "@active_sleep_timer:",
  "@sleep_goal:",
  "@sleep_custom_goal:",
  "@sleep_milestone_check:",
  "@sleep_dismissed_milestones:",
  "@diapers:",
  "@pumpings:",
  "@active_pumping_timer:",
  "@growth:",
  "@tummyTimes:",
  "@active_tummyTime_timer:",
  "@tummyTime_goal:",
  "@tummyTime_custom_goal:",
  "@tummyTime_milestone_check:",
  "@tummyTime_dismissed_milestones:",
  "@sync_queue",
];

function isGuestStorageKey(key: string): boolean {
  if (key === "@babies" || key === "@selected_baby_id") return true;
  return APP_STORAGE_PREFIXES.some(prefix => {
    if (!prefix.endsWith(":")) return false;
    if (!key.startsWith(prefix)) return false;
    const storageScope = key.slice(prefix.length);
    return storageScope.length > 0 && !storageScope.includes(":");
  });
}

async function clearAppStorage(preserveGuestData = false): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const appKeys = allKeys.filter((key) =>
      APP_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix)) &&
      (!preserveGuestData || !isGuestStorageKey(key))
    );
    if (appKeys.length > 0) {
      await AsyncStorage.multiRemove(appKeys);
    }
  } catch (error) {
    console.error("Error clearing app storage:", error);
  }
}

WebBrowser.maybeCompleteAuthSession();

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  householdId: string | null;
  isOwner: boolean;
  createdAt: string | null;
}

interface SocialAuthResult {
  error: Error | null;
  cancelled: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithMagicLink: (
    email: string,
    options?: { createAccount?: boolean }
  ) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<SocialAuthResult>;
  signInWithApple: () => Promise<SocialAuthResult>;
  signOut: (options?: { preserveGuestData?: boolean }) => Promise<{ error: AuthError | null }>;
  updateDisplayName: (displayName: string) => Promise<{ error: Error | null }>;
  verifyPassword: (password: string) => Promise<{ verified: boolean; error: Error | null }>;
  refreshUserProfile: () => Promise<{ displayName: string | null; householdId: string | null; isOwner: boolean }>;
  isAppleSignInAvailable: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchUserProfile(
  userId: string,
  requireAvailable = false
): Promise<{ householdId: string | null; displayName: string | null; isOwner: boolean }> {
  const { data, error } = await supabase
    .from("users")
    .select("household_id, display_name, is_owner")
    .eq("id", userId)
    .single();

  if (error || !data) {
    if (requireAvailable) throw new Error("User profile is unavailable");
    return { householdId: null, displayName: null, isOwner: false };
  }

  return {
    householdId: data.household_id,
    displayName: data.display_name,
    isOwner: data.is_owner ?? false,
  };
}

function mapSupabaseUser(supabaseUser: User | null, profile: { householdId: string | null; displayName: string | null; isOwner: boolean }): AuthUser | null {
  if (!supabaseUser) return null;

  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? null,
    displayName: profile.displayName,
    householdId: profile.householdId,
    isOwner: profile.isOwner,
    createdAt: supabaseUser.created_at,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAppleSignInAvailable, setIsAppleSignInAvailable] = useState(false);

  // Check Apple Sign-in availability on iOS
  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setIsAppleSignInAvailable);
    }
  }, []);

  // Configure Google Sign-In
  useEffect(() => {
    if (!GoogleSignin) {
      console.log("[Auth] Skipping Google Sign-In configuration (module not available)");
      return;
    }
    try {
      GoogleSignin.configure({
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      });
    } catch (error) {
      console.error("[GoogleSignIn] Failed to configure:", error);
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // TR-6: purge a Keychain capsule left by a previous owner on the first
        // launch after a reinstall (iOS keeps Keychain items across uninstall).
        // The shared-relational `kSecClassGenericPassword` capsule is removed via
        // the native bridge before any auth call that would read it back, so a
        // freshly reinstalled copy never silently restores the prior owner's
        // session. AsyncStorage carries the marker so subsequent launches keep
        // a legitimate capsule.
        await purgeStaleSharedSessionOnFirstLaunch();

        if (isE2EMode()) {
          const credentials = getE2ECredentials();
          if (credentials) {
            const { data, error } = await supabase.auth.signInWithPassword({
              email: credentials.email,
              password: credentials.password,
            });
            if (!error && data.session) {
              setStorageUserId(data.session.user.id);
              const profile = await fetchUserProfile(data.session.user.id);
              setUser(mapSupabaseUser(data.session.user, profile));
              setSession(data.session);
              setIsLoading(false);
              return;
            }
          }
        }

        const { data: { session: currentSession } } = await supabase.auth.getSession();

        // TR-5: `getSession()` triggers the iOS storage adapter's migration of
        // the AsyncStorage session into the shared Keychain capsule, so by this
        // point the Keychain is the source of truth. Unconditionally remove the
        // legacy App Group `supabaseAccessToken` bearer (a previous version wrote
        // it there in the clear, included in iTunes/Finder backups, readable by
        // every target) so no JWT lingers in unencrypted shared storage after
        // the upgrade. Best-effort; `remove` on a missing key is a no-op.
        await purgeLegacyAppGroupAccessToken();

        if (currentSession?.user) {
          setStorageUserId(currentSession.user.id);
          const profile = await fetchUserProfile(currentSession.user.id);
          setUser(mapSupabaseUser(currentSession.user, profile));
          setSession(currentSession);
        } else {
          setStorageUserId(null);
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
        setStorageUserId(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === "TOKEN_REFRESHED") {
        if (newSession?.user) {
          setSession(newSession);
        } else {
          console.error("Token refresh failed - session expired");
          setStorageUserId(null);
          setUser(null);
          setSession(null);
          await clearAppStorage();
          await clearSyncData();
          await clearWidgetData();
          // Keep the expired token out of any later language republish.
          await clearWatchContext();
        }
        return;
      }

      if (newSession?.user) {
        setStorageUserId(newSession.user.id);
        setSession(newSession);

        // Set authenticated user immediately from session data
        // Profile data (householdId, displayName, isOwner) will be fetched separately
        const authUser: AuthUser = {
          id: newSession.user.id,
          email: newSession.user.email ?? null,
          displayName: newSession.user.user_metadata?.display_name ?? null,
          householdId: null,
          isOwner: false,
          createdAt: newSession.user.created_at,
        };
        setUser(authUser);

        // Fetch full profile in background (non-blocking)
        fetchUserProfile(newSession.user.id)
          .then(profile => {
            setUser(prev => prev ? { ...prev, ...profile } : prev);
          })
          .catch(() => {
            // Profile fetch failed - user is still authenticated, just missing profile data
          });
      } else {
        setStorageUserId(null);
        setUser(null);
        setSession(null);
      }

      if (event === "SIGNED_OUT") {
        setStorageUserId(null);
        setUser(null);
        setSession(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: AUTH_CONFIG.OAUTH_REDIRECT_URI,
        data: {
          display_name: displayName,
        },
      },
    });

    if (!error && data.user && displayName) {
      await supabase
        .from("users")
        .update({ display_name: displayName })
        .eq("id", data.user.id);
    }

    return { error };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error };
  }, []);

  const signInWithMagicLink = useCallback(async (
    email: string,
    options?: { createAccount?: boolean }
  ) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: AUTH_CONFIG.OAUTH_REDIRECT_URI,
        shouldCreateUser: options?.createAccount ?? true,
      },
    });

    return { error };
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<SocialAuthResult> => {
    if (!GoogleSignin || !isErrorWithCode || !statusCodes) {
      return {
        error: new Error("Google Sign-In not available (development build required)"),
        cancelled: false,
      };
    }

    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();

      const idToken = userInfo.data?.idToken;
      if (!idToken) {
        return { error: new Error("Google Sign-In: No ID token received"), cancelled: false };
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });

      if (error) {
        return { error: new Error(`Google Sign-In failed: ${error.message}`), cancelled: false };
      }

      return { error: null, cancelled: false };
    } catch (err) {
      if (isErrorWithCode(err)) {
        if (err.code === statusCodes.SIGN_IN_CANCELLED) {
          return { error: null, cancelled: true };
        } else if (err.code === statusCodes.IN_PROGRESS) {
          return { error: null, cancelled: true };
        } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          return { error: new Error("Google Play Services not available"), cancelled: false };
        }
      }
      return {
        error: err instanceof Error ? err : new Error("Google sign-in failed"),
        cancelled: false,
      };
    }
  }, []);

  const signInWithApple = useCallback(async (): Promise<SocialAuthResult> => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        return { error: new Error("Apple Sign-In: No identity token received"), cancelled: false };
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });

      if (error) {
        return { error: new Error(`Apple Sign-In failed: ${error.message}`), cancelled: false };
      }

      // Don't auto-save Apple display name - always prompt user to set their own
      return { error: null, cancelled: false };
    } catch (err) {
      const errorCode = (err as { code?: string }).code;
      if (errorCode === "ERR_REQUEST_CANCELED") {
        return { error: null, cancelled: true };
      }
      const message = err instanceof Error ? err.message : "Apple sign-in failed";
      return { error: new Error(`Apple Sign-In: ${message}`), cancelled: false };
    }
  }, []);

  const signOut = useCallback(async (options?: { preserveGuestData?: boolean }) => {
    const { error } = await supabase.auth.signOut();
    await clearWatchContext();
    if (error) return { error };
    await clearAppStorage(options?.preserveGuestData ?? false);
    await clearSyncData();
    await clearWidgetData();
    setStorageUserId(null);
    return { error: null };
  }, []);

  const updateDisplayName = useCallback(async (displayName: string) => {
    if (!user) {
      return { error: new Error("No user logged in") };
    }

    const { error } = await supabase
      .from("users")
      .update({ display_name: displayName })
      .eq("id", user.id);

    if (!error) {
      setUser((prev) => prev ? { ...prev, displayName } : null);
    }

    return { error: error ? new Error(error.message) : null };
  }, [user]);

  const verifyPassword = useCallback(async (password: string): Promise<{ verified: boolean; error: Error | null }> => {
    if (!user?.email) {
      return { verified: false, error: new Error("No email associated with account") };
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (error) {
        return { verified: false, error: new Error(error.message) };
      }

      return { verified: true, error: null };
    } catch (err) {
      return {
        verified: false,
        error: err instanceof Error ? err : new Error("Password verification failed"),
      };
    }
  }, [user?.email]);

  const refreshUserProfile = useCallback(async () => {
    let userId = user?.id;
    if (!userId) {
      const { data } = await supabase.auth.getSession();
      userId = data.session?.user?.id;
    }
    if (!userId) return { displayName: null, householdId: null, isOwner: false };

    const profile = await fetchUserProfile(userId, true);
    setUser(prev => prev ? { ...prev, ...profile } : prev);
    return profile;
  }, [user?.id]);

  const isAuthenticated = !!user;

  const value: AuthContextValue = useMemo(() => ({
    user,
    session,
    isLoading,
    isAuthenticated,
    signUp,
    signIn,
    signInWithMagicLink,
    signInWithGoogle,
    signInWithApple,
    signOut,
    updateDisplayName,
    verifyPassword,
    refreshUserProfile,
    isAppleSignInAvailable,
  }), [user, session, isLoading, isAuthenticated, signUp, signIn, signInWithMagicLink, signInWithGoogle, signInWithApple, signOut, updateDisplayName, verifyPassword, refreshUserProfile, isAppleSignInAvailable]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
