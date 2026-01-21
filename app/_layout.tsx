import "../global.css";
import "../src/i18n";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, BabyProvider, FeedingProvider, SleepProvider, DiaperProvider, PumpingProvider, GrowthProvider, TummyTimeProvider, ThemeProvider, UnitProvider, HouseholdProvider, SyncProvider, useTheme, useAuth, useSync } from "@/contexts";
import { NightModeOverlay } from "@/components/NightModeOverlay";
import { OfflineBanner } from "@/components/OfflineBanner";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "auth";

    // Only redirect authenticated users away from auth screens
    // Guest users can use the app without signing in
    if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface dark:bg-surface-dark">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

function OfflineBannerWrapper() {
  const { status, pendingCount } = useSync();
  const [isDismissed, setIsDismissed] = useState(false);
  const isOffline = status === "offline";

  useEffect(() => {
    if (!isOffline) {
      setIsDismissed(false);
    }
  }, [isOffline]);

  if (!isOffline || isDismissed) {
    return null;
  }

  return (
    <OfflineBanner
      pendingCount={pendingCount}
      onDismiss={() => setIsDismissed(true)}
      testID="offline-banner"
    />
  );
}

function AppContent() {
  const { isDark } = useTheme();

  return (
    <View className="flex-1">
      <OfflineBannerWrapper />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="auth"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
            gestureEnabled: true,
            gestureDirection: "vertical",
          }}
        />
        <Stack.Screen
          name="baby"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="feeding"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="sleep"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="diaper"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="pumping"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="growth"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="tummyTime"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="edit"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
      </Stack>
      <NightModeOverlay />
      <StatusBar style={isDark ? "light" : "dark"} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGuard>
          <HouseholdProvider>
            <SyncProvider>
              <UnitProvider>
                <BabyProvider>
                  <FeedingProvider>
                    <SleepProvider>
                      <DiaperProvider>
                        <PumpingProvider>
                          <GrowthProvider>
                            <TummyTimeProvider>
                              <AppContent />
                            </TummyTimeProvider>
                          </GrowthProvider>
                        </PumpingProvider>
                      </DiaperProvider>
                    </SleepProvider>
                  </FeedingProvider>
                </BabyProvider>
              </UnitProvider>
            </SyncProvider>
          </HouseholdProvider>
        </AuthGuard>
      </AuthProvider>
    </ThemeProvider>
  );
}
