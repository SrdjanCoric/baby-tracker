import { useCallback, useState } from "react";
import { View, useColorScheme, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { BabyProfileForm, type BabyProfileFormData } from "@/components";
import { useBaby } from "@/contexts";

const isAndroid = Platform.OS === "android";

export default function AddBabyScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { addBaby, selectBaby } = useBaby();
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = useCallback(
    async (data: BabyProfileFormData) => {
      setIsLoading(true);
      try {
        const newBaby = await addBaby({
          name: data.name,
          birthDate: data.birthDate,
          gender: data.gender,
          photoUri: data.photoUri,
        });
        await selectBaby(newBaby.id);
        router.back();
      } catch {
        setIsLoading(false);
      }
    },
    [addBaby, selectBaby]
  );

  const handleCancel = useCallback(() => {
    router.back();
  }, []);

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-surface-dark" : "bg-surface"}`}
      edges={isAndroid ? ["top", "left", "right"] : ["top"]}
    >
      <View className={`${isAndroid ? "px-4 py-2" : "px-6 py-4"} border-b border-gray-200 dark:border-gray-800`}>
        <View className="items-center">
          <View className={`w-10 h-1 rounded-full mb-4 ${isDark ? "bg-gray-700" : "bg-gray-300"}`} />
        </View>
      </View>
      <BabyProfileForm
        onSave={handleSave}
        onCancel={handleCancel}
        isLoading={isLoading}
      />
    </SafeAreaView>
  );
}
