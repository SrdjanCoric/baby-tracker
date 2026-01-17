import { useCallback, useState } from "react";
import { View, Text, useColorScheme, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { BabyProfileForm, Button, type BabyProfileFormData } from "@/components";
import { useBaby } from "@/contexts";

export default function EditBabyScreen() {
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
      "Delete Baby Profile",
      `Are you sure you want to delete ${baby.name}'s profile? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            await deleteBaby(id);
            router.back();
          },
        },
      ]
    );
  }, [id, baby, deleteBaby]);

  const handleCancel = useCallback(() => {
    router.back();
  }, []);

  if (!baby) {
    return (
      <SafeAreaView
        className={`flex-1 items-center justify-center ${isDark ? "bg-surface-dark" : "bg-surface"}`}
      >
        <Text className={`text-lg ${isDark ? "text-content-dark-secondary" : "text-content-secondary"}`}>
          Baby not found
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
          <Text className="text-red-500 font-semibold">Delete Baby Profile</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
