import "../global.css";
import "../src/i18n";
import { useEffect, useState, useRef } from "react";
import { View, ActivityIndicator, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";
import { AuthProvider, BabyProvider, FeedingProvider, SleepProvider, DiaperProvider, PumpingProvider, GrowthProvider, TummyTimeProvider, MilestonesProvider, ThemeProvider, UnitProvider, TimeFormatProvider, DashboardConfigProvider, HouseholdProvider, SyncProvider, NotificationProvider, LanguageProvider, ActiveTimersProvider, WidgetProvider, HealthProvider, useTheme, useAuth, useNotifications, useWidget } from "@/contexts";
import { AchievementProvider } from "@/contexts/achievement-context";
import { SyncAuthGate } from "@/components/SyncAuthGate";
import { ReturningUserProfileFallback } from "@/components/ReturningUserProfileFallback";
import { AuthScopeBoundary } from "@/components/AuthScopeBoundary";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";
import { seedLegacyOnboardingFixture } from "@/services/e2e-onboarding-fixture";
import { LanguageStorageService } from "@/services/language-storage";
import {
  getOnboardingRedirect,
  shouldStartReturningRestoration,
} from "@/services/onboarding-guard";
import { useWidgetStopHandler } from "@/hooks/useWidgetStopHandler";
import { useWidgetPauseHandler } from "@/hooks/useWidgetPauseHandler";
import { useGlobalTimerAlerts } from "@/hooks/useGlobalTimerAlerts";
import { useStoreReview } from "@/hooks/useStoreReview";
import { useWatchMessageHandler } from "@/hooks/useWatchMessageHandler";
import { startWatchMessageListening } from "@/services/watch-service";
import {
  appendExternalTimerCommand,
  createRoutedExternalTimerCommand,
} from "@/services/external-timer-command-service";
import { supabase } from "@/services/supabase";
import { SURFACE } from "@/constants/colors";
SplashScreen.preventAutoHideAsync().catch(() => {});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;

    const handleNavigation = async () => {
      const routeSegments = segments as readonly string[];
      if (routeSegments[0] === "login-callback") {
        if (isMountedRef.current) setIsReady(true);
        return;
      }

      await seedLegacyOnboardingFixture(__DEV__);
      const language = await LanguageStorageService.getLanguagePreference();
      let state = await NewOwnerOnboardingStorageService.getState(language);
      if (!isMountedRef.current) return;

      if (shouldStartReturningRestoration(state, isAuthenticated)) {
        await NewOwnerOnboardingStorageService.beginReturningAuthentication(language);
        await NewOwnerOnboardingStorageService.beginReturningRestoration();
        state = await NewOwnerOnboardingStorageService.getState(language);
        if (!isMountedRef.current) return;
      }

      const redirect = getOnboardingRedirect(state, routeSegments);
      const waitingForDisplayName = routeSegments[0] === "auth" &&
        redirect === "/(tabs)" &&
        !user?.displayName;
      if (redirect && !waitingForDisplayName) {
        router.replace(redirect);
      }

      if (isMountedRef.current) setIsReady(true);
    };

    handleNavigation();
  }, [authLoading, isAuthenticated, segments, router, user?.displayName]);

  if (authLoading || !isReady) {
    return (
      <View className="flex-1 items-center justify-center bg-surface dark:bg-surface-dark">
        <ActivityIndicator size="large" />
      </View>
    );
  }

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

function WidgetPauseHandler({ children }: { children: React.ReactNode }) {
  useWidgetPauseHandler();
  return <>{children}</>;
}

function GlobalTimerAlertWatcher({ children }: { children: React.ReactNode }) {
  useGlobalTimerAlerts();
  return <>{children}</>;
}

function StoreReviewHandler({ children }: { children: React.ReactNode }) {
  useStoreReview();
  return <>{children}</>;
}

