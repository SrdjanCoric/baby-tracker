/**
 * OAuth callback handler route
 * Handles redirects from OAuth providers (Google, Apple, Magic Link)
 * Tokens are handled both here and by DeepLinkHandler in _layout.tsx
 */

import { useEffect, useRef, useState } from "react";
import { View, ActivityIndicator, Text, Platform } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { useAuth } from "@/contexts";
import { supabase } from "@/services/supabase";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";
import { SURFACE_COLORS, ACTION_COLORS } from "@/constants/design-tokens";
import { useColorScheme } from "nativewind";

function parseAuthParams(url: string) {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');

  let params = new URLSearchParams();

  if (hashIndex !== -1) {
    params = new URLSearchParams(url.substring(hashIndex + 1));
  }

  if (queryIndex !== -1) {
    const endIndex = hashIndex !== -1 ? hashIndex : url.length;
    const queryParams = new URLSearchParams(url.substring(queryIndex + 1, endIndex));
    queryParams.forEach((value, key) => {
      if (!params.has(key)) params.set(key, value);
    });
  }

  return {
    code: params.get('code'),
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    tokenHash: params.get('token_hash'),
    type: params.get('type'),
  };
}

async function processAuthParams(url: string): Promise<boolean> {
  const { code, accessToken, refreshToken, tokenHash, type } = parseAuthParams(url);

  // PKCE flow
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return false;
    return true;
  }

  // Implicit flow
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) return false;
    return true;
  }

  // OTP verification
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'email' | 'magiclink',
    });
    if (error) return false;
    return true;
  }

  return false;
}

export default function LoginCallbackScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const hasProcessedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const url = Linking.useURL();

  useEffect(() => {
    const handleUrl = async (urlToProcess: string | null) => {
      if (hasProcessedRef.current || !urlToProcess) return;
      if (!urlToProcess.includes('login-callback')) return;

      hasProcessedRef.current = true;

      try {
        const success = await processAuthParams(urlToProcess);
        if (!success) setError("Authentication failed. Please try again.");
      } catch {
        console.error("[LoginCallback] Authentication failed");
        setError("Authentication failed. Please try again.");
      }
    };

    handleUrl(url);
  }, [url]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const pollForUrl = async () => {
      if (hasProcessedRef.current) return;

      for (let i = 0; i < 10; i++) {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && initialUrl.includes('login-callback')) {
          if (initialUrl.includes('access_token') || initialUrl.includes('token_hash')) {
            if (!hasProcessedRef.current) {
              hasProcessedRef.current = true;
              await processAuthParams(initialUrl);
            }
            return;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    };

    pollForUrl();
  }, []);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    let active = true;
    const finishAuthentication = async () => {
      const state = await NewOwnerOnboardingStorageService.getState("system");
      if (!active) return;
      router.replace(state.screen === "auth-pending"
        ? "/auth/sign-in?resumeOnboarding=true"
        : "/(tabs)");
    };
    void finishAuthentication();
    return () => {
      active = false;
    };
  }, [isAuthenticated, isLoading, router]);

  return (
    <View
      className="flex-1 items-center justify-center"
      style={{
        backgroundColor: isDark ? SURFACE_COLORS.dark.background : SURFACE_COLORS.light.background,
      }}
    >
      <ActivityIndicator
        size="large"
        color={isDark ? ACTION_COLORS.dark.primary : ACTION_COLORS.light.primary}
      />
      <Text className="mt-4 text-content-secondary dark:text-content-dark-secondary">
        {error || "Signing you in..."}
      </Text>
    </View>
  );
}
