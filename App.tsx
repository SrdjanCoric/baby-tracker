import "./global.css";
import "./src/i18n";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

export default function App() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-lg text-primary-600">
        Baby Tracker - Phase 0 Setup
      </Text>
      <Text className="mt-2 text-gray-500">NativeWind is working!</Text>
      <Text className="mt-2 text-gray-500">
        i18n: {t("navigation.timeline")} | {t("navigation.settings")}
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}
