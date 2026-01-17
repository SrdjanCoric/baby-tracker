import { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  useColorScheme,
  ScrollView,
} from "react-native";
import { useBaby } from "@/contexts";
import { calculateBabyAge } from "@/validators/baby";

interface BabySelectorProps {
  onAddBaby?: () => void;
}

function BabySelector({ onAddBaby }: BabySelectorProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [isOpen, setIsOpen] = useState(false);

  const { babies, selectedBaby, selectBaby, isLoading } = useBaby();

  const handleSelect = useCallback(
    async (babyId: string) => {
      await selectBaby(babyId);
      setIsOpen(false);
    },
    [selectBaby]
  );

  const handleAddBaby = useCallback(() => {
    setIsOpen(false);
    onAddBaby?.();
  }, [onAddBaby]);

  if (isLoading) {
    return (
      <View className="flex-row items-center">
        <View className={`w-10 h-10 rounded-full ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
        <View className="ml-3">
          <View className={`w-20 h-4 rounded ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
        </View>
      </View>
    );
  }

  if (!selectedBaby) {
    return (
      <Pressable
        onPress={onAddBaby}
        className={`
          flex-row items-center px-4 py-3 rounded-2xl
          ${isDark ? "bg-surface-dark-card" : "bg-white"}
        `}
        accessibilityLabel="Add your first baby"
      >
        <View
          className={`
            w-10 h-10 rounded-full items-center justify-center
            ${isDark ? "bg-action-dark-primary/20" : "bg-action-primary/10"}
          `}
        >
          <Text className="text-xl">➕</Text>
        </View>
        <Text
          className={`ml-3 text-base font-medium ${
            isDark ? "text-action-dark-primary" : "text-action-primary"
          }`}
        >
          Add Baby
        </Text>
      </Pressable>
    );
  }

  const babyAge = selectedBaby.birthDate
    ? calculateBabyAge(new Date(selectedBaby.birthDate))
    : undefined;

  return (
    <>
      <Pressable
        onPress={() => setIsOpen(true)}
        className={`
          flex-row items-center min-h-[48px]
        `}
        accessibilityLabel={`Selected baby: ${selectedBaby.name}. Tap to switch babies.`}
        accessibilityHint="Opens baby selector"
      >
        <View
          className={`
            w-10 h-10 rounded-full items-center justify-center
            ${isDark ? "bg-surface-dark-card" : "bg-gray-100"}
          `}
        >
          <Text className="text-xl">👶</Text>
        </View>
        <View className="ml-3 flex-1">
          <Text
            className={`text-base font-semibold ${
              isDark ? "text-content-dark-primary" : "text-content-primary"
            }`}
            numberOfLines={1}
          >
            {selectedBaby.name}
          </Text>
          {babyAge && (
            <Text
              className={`text-sm ${
                isDark ? "text-content-dark-secondary" : "text-content-secondary"
              }`}
            >
              {babyAge}
            </Text>
          )}
        </View>
        {babies.length > 1 && (
          <Text
            className={`text-lg ${isDark ? "text-content-dark-tertiary" : "text-content-tertiary"}`}
          >
            ▾
          </Text>
        )}
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setIsOpen(false)}
        >
          <Pressable
            className={`
              rounded-t-3xl p-6 pb-10
              ${isDark ? "bg-surface-dark" : "bg-surface"}
            `}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="items-center mb-4">
              <View className={`w-10 h-1 rounded-full ${isDark ? "bg-gray-700" : "bg-gray-300"}`} />
            </View>

            <Text
              className={`text-lg font-semibold mb-4 ${
                isDark ? "text-content-dark-primary" : "text-content-primary"
              }`}
            >
              Select Baby
            </Text>

            <ScrollView className="max-h-80">
              {babies.map((baby) => {
                const isSelected = baby.id === selectedBaby.id;
                const age = baby.birthDate
                  ? calculateBabyAge(new Date(baby.birthDate))
                  : undefined;

                return (
                  <Pressable
                    key={baby.id}
                    onPress={() => handleSelect(baby.id)}
                    className={`
                      flex-row items-center p-4 rounded-2xl mb-2
                      ${
                        isSelected
                          ? isDark
                            ? "bg-action-dark-primary/20"
                            : "bg-action-primary/10"
                          : isDark
                            ? "bg-surface-dark-card"
                            : "bg-white"
                      }
                    `}
                    accessibilityLabel={baby.name}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View
                      className={`
                        w-12 h-12 rounded-full items-center justify-center
                        ${isDark ? "bg-surface-dark-secondary" : "bg-gray-100"}
                      `}
                    >
                      <Text className="text-2xl">👶</Text>
                    </View>
                    <View className="ml-4 flex-1">
                      <Text
                        className={`text-base font-semibold ${
                          isDark ? "text-content-dark-primary" : "text-content-primary"
                        }`}
                      >
                        {baby.name}
                      </Text>
                      {age && (
                        <Text
                          className={`text-sm ${
                            isDark ? "text-content-dark-secondary" : "text-content-secondary"
                          }`}
                        >
                          {age}
                        </Text>
                      )}
                    </View>
                    {isSelected && (
                      <Text className="text-xl">✓</Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              onPress={handleAddBaby}
              className={`
                flex-row items-center justify-center p-4 mt-4 rounded-2xl border-2 border-dashed
                ${isDark ? "border-gray-700" : "border-gray-200"}
              `}
              accessibilityLabel="Add another baby"
            >
              <Text className="text-xl mr-2">➕</Text>
              <Text
                className={`text-base font-medium ${
                  isDark ? "text-content-dark-secondary" : "text-content-secondary"
                }`}
              >
                Add Another Baby
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export { BabySelector, type BabySelectorProps };
