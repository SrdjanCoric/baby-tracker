import { ActivityIndicator, Text, View } from "react-native";
import { useTheme } from "@/contexts/theme-context";
import { getActionColor } from "@/constants/design-tokens";

interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
  testID?: string;
}

export function LoadingState({
  message,
  fullScreen = false,
  testID,
}: LoadingStateProps) {
  const { isDark } = useTheme();
  const spinnerColor = getActionColor("primary", isDark);

  return (
    <View
      testID={testID}
      className={`items-center justify-center ${fullScreen ? "flex-1" : "py-8"}`}
    >
      <ActivityIndicator size="large" color={spinnerColor} />
      {message && (
        <Text className="mt-4 text-content-secondary dark:text-content-dark-secondary text-center">
          {message}
        </Text>
      )}
    </View>
  );
}
