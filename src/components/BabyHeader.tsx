import { Pressable, Text, View, Image } from "react-native";
import { forwardRef } from "react";

interface BabyHeaderProps {
  babyName?: string;
  babyAge?: string;
  photoUri?: string;
  onBabyPress?: () => void;
  onSettingsPress?: () => void;
  testID?: string;
}

const BabyHeader = forwardRef<View, BabyHeaderProps>(
  (
    {
      babyName = "Add Baby",
      babyAge,
      photoUri,
      onBabyPress,
      onSettingsPress,
      testID,
    },
    ref
  ) => {
    return (
      <View
        ref={ref}
        testID={testID}
        className="flex-row items-center justify-between px-4 py-3"
      >
        {/* Baby info */}
        <Pressable
          onPress={onBabyPress}
          className="flex-row items-center flex-1 active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel={`${babyName}${babyAge ? `, ${babyAge}` : ""}. Tap to change baby.`}
        >
          {/* Avatar */}
          <View className="w-12 h-12 rounded-full bg-activity-feeding-muted items-center justify-center overflow-hidden mr-3">
            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <Text className="text-2xl">👶</Text>
            )}
          </View>

          {/* Name and age */}
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
                {babyName}
              </Text>
              <Text className="ml-1 text-content-tertiary dark:text-content-dark-tertiary">
                ▾
              </Text>
            </View>
            {babyAge && (
              <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
                {babyAge}
              </Text>
            )}
          </View>
        </Pressable>

        {/* Settings button */}
        <Pressable
          onPress={onSettingsPress}
          className="w-11 h-11 rounded-full bg-surface-secondary dark:bg-surface-dark-secondary items-center justify-center active:scale-95"
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <Text className="text-xl">⚙️</Text>
        </Pressable>
      </View>
    );
  }
);

BabyHeader.displayName = "BabyHeader";

export { BabyHeader, type BabyHeaderProps };
