import { useCallback } from "react";
import { Pressable, Text, View, ScrollView, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import Constants from "expo-constants";

const APP_VERSION = Constants.expoConfig?.version ?? "0.1.0";
const BUILD_NUMBER = Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? "1";

export default function AboutSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handlePrivacyPolicy = useCallback(() => {
    Linking.openURL("https://example.com/privacy");
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <View className="flex-row items-center px-4 py-3 border-b border-border-subtle dark:border-border-dark-subtle">
        <Pressable
          onPress={handleBack}
          className="w-touch h-touch items-center justify-center rounded-full active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <Text className="text-2xl">{"\u{2190}"}</Text>
        </Pressable>
        <View className="flex-1 items-center">
          <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
            {t("settings.about")}
          </Text>
        </View>
        <View className="w-touch" />
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        <View className="items-center mb-8 mt-4">
          <View className="w-24 h-24 rounded-3xl bg-primary/10 dark:bg-primary-dark/10 items-center justify-center mb-4">
            <Text className="text-5xl">{"\u{1F476}"}</Text>
          </View>
          <Text className="text-xl font-bold text-content-primary dark:text-content-dark-primary mb-1">
            Baby Tracker
          </Text>
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
            {t("settings.version")} {APP_VERSION} ({BUILD_NUMBER})
          </Text>
        </View>

        <View className="bg-surface-secondary dark:bg-surface-dark-secondary rounded-card p-4 mb-4">
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary text-center">
            A privacy-first, ad-free baby tracking app designed for sleep-deprived parents.
          </Text>
        </View>

        <View className="bg-surface-card dark:bg-surface-dark-card rounded-card overflow-hidden">
          <Pressable
            onPress={handlePrivacyPolicy}
            className="flex-row items-center py-4 px-4 border-b border-border-subtle dark:border-border-dark-subtle active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
          >
            <Text className="text-xl mr-3">{"\u{1F512}"}</Text>
            <Text className="flex-1 text-base text-content-primary dark:text-content-dark-primary">
              {t("settings.privacyPolicy")}
            </Text>
            <Text className="text-content-tertiary dark:text-content-dark-tertiary">
              {"\u{203A}"}
            </Text>
          </Pressable>
        </View>

        <View className="items-center mt-8">
          <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary">
            Made with {"\u{2764}\u{FE0F}"} for parents everywhere
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
