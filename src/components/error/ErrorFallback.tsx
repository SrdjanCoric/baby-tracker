import { Text, View, Pressable, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import type { ErrorFallbackProps } from "@/types/error";

export function ErrorFallback({
  error,
  resetError,
  errorInfo,
}: ErrorFallbackProps) {
  const { t } = useTranslation();
  const isDev = __DEV__;

  return (
    <View
      testID="error-fallback"
      className="flex-1 bg-surface dark:bg-surface-dark items-center justify-center px-6"
    >
      <Text className="text-6xl mb-4">😔</Text>
      <Text
        className="text-xl font-semibold text-content-primary dark:text-content-dark-primary mb-2 text-center"
        accessibilityRole="header"
      >
        {t("errorFallback.title")}
      </Text>
      <Text className="text-center text-content-secondary dark:text-content-dark-secondary mb-6 max-w-[300px]">
        {t("errorFallback.message")}
      </Text>

      <View className="flex-row gap-3">
        <Pressable
          onPress={resetError}
          testID="error-retry-button"
          className="px-6 py-3 bg-action-primary dark:bg-action-dark-primary rounded-button min-h-touch active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel={t("errorFallback.tryAgain")}
          accessibilityHint={t("errorFallback.tryAgain")}
        >
          <Text className="text-white dark:text-content-dark-inverse font-semibold text-center">
            {t("errorFallback.tryAgain")}
          </Text>
        </Pressable>
      </View>

      {isDev && error && (
        <ScrollView
          className="mt-6 max-h-[200px] w-full"
          testID="error-details"
        >
          <View className="bg-surface-secondary dark:bg-surface-dark-secondary rounded-lg p-4">
            <Text className="text-sm font-mono text-content-secondary dark:text-content-dark-secondary mb-2">
              {error.name}: {error.message}
            </Text>
            {errorInfo?.componentStack && (
              <Text className="text-xs font-mono text-content-tertiary dark:text-content-dark-tertiary">
                {errorInfo.componentStack.slice(0, 500)}
              </Text>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
