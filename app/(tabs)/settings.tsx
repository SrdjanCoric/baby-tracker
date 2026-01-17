import { useTranslation } from "react-i18next";
import { Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type SettingsRowProps = {
  icon: string;
  label: string;
  onPress?: () => void;
};

function SettingsRow({ icon, label, onPress }: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center py-4 px-4 border-b border-gray-100"
    >
      <Text className="text-xl mr-3">{icon}</Text>
      <Text className="flex-1 text-base text-gray-800">{label}</Text>
      <Text className="text-gray-400">{"\u{203A}"}</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <View className="flex-1">
        <View className="bg-white mt-4 rounded-lg mx-4">
          <SettingsRow icon={"\u{1F476}"} label={t("baby.title")} />
          <SettingsRow icon={"\u{1F3E0}"} label={t("household.title")} />
        </View>

        <View className="bg-white mt-4 rounded-lg mx-4">
          <SettingsRow icon={"\u{1F4CF}"} label={t("settings.units")} />
          <SettingsRow icon={"\u{1F3A8}"} label={t("settings.theme")} />
          <SettingsRow icon={"\u{1F514}"} label={t("settings.notifications")} />
        </View>

        <View className="bg-white mt-4 rounded-lg mx-4">
          <SettingsRow icon={"\u{1F4E4}"} label={t("settings.export")} />
        </View>

        <View className="bg-white mt-4 rounded-lg mx-4">
          <SettingsRow icon={"\u{2139}"} label={t("settings.about")} />
          <SettingsRow icon={"\u{1F512}"} label={t("settings.privacyPolicy")} />
        </View>

        <View className="items-center mt-6">
          <Text className="text-gray-400 text-sm">
            {t("settings.version")} 0.1.0
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
