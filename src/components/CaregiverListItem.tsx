import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTranslation } from '../hooks/useAppTranslation';

interface CaregiverListItemProps {
  id: string;
  name: string;
  email?: string;
  entryCount?: number;
  isOwner: boolean;
  isCurrentUser: boolean;
  canRemove: boolean;
  onRemove?: (id: string) => void;
  testID?: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function CaregiverListItem({
  id,
  name,
  email,
  entryCount,
  isOwner,
  isCurrentUser,
  canRemove,
  onRemove,
  testID,
}: CaregiverListItemProps) {
  const { t } = useAppTranslation();
  const displayName = name || email || 'Unknown';
  const initials = getInitials(displayName);

  const handleRemove = () => {
    if (onRemove) {
      onRemove(id);
    }
  };

  return (
    <View
      testID={testID}
      accessibilityLabel={`${displayName}${isCurrentUser ? ', you' : ''}${isOwner ? ', household owner' : ''}`}
      className="flex-row items-center py-3 px-4 bg-surface-card dark:bg-surface-dark-card"
    >
      <View className="w-10 h-10 rounded-full bg-primary/15 dark:bg-primary-dark/15 items-center justify-center mr-3">
        <Text className="text-primary dark:text-primary-dark font-semibold text-sm">{initials}</Text>
      </View>

      <View className="flex-1 mr-3">
        <View className="flex-row items-center gap-2">
          <Text
            testID={`${testID}-name`}
            numberOfLines={1}
            ellipsizeMode="tail"
            className="text-base font-medium text-content-primary dark:text-content-dark-primary flex-shrink"
            style={{ maxWidth: 180 }}
          >
            {displayName}
          </Text>

          {isCurrentUser && (
            <View className="bg-primary/15 dark:bg-primary-dark/15 px-2 py-0.5 rounded">
              <Text className="text-primary dark:text-primary-dark text-xs font-medium">{t('household.you')}</Text>
            </View>
          )}

          {isOwner && (
            <View className="bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded">
              <Text className="text-amber-700 dark:text-amber-400 text-xs font-medium">{t('household.owner')}</Text>
            </View>
          )}
        </View>

        {email && name && (
          <Text
            numberOfLines={1}
            className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-0.5"
          >
            {email}
          </Text>
        )}
      </View>

      {canRemove && (
        <Pressable
          testID={`${testID}-remove`}
          onPress={handleRemove}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${displayName} from household`}
          className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 items-center justify-center active:bg-red-100 dark:active:bg-red-900/40"
        >
          <Ionicons name="close" size={18} color="#ef4444" />
        </Pressable>
      )}
    </View>
  );
}