function WatchMessageHandler({ children }: { children: React.ReactNode }) {
  const { getWidgetDataJson } = useWidget();
  const { registerHandler } = useWatchMessageHandler({
    onRequestSync: (replyHandler) => {
      const json = getWidgetDataJson();
      if (replyHandler && json) {
        replyHandler({ widgetData: json });
      }
    },
  });

  useEffect(() => {
    const unregister = registerHandler();
    let unsubscribeListening: (() => void) | null = null;

    startWatchMessageListening().then((unsub) => {
      unsubscribeListening = unsub;
    });

    return () => {
      unregister();
      unsubscribeListening?.();
    };
  }, [registerHandler]);

  return <>{children}</>;
}

function DeepLinkHandler({ children }: { children: React.ReactNode }) {
  const hasHandledInitialUrl = useRef(false);

  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      const widgetActivities = ["feeding", "sleep", "diaper", "pumping", "growth", "tummyTime"];
      for (const activity of widgetActivities) {
        if (!url.includes(`sofibaby://${activity}`)) continue;
        console.log("[DeepLink] Widget link detected:", activity);
        const command = createRoutedExternalTimerCommand(
          url,
          new Date().toISOString()
        );
        if (command) await appendExternalTimerCommand(command);
        return;
      }

      if (url.includes("login-callback") || url.includes("auth/callback")) {
        try {
          const hashIndex = url.indexOf('#');
          const queryIndex = url.indexOf('?');

          let params = new URLSearchParams();

          if (hashIndex !== -1) {
            const hashParams = url.substring(hashIndex + 1);
            params = new URLSearchParams(hashParams);
          }

          if (queryIndex !== -1) {
            const endIndex = hashIndex !== -1 ? hashIndex : url.length;
            const queryParams = new URLSearchParams(url.substring(queryIndex + 1, endIndex));
            queryParams.forEach((value, key) => {
              if (!params.has(key)) params.set(key, value);
            });
          }

          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          const tokenHash = params.get('token_hash');
          const type = params.get('type');
          const code = params.get('code');

          // PKCE flow: exchange code for session
          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) console.error("[DeepLink] Authentication failed");
            return;
          }

          // Implicit flow: set session directly
          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) console.error("[DeepLink] Authentication failed");
            return;
          }

          // OTP verification
          if (tokenHash && type) {
            const { error } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: type as 'email' | 'magiclink',
            });
            if (error) console.error("[DeepLink] Authentication failed");
            return;
          }

          await supabase.auth.getSession();
        } catch {
          console.error("[DeepLink] Authentication failed");
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
        <Stack.Screen name="health" options={modalOptions} />
        <Stack.Screen name="milestones" options={modalOptions} />
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
                <SyncAuthGate blockedFallback={<ReturningUserProfileFallback />}>
                <UnitProvider>
                <TimeFormatProvider>
                <DashboardConfigProvider>
                  <BabyProvider>
                    <AuthScopeBoundary>
                    <ActiveTimersProvider>
                    <FeedingProvider>
                      <SleepProvider>
                        <DiaperProvider>
                          <PumpingProvider>
                            <GrowthProvider>
                              <TummyTimeProvider>
                              <MilestonesProvider>
                              <HealthProvider>
                              <AchievementProvider>
                                <WidgetProvider>
                                <NotificationProvider>
                                  <NotificationAuthSetup>
                                      <DisplayNamePromptWrapper>
                                        <WidgetStopHandler>
                                        <WidgetPauseHandler>
                                        <WatchMessageHandler>
                                        <GlobalTimerAlertWatcher>
                                        <StoreReviewHandler>
                                          <AppContent />
                                        </StoreReviewHandler>
                                        </GlobalTimerAlertWatcher>
                                        </WatchMessageHandler>
                                        </WidgetPauseHandler>
                                        </WidgetStopHandler>
                                      </DisplayNamePromptWrapper>
                                  </NotificationAuthSetup>
                                </NotificationProvider>
                                </WidgetProvider>
                              </AchievementProvider>
                              </HealthProvider>
                              </MilestonesProvider>
                              </TummyTimeProvider>
                            </GrowthProvider>
                          </PumpingProvider>
                        </DiaperProvider>
                      </SleepProvider>
                    </FeedingProvider>
                    </ActiveTimersProvider>
                    </AuthScopeBoundary>
                  </BabyProvider>
                </DashboardConfigProvider>
                </TimeFormatProvider>
                </UnitProvider>
                </SyncAuthGate>
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
