import { useCallback, useState } from "react";
import { View, Text, useColorScheme, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { BabyProfileForm, Button, type BabyProfileFormData } from "@/components";
import { useBaby } from "@/contexts";

export default function EditBabyScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getBabyById, updateBaby, deleteBaby } = useBaby();
  const [isLoading, setIsLoading] = useState(false);

  const baby = id ? getBabyById(id) : undefined;

  const handleSave = useCallback(
    async (data: BabyProfileFormData) => {
      if (!id) return;
      setIsLoading(true);
      try {
        await updateBaby(id, {
          name: data.name,
          birthDate: data.birthDate,
          gender: data.gender,
          photoUri: data.photoUri,
        });
        router.back();
      } catch {
        setIsLoading(false);
      }
    },
    [id, updateBaby]
  );

  const handleDelete = useCallback(() => {
    if (!id || !baby) return;

    Alert.alert(
      t("baby.deleteBabyProfile"),
      t("baby.deleteBabyConfirm", { name: baby.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            const success = await deleteBaby(id);
            if (success) {
              router.back();
            } else {
              setIsLoading(false);
              Alert.alert(
                t("common.error"),
                t("errors.generic")
              );
            }
          },
        },
      ]
    );
  }, [id, baby, deleteBaby, t]);

  const handleCancel = useCallback(() => {
    router.back();
  }, []);

  if (!baby) {
    return (
      <SafeAreaView
        className={`flex-1 items-center justify-center ${isDark ? "bg-surface-dark" : "bg-surface"}`}
      >
        <Text className={`text-lg ${isDark ? "text-content-dark-secondary" : "text-content-secondary"}`}>
          {t("baby.babyNotFound")}
        </Text>
      </SafeAreaView>
    );
  }

  const initialData: BabyProfileFormData = {
    name: baby.name,
    birthDate: baby.birthDate ? new Date(baby.birthDate) : undefined,
    gender: baby.gender,
    photoUri: baby.photoUri,
  };

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-surface-dark" : "bg-surface"}`}
      edges={["top"]}
    >
      <View className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <View className="items-center">
          <View className={`w-10 h-1 rounded-full mb-4 ${isDark ? "bg-gray-700" : "bg-gray-300"}`} />
        </View>
      </View>
      <BabyProfileForm
        initialData={initialData}
        onSave={handleSave}
        onCancel={handleCancel}
        isLoading={isLoading}
      />
      <View className="px-6 pb-6">
        <Button
          variant="ghost"
          onPress={handleDelete}
          disabled={isLoading}
        >
          <Text className="text-red-500 font-semibold">{t("baby.deleteBabyProfile")}</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
