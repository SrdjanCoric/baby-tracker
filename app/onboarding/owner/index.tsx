import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useLanguage, type LanguageCode } from "@/contexts";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";
import { ACTION, SURFACE, TEXT } from "@/constants/colors";
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

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: isDark ? SURFACE.dark.background : SURFACE.light.background }}
      testID="new-owner-welcome-screen"
    >
      <ScrollView contentContainerClassName="flex-grow px-6 py-8" showsVerticalScrollIndicator={false}>
        <View className="items-end mb-8">
          <Pressable
            onPress={() => setShowLanguages(value => !value)}
            className="rounded-full px-4 py-3 border"
            style={{ borderColor: isDark ? "#4B4743" : "#DDD7D2" }}
            accessibilityRole="button"
            accessibilityLabel={t("newOwnerOnboarding.welcome.language", {
              language: t(currentLanguage.labelKey),
            })}
            accessibilityState={{ expanded: showLanguages }}
            testID="current-language-button"
          >
            <Text style={{ color: isDark ? TEXT.dark.primary : TEXT.light.primary }}>
              🌐 {t(currentLanguage.labelKey)}
            </Text>
          </Pressable>
        </View>

        {showLanguages && (
          <View
            className="rounded-card p-2 mb-6"
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
                <Text style={{ color: isDark ? TEXT.dark.primary : TEXT.light.primary }}>
                  {t(option.labelKey)}
                </Text>
                {option.value === language && <Text style={{ color: ACTION.light.primary }}>✓</Text>}
              </Pressable>
            ))}
          </View>
        )}

        <View className="flex-1 justify-center pb-10">
          <Text
            className="text-4xl font-bold mb-5"
            style={{ color: isDark ? TEXT.dark.primary : TEXT.light.primary }}
          >
            {t("newOwnerOnboarding.welcome.title")}
          </Text>
          <Text
            className="text-lg leading-7"
            style={{ color: isDark ? TEXT.dark.secondary : TEXT.light.secondary }}
          >
            {t("newOwnerOnboarding.welcome.promise")}
          </Text>
        </View>

        <View className="gap-3">
          <Pressable
            onPress={handleStart}
            className="rounded-button-lg py-4 items-center"
            style={{ backgroundColor: isDark ? ACTION.dark.primary : ACTION.light.primary }}
            accessibilityRole="button"
            testID="start-tracking-button"
          >
            <Text className="text-white text-lg font-bold">
              {t("newOwnerOnboarding.welcome.startTracking")}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleJoin}
            className="rounded-button-lg py-4 items-center border"
            style={{ borderColor: isDark ? "#4B4743" : "#DDD7D2" }}
            accessibilityRole="button"
            testID="join-family-button"
          >
            <Text className="text-base font-semibold" style={{ color: isDark ? TEXT.dark.primary : TEXT.light.primary }}>
              {t("newOwnerOnboarding.welcome.joinFamily")}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleSignIn}
            className="py-3 items-center"
            accessibilityRole="button"
            testID="sign-in-button"
          >
            <Text className="text-base font-semibold" style={{ color: isDark ? ACTION.dark.primary : ACTION.light.primary }}>
              {t("newOwnerOnboarding.welcome.signIn")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
