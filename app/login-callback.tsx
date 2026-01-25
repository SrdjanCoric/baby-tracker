/**
 * OAuth callback handler route
 * Handles redirects from OAuth providers (Google, Apple, Magic Link)
 * Note: Auth tokens are handled by DeepLinkHandler in _layout.tsx
 * This route waits for auth state to update then navigates
 */

import { useEffect } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts";
import { SURFACE_COLORS, ACTION_COLORS } from "@/constants/design-tokens";
import { useColorScheme } from "nativewind";

export default function LoginCallbackScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated) {
      router.replace("/(tabs)");
    }
    // If not authenticated, stay on this screen - DeepLinkHandler will set the session
    // and trigger onAuthStateChange which will update isAuthenticated
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
        Signing you in...
      </Text>
    </View>
  );
}
