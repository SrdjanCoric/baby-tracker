import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const changeText = t('offline.changesPending', { count: pendingCount });

  return (
    <Animated.View
      entering={SlideInUp.duration(300)}
      exiting={SlideOutUp.duration(200)}
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="bg-orange-500 px-4 pb-3 flex-row items-center justify-between"
      style={{ paddingTop: insets.top + 12 }}
    >
      <View className="flex-1">
        <Text className="text-white font-semibold text-base">
          {t('offline.title')}
        </Text>
        {pendingCount > 0 && (
          <Text className="text-orange-100 text-sm mt-0.5">
            {t('offline.willSyncWhenConnected', { changes: changeText })}
          </Text>
        )}
      </View>

      {onDismiss && (
        <Pressable
          testID={`${testID}-dismiss`}
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={t('offline.dismissBanner')}
          className="ml-3 p-2"
        >
          <Text className="text-white text-lg font-bold">×</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}
