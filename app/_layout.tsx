import "../global.css";
import "../src/i18n";
import { useEffect, useState, useRef, useCallback } from "react";
import { View, ActivityIndicator, Platform, AppState, AppStateStatus } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";
import { AuthProvider, BabyProvider, FeedingProvider, SleepProvider, DiaperProvider, PumpingProvider, GrowthProvider, TummyTimeProvider, ThemeProvider, UnitProvider, HouseholdProvider, SyncProvider, NotificationProvider, DashboardConfigProvider, LanguageProvider, ActiveTimersProvider, WidgetProvider, useTheme, useAuth, useSync, useNotifications, useWidget } from "@/contexts";
import { OfflineBanner } from "@/components/OfflineBanner";
import { DisplayNamePrompt } from "@/components/DisplayNamePrompt";
import { OnboardingStorageService } from "@/services/onboarding-storage";
import { useWidgetStopHandler } from "@/hooks/useWidgetStopHandler";
import { supabase } from "@/services/supabase";
import { SURFACE } from "@/constants/colors";
SplashScreen.preventAutoHideAsync().catch(() => {});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);
  const isMountedRef = useRef(true);
  const lastAuthStateRef = useRef<boolean | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;

    const handleNavigation = async () => {
      const hasCompletedOnboarding = await OnboardingStorageService.hasCompletedOnboarding();

      if (!isMountedRef.current) return;

      const currentSegment = segments[0];
      const inAuthGroup = currentSegment === "auth";
      const inOnboardingGroup = currentSegment === "onboarding";
      const isAuthCallback = currentSegment === "login-callback";

      // Skip navigation logic for login-callback route - it handles its own navigation
      if (isAuthCallback) {
        if (isMountedRef.current) {
          setIsReady(true);
        }
        return;
      }

      if (!hasCompletedOnboarding && !inOnboardingGroup && !inAuthGroup) {
        router.replace("/onboarding");
      } else if (hasCompletedOnboarding && inOnboardingGroup) {
        router.replace("/(tabs)");
      } else if (isAuthenticated && inAuthGroup && hasCompletedOnboarding) {
        // Only redirect to tabs if onboarding is complete AND user has a display name
        // If no display name, stay on auth screen to show the display name prompt
        if (user?.displayName) {
          router.replace("/(tabs)");
        }
        // If no displayName, stay on auth screen - sign-in.tsx will show DisplayNamePrompt
      }

      lastAuthStateRef.current = isAuthenticated;

      if (isMountedRef.current) {
        setIsReady(true);
      }
    };

    handleNavigation();
  }, [authLoading, isAuthenticated, segments, router]);

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
  const lastHouseholdIdRef = useRef<string | null>(null);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      const householdId = user.householdId || user.id;

      if (lastUserIdRef.current !== user.id || lastHouseholdIdRef.current !== householdId) {
        setAuthContext(householdId, user.id);
        lastUserIdRef.current = user.id;
        lastHouseholdIdRef.current = householdId;
      }
    } else {
      lastUserIdRef.current = null;
      lastHouseholdIdRef.current = null;
    }
  }, [user?.id, user?.householdId, setAuthContext]);

  return <>{children}</>;
}

function NotificationAuthSetup({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { registerPushTokenForUser } = useNotifications();
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (userId !== lastUserIdRef.current) {
      lastUserIdRef.current = userId;
      registerPushTokenForUser(userId);
    }
  }, [user?.id, registerPushTokenForUser]);

  return <>{children}</>;
}

function DisplayNamePromptWrapper({ children }: { children: React.ReactNode }) {
  // DisplayNamePrompt is now handled in sign-in.tsx after authentication
  // This wrapper is disabled to avoid modal rendering issues during navigation
  return <>{children}</>;
}

function WidgetStopHandler({ children }: { children: React.ReactNode }) {
  useWidgetStopHandler();
  return <>{children}</>;
}

