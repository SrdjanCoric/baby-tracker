import { Text, View, Pressable } from "react-native";

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  testID?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
  testID,
}: EmptyStateProps) {
  return (
    <View
      testID={testID}
      className={`items-center justify-center ${compact ? "py-6" : "flex-1 px-6"}`}
    >
      <Text className={`${compact ? "text-4xl mb-3" : "text-6xl mb-4"}`}>
        {icon}
      </Text>
      <Text
        className={`${
          compact ? "text-base" : "text-xl"
        } font-semibold text-content-primary dark:text-content-dark-primary mb-2 text-center`}
      >
        {title}
      </Text>
      {description && (
        <Text className="text-center text-content-secondary dark:text-content-dark-secondary max-w-[280px]">
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          className="mt-4 px-6 py-3 bg-action-primary dark:bg-action-dark-primary rounded-button min-h-touch active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text className="text-white dark:text-content-dark-inverse font-semibold text-center">
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
