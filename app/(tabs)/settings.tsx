import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Text, View, Pressable, ScrollView, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { useUnits, useTheme } from "@/contexts";

const APP_VERSION = Constants.expoConfig?.version ?? "0.1.0";

type SettingsRowProps = {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  isLast?: boolean;
};

function SettingsRow({ icon, label, value, onPress, showChevron = true, isLast = false }: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={`flex-row items-center py-4 px-4 ${!isLast ? "border-b border-border-subtle dark:border-border-dark-subtle" : ""} active:bg-surface-secondary dark:active:bg-surface-dark-secondary`}
    >
      <Text className="text-xl mr-3">{icon}</Text>
      <Text className="flex-1 text-base text-content-primary dark:text-content-dark-primary">
        {label}
      </Text>
      {value && (
        <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mr-2">
          {value}
        </Text>
      )}
      {showChevron && onPress && (
        <Text className="text-content-tertiary dark:text-content-dark-tertiary">
          {"\u{203A}"}
        </Text>
      )}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { unitSystem } = useUnits();
  const { preference } = useTheme();

  const handleBabyPress = useCallback(() => {
    router.push("/baby/add");
  }, [router]);

  const handleUnitsPress = useCallback(() => {
    router.push("/settings/units");
  }, [router]);

  const handleThemePress = useCallback(() => {
    router.push("/settings/theme");
  }, [router]);

  const handleAboutPress = useCallback(() => {
    router.push("/settings/about");
  }, [router]);

  const handlePrivacyPolicyPress = useCallback(() => {
    Linking.openURL("https://example.com/privacy");
  }, []);

  const handleHouseholdPress = useCallback(() => {
    router.push("/settings/household");
  }, [router]);

  const handleNotificationsPress = useCallback(() => {
    router.push("/settings/notifications");
  }, [router]);

  const handleExportPress = useCallback(() => {
    router.push("/settings/export");
  }, [router]);

  const getUnitDisplayValue = () => {
    return unitSystem === "imperial" ? t("settings.imperial") : t("settings.metric");
  };

  const getThemeDisplayValue = () => {
    const themeLabels: Record<string, string> = {
      system: t("settings.systemDefault"),
      light: t("settings.lightMode"),
      dark: t("settings.darkMode"),
      night: t("settings.nightMode"),
    };
    return themeLabels[preference] ?? t("settings.systemDefault");
  };

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["bottom"]}>
      <ScrollView className="flex-1">
        <View className="bg-surface-card dark:bg-surface-dark-card mt-4 rounded-lg mx-4 overflow-hidden">
          <SettingsRow
            icon={"\u{1F476}"}
            label={t("baby.title")}
            onPress={handleBabyPress}
          />
          <SettingsRow
            icon={"\u{1F3E0}"}
            label={t("household.title")}
            onPress={handleHouseholdPress}
            isLast
          />
        </View>

        <View className="bg-surface-card dark:bg-surface-dark-card mt-4 rounded-lg mx-4 overflow-hidden">
          <SettingsRow
            icon={"\u{1F4CF}"}
            label={t("settings.units")}
            value={getUnitDisplayValue()}
            onPress={handleUnitsPress}
          />
          <SettingsRow
            icon={"\u{1F3A8}"}
            label={t("settings.theme")}
            value={getThemeDisplayValue()}
            onPress={handleThemePress}
          />
          <SettingsRow
            icon={"\u{1F514}"}
            label={t("settings.notifications")}
            onPress={handleNotificationsPress}
            isLast
          />
        </View>

        <View className="bg-surface-card dark:bg-surface-dark-card mt-4 rounded-lg mx-4 overflow-hidden">
          <SettingsRow
            icon={"\u{1F4E4}"}
            label={t("settings.export")}
            onPress={handleExportPress}
            isLast
          />
        </View>

        <View className="bg-surface-card dark:bg-surface-dark-card mt-4 rounded-lg mx-4 overflow-hidden">
          <SettingsRow
            icon={"\u{2139}\u{FE0F}"}
            label={t("settings.about")}
            onPress={handleAboutPress}
          />
          <SettingsRow
            icon={"\u{1F512}"}
            label={t("settings.privacyPolicy")}
            onPress={handlePrivacyPolicyPress}
            isLast
          />
        </View>

        <View className="items-center mt-6 mb-8">
          <Text className="text-content-tertiary dark:text-content-dark-tertiary text-sm">
            {t("settings.version")} {APP_VERSION}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
