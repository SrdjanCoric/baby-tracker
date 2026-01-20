import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Text, View, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

type SettingsRowProps = {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
};

function SettingsRow({ icon, label, value, onPress, showChevron = true }: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center py-4 px-4 border-b border-border-subtle dark:border-border-dark-subtle active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
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

  const handleThemePress = useCallback(() => {
    router.push("/settings/theme");
  }, [router]);

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["bottom"]}>
      <ScrollView className="flex-1">
        <View className="bg-surface-card dark:bg-surface-dark-card mt-4 rounded-lg mx-4 overflow-hidden">
          <SettingsRow
            icon={"\u{1F476}"}
            label={t("baby.title")}
          />
          <SettingsRow
            icon={"\u{1F3E0}"}
            label={t("household.title")}
          />
        </View>

        <View className="bg-surface-card dark:bg-surface-dark-card mt-4 rounded-lg mx-4 overflow-hidden">
          <SettingsRow
            icon={"\u{1F4CF}"}
            label={t("settings.units")}
          />
          <SettingsRow
            icon={"\u{1F3A8}"}
            label={t("settings.theme")}
            onPress={handleThemePress}
          />
          <SettingsRow
            icon={"\u{1F514}"}
            label={t("settings.notifications")}
          />
        </View>

        <View className="bg-surface-card dark:bg-surface-dark-card mt-4 rounded-lg mx-4 overflow-hidden">
          <SettingsRow
            icon={"\u{1F4E4}"}
            label={t("settings.export")}
          />
        </View>

        <View className="bg-surface-card dark:bg-surface-dark-card mt-4 rounded-lg mx-4 overflow-hidden">
          <SettingsRow
            icon={"\u{2139}\u{FE0F}"}
            label={t("settings.about")}
          />
          <SettingsRow
            icon={"\u{1F512}"}
            label={t("settings.privacyPolicy")}
          />
        </View>

        <View className="items-center mt-6 mb-8">
          <Text className="text-content-tertiary dark:text-content-dark-tertiary text-sm">
            {t("settings.version")} 0.1.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
