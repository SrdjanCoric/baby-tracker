import { Pressable, Text, View, ScrollView, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Constants from "expo-constants";

const APP_VERSION = Constants.expoConfig?.version ?? "0.1.0";
const BUILD_NUMBER = Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? "1";

export default function AboutSettingsScreen() {
  const { t } = useTranslation();

  const handlePrivacyPolicy = () => {
    Linking.openURL("https://srdjancoric.github.io/sofibaby-privacy/");
  };

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <View className="items-center pt-2 pb-3 border-b border-border-subtle dark:border-border-dark-subtle">
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
          {t("settings.about")}
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4">
        <View className="items-center mb-8 mt-4">
          <View className="w-24 h-24 rounded-3xl bg-primary/10 dark:bg-primary-dark/10 items-center justify-center mb-4">
            <Text className="text-5xl">{"\u{1F476}"}</Text>
          </View>
          <Text className="text-xl font-bold text-content-primary dark:text-content-dark-primary mb-1">
            {t("about.appName")}
          </Text>
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
            {t("settings.version")} {APP_VERSION} ({BUILD_NUMBER})
          </Text>
        </View>

        <View className="bg-surface-secondary dark:bg-surface-dark-secondary rounded-card p-4 mb-4">
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary text-center">
            {t("about.description")}
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
            {t("about.madeWith")}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
