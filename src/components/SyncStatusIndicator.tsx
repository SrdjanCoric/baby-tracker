import { View, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SyncStatus } from '@/services/sync/types';
import type { TFunction } from 'i18next';

interface SyncStatusIndicatorProps {
  status: SyncStatus;
  pendingCount?: number;
  showLabel?: boolean;
  onPress?: () => void;
  testID?: string;
}

function getStatusConfig(t: TFunction): Record<SyncStatus, { color: string; label: string; bgColor: string }> {
  return {
    online: { color: 'bg-green-600', label: t('sync.synced'), bgColor: 'bg-green-100' },
    syncing: { color: 'bg-green-500', label: t('sync.syncing'), bgColor: 'bg-green-50' },
    offline: { color: 'bg-orange-500', label: t('sync.offline'), bgColor: 'bg-orange-100' },
    pending: { color: 'bg-amber-500', label: t('sync.pending'), bgColor: 'bg-amber-100' },
    error: { color: 'bg-red-500', label: t('sync.error'), bgColor: 'bg-red-100' },
  };
}

function SpinnerIcon({ testID }: { testID?: string }) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1000, easing: Easing.linear }),
      -1,
      false
    );

    return () => {
      cancelAnimation(rotation);
    };
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View
      testID={testID}
      style={animatedStyle}
      className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full"
    />
  );
}

export function SyncStatusIndicator({
  status,
  pendingCount = 0,
  showLabel = false,
  onPress,
  testID,
}: SyncStatusIndicatorProps) {
  const { t } = useTranslation();
  const statusConfig = getStatusConfig(t);
  const config = statusConfig[status];
  const isSyncing = status === 'syncing';
  const showPendingBadge = pendingCount > 0 && status !== 'syncing';
  const isError = status === 'error';

  const accessibilityLabel = (() => {
    let label = config.label;
    if (pendingCount > 0) {
      label += `, ${t('sync.pendingChange', { count: pendingCount })}`;
    }
    if (isError) {
      label += `. ${t('sync.tapToRetry')}`;
    }
    return label;
  })();

  const content = (
    <View
      testID={testID}
      accessible={true}
      accessibilityLiveRegion="polite"
      accessibilityLabel={accessibilityLabel}
      className={`flex-row items-center gap-2 px-2 py-1 rounded-full ${showLabel ? config.bgColor : ''}`}
    >
      {isSyncing ? (
        <SpinnerIcon testID={`${testID}-spinner`} />
      ) : (
        <View className="relative">
          <View
            testID={`${testID}-dot`}
            className={`w-2.5 h-2.5 rounded-full ${config.color}`}
          />
          {showPendingBadge && (
            <View
              testID={`${testID}-badge`}
              className="absolute -top-1.5 -right-2 bg-yellow-500 rounded-full min-w-[16px] h-4 items-center justify-center px-1"
            >
              <Text className="text-white text-[10px] font-bold">
                {pendingCount > 99 ? '99+' : pendingCount}
              </Text>
            </View>
          )}
        </View>
      )}

      {showLabel && (
        <Text
          testID={`${testID}-label`}
          className="text-sm font-medium text-gray-700"
        >
          {config.label}
        </Text>
      )}
    </View>
  );

  if (onPress && isError) {
    return (
      <Pressable
        onPress={onPress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}. Tap to retry sync`}
        testID={`${testID}-pressable`}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}
