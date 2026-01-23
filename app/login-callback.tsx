/**
 * OAuth callback handler route
 * Handles redirects from OAuth providers (Google, Apple, Magic Link)
 */

import { useEffect } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "@/services/supabase";
import { SURFACE_COLORS, ACTION_COLORS } from "@/constants/design-tokens";
import { useColorScheme } from "nativewind";

export default function LoginCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const accessToken = params.access_token as string | undefined;
        const refreshToken = params.refresh_token as string | undefined;

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        } else {
          await supabase.auth.getSession();
        }

        setTimeout(() => {
          router.replace("/");
        }, 500);
      } catch {
        router.replace("/");
      }
    };

    handleCallback();
  }, [params, router]);

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
        Signing you in...
      </Text>
    </View>
  );
}
