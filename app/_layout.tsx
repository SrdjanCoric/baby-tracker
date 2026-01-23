import "../global.css";
import "../src/i18n";
import { useEffect, useState, useRef, useCallback } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, BabyProvider, FeedingProvider, SleepProvider, DiaperProvider, PumpingProvider, GrowthProvider, TummyTimeProvider, ThemeProvider, UnitProvider, HouseholdProvider, SyncProvider, NotificationProvider, DashboardConfigProvider, useTheme, useAuth, useSync } from "@/contexts";
import { NightModeOverlay } from "@/components/NightModeOverlay";
import { OfflineBanner } from "@/components/OfflineBanner";
import { OnboardingStorageService } from "@/services/onboarding-storage";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);
  const isMountedRef = useRef(true);
  const navigationInProgressRef = useRef(false);

  const handleNavigation = useCallback(async () => {
    if (navigationInProgressRef.current) return;
    navigationInProgressRef.current = true;

    try {
      const hasCompletedOnboarding = await OnboardingStorageService.hasCompletedOnboarding();

      if (!isMountedRef.current) return;

      const currentSegment = segments[0];
      const inAuthGroup = currentSegment === "auth";
      const inOnboardingGroup = currentSegment === "onboarding";

      if (!hasCompletedOnboarding && !inOnboardingGroup) {
        router.replace("/onboarding");
      } else if (hasCompletedOnboarding && inOnboardingGroup) {
        router.replace("/(tabs)");
      } else if (isAuthenticated && inAuthGroup) {
        router.replace("/(tabs)");
      }

      if (isMountedRef.current) {
        setIsReady(true);
      }
    } finally {
      navigationInProgressRef.current = false;
    }
  }, [segments, isAuthenticated, router]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!authLoading) {
      handleNavigation();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [authLoading, handleNavigation]);

  if (authLoading || !isReady) {
    return (
      <View className="flex-1 items-center justify-center bg-surface dark:bg-surface-dark">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

function SyncAuthSetup({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { setAuthContext } = useSync();
  const hasSetAuthRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (user?.id && !hasSetAuthRef.current) {
      // Use householdId if available, otherwise fall back to userId for single-user mode
      const householdId = user.householdId || user.id;
      setAuthContext(householdId, user.id);
      hasSetAuthRef.current = true;
      lastUserIdRef.current = user.id;
    }

    // Reset if user changes or logs out
    if (!user?.id || (lastUserIdRef.current && lastUserIdRef.current !== user.id)) {
      hasSetAuthRef.current = false;
      lastUserIdRef.current = null;
    }
  }, [user?.id, user?.householdId, setAuthContext]);

  return <>{children}</>;
}

function OfflineBannerWrapper() {
  const { status, pendingCount } = useSync();
  const [isDismissed, setIsDismissed] = useState(false);
  const [prevStatus, setPrevStatus] = useState(status);
  const isOffline = status === "offline";

  // Reset dismissed state when status changes (React recommended pattern)
  if (status !== prevStatus) {
    setPrevStatus(status);
    if (!isOffline) {
      setIsDismissed(false);
    }
  }

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
          name="onboarding"
          options={{
            animation: "fade",
          }}
        />
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
              <SyncAuthSetup>
              <UnitProvider>
                <BabyProvider>
                  <FeedingProvider>
                    <SleepProvider>
                      <DiaperProvider>
                        <PumpingProvider>
                          <GrowthProvider>
                            <TummyTimeProvider>
                              <NotificationProvider>
                                <DashboardConfigProvider>
                                  <AppContent />
                                </DashboardConfigProvider>
                              </NotificationProvider>
                            </TummyTimeProvider>
                          </GrowthProvider>
                        </PumpingProvider>
                      </DiaperProvider>
                    </SleepProvider>
                  </FeedingProvider>
                </BabyProvider>
              </UnitProvider>
              </SyncAuthSetup>
            </SyncProvider>
          </HouseholdProvider>
        </AuthGuard>
      </AuthProvider>
    </ThemeProvider>
  );
}
