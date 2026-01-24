import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import { GoogleSignin, isErrorWithCode, statusCodes } from "@react-native-google-signin/google-signin";

// Required for web browser auth session to work properly
WebBrowser.maybeCompleteAuthSession();
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
  verifyPassword: (password: string) => Promise<{ verified: boolean; error: Error | null }>;
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

  // Check Apple Sign-in availability on iOS
  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setIsAppleSignInAvailable);
    }
  }, []);

  // Configure Google Sign-In
  useEffect(() => {
    try {
      GoogleSignin.configure({
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      });
    } catch (error) {
      console.error("Failed to configure Google Sign-In:", error);
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

  const signInWithMagicLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: AUTH_CONFIG.OAUTH_REDIRECT_URI,
      },
    });

    return { error };
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<{ error: Error | null }> => {
    try {
      console.log("[GoogleSignIn] Starting sign in...");
      await GoogleSignin.hasPlayServices();
      console.log("[GoogleSignIn] Play services available");

      const userInfo = await GoogleSignin.signIn();
      console.log("[GoogleSignIn] User info received:", JSON.stringify(userInfo, null, 2));

      const idToken = userInfo.data?.idToken;
      if (!idToken) {
        console.log("[GoogleSignIn] No ID token in response");
        return { error: new Error("Google Sign-In: No ID token received") };
      }

      console.log("[GoogleSignIn] ID token received, calling Supabase...");
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });

      if (error) {
        console.log("[GoogleSignIn] Supabase error:", error.message);
        return { error: new Error(`Google Sign-In failed: ${error.message}`) };
      }

      console.log("[GoogleSignIn] Success!");
      return { error: null };
    } catch (err) {
      console.log("[GoogleSignIn] Caught error:", err);
      if (isErrorWithCode(err)) {
        console.log("[GoogleSignIn] Error code:", err.code);
        if (err.code === statusCodes.SIGN_IN_CANCELLED) {
          return { error: null };
        } else if (err.code === statusCodes.IN_PROGRESS) {
          return { error: null };
        } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          return { error: new Error("Google Play Services not available") };
        }
      }
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

      if (!credential.identityToken) {
        return { error: new Error("Apple Sign-In: No identity token received") };
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });

      if (error) {
        return { error: new Error(`Apple Sign-In failed: ${error.message}`) };
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

      return { error: null };
    } catch (err) {
      const errorCode = (err as { code?: string }).code;
      if (errorCode === "ERR_REQUEST_CANCELED") {
        return { error: null };
      }
      const message = err instanceof Error ? err.message : "Apple sign-in failed";
      return { error: new Error(`Apple Sign-In: ${message}`) };
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
    verifyPassword,
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
