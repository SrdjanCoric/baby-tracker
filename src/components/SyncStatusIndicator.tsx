import { Pressable, View, Text, ActivityIndicator } from 'react-native';
import { SyncStatus } from '@/services/sync/types';

interface SyncStatusIndicatorProps {
  status: SyncStatus;
  pendingCount?: number;
  showLabel?: boolean;
  onRetry?: () => void;
  testID?: string;
}

const statusConfig: Record<
  SyncStatus,
  { color: string; bgColor: string; label: string }
> = {
  online: {
    color: 'bg-green-500',
    bgColor: 'bg-green-100',
    label: 'Synced',
  },
  syncing: {
    color: 'bg-blue-500',
    bgColor: 'bg-blue-100',
    label: 'Syncing...',
  },
  offline: {
    color: 'bg-orange-500',
    bgColor: 'bg-orange-100',
    label: 'Offline',
  },
  pending: {
    color: 'bg-yellow-500',
    bgColor: 'bg-yellow-100',
    label: 'Pending',
  },
  error: {
    color: 'bg-red-500',
    bgColor: 'bg-red-100',
    label: 'Sync error',
  },
};

export function SyncStatusIndicator({
  status,
  pendingCount = 0,
  showLabel = false,
  onRetry,
  testID,
}: SyncStatusIndicatorProps) {
  const config = statusConfig[status];
  const isSyncing = status === 'syncing';
  const hasError = status === 'error';
  const hasPending = status === 'pending' && pendingCount > 0;

  const handlePress = () => {
    if (hasError && onRetry) {
      onRetry();
    }
  };

  const accessibilityLabel = hasPending
    ? `Sync status: ${pendingCount} pending changes`
    : `Sync status: ${config.label.toLowerCase()}`;

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={!hasError}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: isSyncing, disabled: !hasError }}
      accessibilityHint={hasError ? 'Tap to retry sync' : undefined}
      className={`flex-row items-center gap-2 px-3 py-2 rounded-full ${config.bgColor}`}
    >
      {isSyncing ? (
        <ActivityIndicator size="small" color="#3b82f6" />
      ) : (
        <View className={`w-3 h-3 rounded-full ${config.color}`} />
      )}

      {hasPending && (
        <View className="bg-yellow-600 rounded-full min-w-[20px] h-5 px-1.5 items-center justify-center">
          <Text className="text-white text-xs font-semibold">{pendingCount}</Text>
        </View>
      )}

      {showLabel && (
        <Text className="text-sm font-medium text-gray-700">{config.label}</Text>
      )}
    </Pressable>
  );
}
