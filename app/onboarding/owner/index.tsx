import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useLanguage, type LanguageCode } from "@/contexts";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";
import { ACTION, SURFACE, TEXT } from "@/constants/colors";
import { Button } from "@/components/Button";
import { OnboardingScreen } from "@/components/onboarding/OnboardingScreen";
import { useColorScheme } from "nativewind";

const LANGUAGE_OPTIONS = [
  { value: "system", labelKey: "settings.systemDefault" },
  { value: "en", labelKey: "settings.english" },
  { value: "sr", labelKey: "settings.serbian" },
  { value: "es", labelKey: "settings.spanishLatam" },
  { value: "es-ES", labelKey: "settings.spanishSpain" },
  { value: "fr", labelKey: "settings.french" },
  { value: "pt-PT", labelKey: "settings.portuguesePT" },
  { value: "pt-BR", labelKey: "settings.portugueseBR" },
  { value: "de", labelKey: "settings.german" },
  { value: "it", labelKey: "settings.italian" },
] as const satisfies ReadonlyArray<{ value: LanguageCode; labelKey: string }>;

export default function NewOwnerWelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [showLanguages, setShowLanguages] = useState(false);
  const currentLanguage = LANGUAGE_OPTIONS.find(option => option.value === language) ?? LANGUAGE_OPTIONS[0];

  const handleLanguage = useCallback(async (nextLanguage: LanguageCode) => {
    await setLanguage(nextLanguage);
    await NewOwnerOnboardingStorageService.updateLanguage(nextLanguage);
    setShowLanguages(false);
  }, [setLanguage]);

  const handleStart = useCallback(async () => {
    await NewOwnerOnboardingStorageService.beginOwnerPath(language);
    router.push("/onboarding/owner/account");
  }, [language, router]);

  const handleJoin = useCallback(async () => {
    await NewOwnerOnboardingStorageService.beginCaregiverPath(language);
    router.push("/onboarding/owner/join");
  }, [language, router]);

  const handleSignIn = useCallback(async () => {
    await NewOwnerOnboardingStorageService.beginReturningAuthentication(language);
    router.push("/auth/sign-in?onboardingIntent=returning-user");
  }, [language, router]);

  const languageSelector = (
    <View className="items-end mb-5">
      <Button
        variant="secondary"
        size="default"
        wrapText
        onPress={() => setShowLanguages(value => !value)}
        accessibilityLabel={t("newOwnerOnboarding.welcome.language", {
          language: t(currentLanguage.labelKey),
        })}
        accessibilityState={{ expanded: showLanguages }}
        testID="current-language-button"
        className="w-auto"
      >
        {`🌐 ${t(currentLanguage.labelKey)}`}
      </Button>
    </View>
  );

  return (
    <OnboardingScreen
      testID="new-owner-welcome-screen"
      title={t("newOwnerOnboarding.welcome.title")}
      description={t("newOwnerOnboarding.welcome.promise")}
      headerAccessory={languageSelector}
      contentClassName="gap-3"
    >
      {showLanguages && (
        <View
          className="rounded-card p-2 mb-3"
          style={{ backgroundColor: isDark ? SURFACE.dark.secondary : SURFACE.light.secondary }}
        >
          {LANGUAGE_OPTIONS.map(option => (
            <Pressable
              key={option.value}
              onPress={() => handleLanguage(option.value)}
              className="flex-row items-center justify-between px-4 py-3 rounded-lg"
              accessibilityRole="radio"
              accessibilityState={{ selected: option.value === language }}
              testID={`welcome-language-${option.value}`}
            >
              <Text className="flex-1" style={{ color: isDark ? TEXT.dark.primary : TEXT.light.primary }}>
                {t(option.labelKey)}
              </Text>
              {option.value === language && (
                <Text style={{ color: isDark ? ACTION.dark.primary : ACTION.light.primary }}>✓</Text>
              )}
            </Pressable>
          ))}
        </View>
      )}
      <Button wrapText size="large" onPress={handleStart} testID="start-tracking-button">
        {t("newOwnerOnboarding.welcome.startTracking")}
      </Button>
      <Button wrapText variant="secondary" onPress={handleJoin} testID="join-family-button">
        {t("newOwnerOnboarding.welcome.joinFamily")}
      </Button>
      <Button wrapText variant="ghost" onPress={handleSignIn} testID="sign-in-button">
        {t("newOwnerOnboarding.welcome.signIn")}
      </Button>
    </OnboardingScreen>
  );
}
