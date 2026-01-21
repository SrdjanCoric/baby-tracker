import { View, Text, Pressable } from 'react-native';
import Animated, {
  SlideInUp,
  SlideOutUp,
} from 'react-native-reanimated';

interface OfflineBannerProps {
  pendingCount: number;
  onDismiss?: () => void;
  testID?: string;
}

export function OfflineBanner({
  pendingCount,
  onDismiss,
  testID,
}: OfflineBannerProps) {
  const changeText =
    pendingCount === 1
      ? '1 change pending'
      : `${pendingCount} changes pending`;

  return (
    <Animated.View
      entering={SlideInUp.duration(300)}
      exiting={SlideOutUp.duration(200)}
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="bg-orange-500 px-4 py-3 flex-row items-center justify-between"
    >
      <View className="flex-1">
        <Text className="text-white font-semibold text-base">
          You're offline
        </Text>
        {pendingCount > 0 && (
          <Text className="text-orange-100 text-sm mt-0.5">
            {changeText} - will sync when connected
          </Text>
        )}
      </View>

      {onDismiss && (
        <Pressable
          testID={`${testID}-dismiss`}
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss offline banner"
          className="ml-3 p-2"
        >
          <Text className="text-white text-lg font-bold">×</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}
