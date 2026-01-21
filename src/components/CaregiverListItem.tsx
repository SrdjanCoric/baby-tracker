import { View, Text, Pressable } from 'react-native';

interface CaregiverListItemProps {
  id: string;
  name: string;
  email?: string;
  entryCount: number;
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
      accessibilityLabel={`${displayName}${isCurrentUser ? ', you' : ''}${isOwner ? ', household owner' : ''}, ${entryCount} entries logged`}
      className="flex-row items-center py-3 px-4 bg-white border-b border-gray-100"
    >
      <View className="w-10 h-10 rounded-full bg-primary-100 items-center justify-center mr-3">
        <Text className="text-primary-600 font-semibold text-sm">{initials}</Text>
      </View>

      <View className="flex-1 mr-3">
        <View className="flex-row items-center gap-2">
          <Text
            testID={`${testID}-name`}
            numberOfLines={1}
            ellipsizeMode="tail"
            className="text-base font-medium text-gray-900 flex-shrink"
            style={{ maxWidth: 150 }}
          >
            {displayName}
          </Text>

          {isCurrentUser && (
            <View className="bg-primary-100 px-2 py-0.5 rounded">
              <Text className="text-primary-700 text-xs font-medium">You</Text>
            </View>
          )}

          {isOwner && (
            <View className="bg-yellow-100 px-2 py-0.5 rounded">
              <Text className="text-yellow-700 text-xs font-medium">Owner</Text>
            </View>
          )}
        </View>

        {email && name && (
          <Text
            numberOfLines={1}
            className="text-sm text-gray-500 mt-0.5"
          >
            {email}
          </Text>
        )}
      </View>

      <View className="flex-row items-center gap-3">
        <View className="bg-gray-100 rounded-full px-2.5 py-1 min-w-[32px] items-center">
          <Text className="text-gray-600 text-sm font-medium">{entryCount}</Text>
        </View>

        {canRemove && (
          <Pressable
            testID={`${testID}-remove`}
            onPress={handleRemove}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${displayName} from household`}
            className="p-2"
          >
            <Text className="text-red-500 text-lg">×</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
