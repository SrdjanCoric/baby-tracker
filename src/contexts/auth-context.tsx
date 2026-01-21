import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
import { supabase } from "@/services/supabase";
import { setStorageUserId } from "@/services/storage-prefix";
import { clearSyncData } from "@/contexts/sync-context";
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

async function clearAppStorage(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const appKeys = allKeys.filter((key) =>
      APP_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))
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
}

interface AuthContextValue {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithApple: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  updateDisplayName: (displayName: string) => Promise<{ error: Error | null }>;
  isAppleSignInAvailable: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchUserProfile(userId: string): Promise<{ householdId: string | null; displayName: string | null }> {
  const { data, error } = await supabase
    .from("users")
    .select("household_id, display_name")
    .eq("id", userId)
    .single();

  if (error || !data) {
    return { householdId: null, displayName: null };
  }

  return {
    householdId: data.household_id,
    displayName: data.display_name,
  };
}

function mapSupabaseUser(user: User | null, profile: { householdId: string | null; displayName: string | null }): AuthUser | null {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email ?? null,
    displayName: profile.displayName,
    householdId: profile.householdId,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAppleSignInAvailable, setIsAppleSignInAvailable] = useState(false);
  const oauthStateRef = useRef<string | null>(null);

  // Check Apple Sign-in availability on iOS
  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setIsAppleSignInAvailable);
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();

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
        }
        return;
      }

      if (newSession?.user) {
        setStorageUserId(newSession.user.id);
        const profile = await fetchUserProfile(newSession.user.id);
        setUser(mapSupabaseUser(newSession.user, profile));
        setSession(newSession);
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

  const signInWithMagicLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
    });

    return { error };
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<{ error: Error | null }> => {
    try {
      const stateBytes = await Crypto.getRandomBytesAsync(32);
      const state = Array.from(stateBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      oauthStateRef.current = state;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: AUTH_CONFIG.OAUTH_REDIRECT_URI,
          skipBrowserRedirect: true,
          queryParams: {
            state,
          },
        },
      });

      if (error) {
        oauthStateRef.current = null;
        return { error: new Error(error.message) };
      }

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          AUTH_CONFIG.OAUTH_REDIRECT_URI
        );

        if (result.type === "success" && result.url) {
          const url = new URL(result.url);
          const returnedState = url.searchParams.get("state") || url.hash?.match(/state=([^&]+)/)?.[1];

          if (returnedState !== oauthStateRef.current) {
            oauthStateRef.current = null;
            return { error: new Error("OAuth state validation failed") };
          }

          oauthStateRef.current = null;

          const accessToken = url.searchParams.get("access_token") || url.hash?.match(/access_token=([^&]+)/)?.[1];
          const refreshToken = url.searchParams.get("refresh_token") || url.hash?.match(/refresh_token=([^&]+)/)?.[1];

          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }
        } else {
          oauthStateRef.current = null;
        }
      }

      return { error: null };
    } catch (err) {
      oauthStateRef.current = null;
      return { error: err instanceof Error ? err : new Error("Google sign-in failed") };
    }
  }, []);

  const signInWithApple = useCallback(async (): Promise<{ error: Error | null }> => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: credential.identityToken,
        });

        if (error) {
          return { error: new Error(error.message) };
        }

        if (data?.user && credential.fullName?.givenName) {
          const displayName = [credential.fullName.givenName, credential.fullName.familyName]
            .filter(Boolean)
            .join(" ");

          if (displayName) {
            try {
              await supabase
                .from("users")
                .update({ display_name: displayName })
                .eq("id", data.user.id);
            } catch (updateError) {
              console.error("Failed to update display name:", updateError);
            }
          }
        }
      }

      return { error: null };
    } catch (err) {
      if ((err as { code?: string }).code === "ERR_REQUEST_CANCELED") {
        return { error: null };
      }
      return { error: err instanceof Error ? err : new Error("Apple sign-in failed") };
    }
  }, []);

  const signOut = useCallback(async () => {
    await clearAppStorage();
    await clearSyncData();
    setStorageUserId(null);
    const { error } = await supabase.auth.signOut();
    return { error };
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

  const value: AuthContextValue = {
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signInWithMagicLink,
    signInWithGoogle,
    signInWithApple,
    signOut,
    updateDisplayName,
    isAppleSignInAvailable,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
