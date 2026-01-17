import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TimelineScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-6xl mb-4">{"\u{1F476}"}</Text>
        <Text className="text-xl font-semibold text-gray-800 mb-2">
          {t("timeline.noEntries")}
        </Text>
        <Text className="text-center text-gray-500">
          {t("timeline.startTracking")}
        </Text>
      </View>
    </SafeAreaView>
  );
}
