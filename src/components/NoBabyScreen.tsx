import { Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

export function NoBabyScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark items-center justify-center">
      <Text className="text-4xl mb-4">👶</Text>
      <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary mb-2">
        {t("baby.addFirstBaby")}
      </Text>
      <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-6 text-center px-8">
        {t("common.noBabySelected")}
      </Text>
      <Pressable
        onPress={() => router.replace("/baby/add")}
        className="bg-action-primary dark:bg-action-dark-primary px-6 py-3 rounded-button min-h-touch items-center justify-center active:opacity-80"
      >
        <Text className="text-white font-semibold text-base text-center">
          {t("baby.addBaby")}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