function DeepLinkHandler({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hasHandledInitialUrl = useRef(false);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background') {
        if (router.canDismiss()) {
          router.dismissAll();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [router]);

  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      console.log("[DeepLink] Received URL:", url);

      // Widget deep links (sofibaby://feeding, etc.) - Expo Router handles automatically
      const widgetActivities = ["feeding", "sleep", "diaper", "pumping", "growth", "tummyTime"];
      for (const activity of widgetActivities) {
        if (url.includes(`sofibaby://${activity}`)) {
          console.log("[DeepLink] Widget link detected:", activity);
          return;
        }
      }

      if (url.includes("login-callback") || url.includes("auth/callback")) {
        try {
          const hashIndex = url.indexOf('#');
          const queryIndex = url.indexOf('?');

          console.log("[DeepLink] Hash index:", hashIndex, "Query index:", queryIndex);

          let params = new URLSearchParams();

          if (hashIndex !== -1) {
            const hashParams = url.substring(hashIndex + 1);
            console.log("[DeepLink] Hash params:", hashParams);
            params = new URLSearchParams(hashParams);
          }

          if (queryIndex !== -1) {
            const endIndex = hashIndex !== -1 ? hashIndex : url.length;
            const queryParams = new URLSearchParams(url.substring(queryIndex + 1, endIndex));
            console.log("[DeepLink] Query params:", url.substring(queryIndex + 1, endIndex));
            queryParams.forEach((value, key) => {
              if (!params.has(key)) params.set(key, value);
            });
          }

          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          const tokenHash = params.get('token_hash');
          const type = params.get('type');
          const code = params.get('code');

          console.log("[DeepLink] Params found:", {
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshToken,
            hasTokenHash: !!tokenHash,
            hasCode: !!code,
            type,
          });

          // PKCE flow: exchange code for session
          if (code) {
            console.log("[DeepLink] Exchanging PKCE code for session...");
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
              console.error("[DeepLink] exchangeCodeForSession error:", error);
            } else {
              console.log("[DeepLink] PKCE code exchanged successfully");
            }
            return;
          }

          // Implicit flow: set session directly
          if (accessToken && refreshToken) {
            console.log("[DeepLink] Setting session with tokens...");
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) {
              console.error("[DeepLink] setSession error:", error);
            } else {
              console.log("[DeepLink] Session set successfully");
            }
            return;
          }

          // OTP verification
          if (tokenHash && type) {
            console.log("[DeepLink] Verifying OTP...");
            const { error } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: type as 'email' | 'magiclink',
            });
            if (error) {
              console.error("[DeepLink] verifyOtp error:", error);
            } else {
              console.log("[DeepLink] OTP verified successfully");
            }
            return;
          }

          console.log("[DeepLink] No auth params found, trying getSession...");
          await supabase.auth.getSession();
        } catch (error) {
          console.error("[DeepLink] Error:", error);
        }
      }
    };

    const subscription = Linking.addEventListener("url", async ({ url }) => {
      await handleDeepLink(url);
    });

    if (!hasHandledInitialUrl.current) {
      hasHandledInitialUrl.current = true;
      Linking.getInitialURL().then(async (url) => {
        if (url) {
          await handleDeepLink(url);
        }
      });
    }

    return () => subscription?.remove();
  }, []);

  return <>{children}</>;
}

function OfflineBannerWrapper() {
  const { status, pendingCount } = useSync();
  const { isAuthenticated } = useAuth();
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

  // Don't show offline banner if user is not logged in
  if (!isAuthenticated || !isOffline || isDismissed) {
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

  // Android uses simpler animations to avoid glitches
  const modalOptions = Platform.OS === "android"
    ? { animation: "slide_from_right" as const }
    : { presentation: "modal" as const, animation: "slide_from_bottom" as const };

  const bgColor = isDark ? SURFACE.dark.background : SURFACE.light.background;

  return (
    <View className="flex-1" style={{ backgroundColor: bgColor }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: bgColor },
          animation: Platform.OS === "android" ? "slide_from_right" : "default",
        }}
      >
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
            ...modalOptions,
            gestureEnabled: Platform.OS === "ios",
            gestureDirection: "vertical",
          }}
        />
        <Stack.Screen name="baby" options={modalOptions} />
        <Stack.Screen name="feeding" options={modalOptions} />
        <Stack.Screen name="sleep" options={modalOptions} />
        <Stack.Screen name="diaper" options={modalOptions} />
        <Stack.Screen name="pumping" options={modalOptions} />
        <Stack.Screen name="growth" options={modalOptions} />
        <Stack.Screen name="tummyTime" options={modalOptions} />
        <Stack.Screen name="settings" options={modalOptions} />
        <Stack.Screen name="edit" options={modalOptions} />
      </Stack>
      <StatusBar style={isDark ? "light" : "dark"} />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Nunito-Regular': require('../assets/fonts/Nunito-Regular.ttf'),
    'Nunito-Medium': require('../assets/fonts/Nunito-Medium.ttf'),
    'Nunito-SemiBold': require('../assets/fonts/Nunito-SemiBold.ttf'),
    'Nunito-Bold': require('../assets/fonts/Nunito-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
        <AuthProvider>
          <DeepLinkHandler>
          <AuthGuard>
            <SyncProvider>
              <HouseholdProvider>
                <SyncAuthSetup>
                <UnitProvider>
                  <BabyProvider>
                    <FeedingProvider>
                      <SleepProvider>
                        <DiaperProvider>
                          <PumpingProvider>
                            <GrowthProvider>
                              <TummyTimeProvider>
                                <ActiveTimersProvider>
                                <WidgetProvider>
                                <NotificationProvider>
                                  <NotificationAuthSetup>
                                    <DashboardConfigProvider>
                                      <DisplayNamePromptWrapper>
                                        <WidgetStopHandler>
                                          <AppContent />
                                        </WidgetStopHandler>
                                      </DisplayNamePromptWrapper>
                                    </DashboardConfigProvider>
                                  </NotificationAuthSetup>
                                </NotificationProvider>
                                </WidgetProvider>
                                </ActiveTimersProvider>
                              </TummyTimeProvider>
                            </GrowthProvider>
                          </PumpingProvider>
                        </DiaperProvider>
                      </SleepProvider>
                    </FeedingProvider>
                  </BabyProvider>
                </UnitProvider>
                </SyncAuthSetup>
              </HouseholdProvider>
            </SyncProvider>
          </AuthGuard>
          </DeepLinkHandler>
        </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
