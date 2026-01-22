import { View, Text, TextInput, useColorScheme } from "react-native";
import { useTranslation } from "react-i18next";
import { CONFIRMATION_TEXT } from "@/utils/account-deletion";

interface DeletionConfirmationProps {
  value: string;
  onChangeText: (text: string) => void;
  isValid: boolean;
}

function DeletionConfirmation({
  value,
  onChangeText,
  isValid,
}: DeletionConfirmationProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const showError = value.length > 0 && !isValid;

  return (
    <View className="mb-6">
      <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
        {t("accountDeletion.confirmationTitle")}
      </Text>

      <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-4">
        {t("accountDeletion.confirmationInstruction", {
          confirmText: CONFIRMATION_TEXT,
        })}
      </Text>

      <View
        className={`border-2 rounded-xl px-4 py-3 ${
          showError
            ? "border-red-400 bg-red-50 dark:border-red-500 dark:bg-red-900/20"
            : isValid
              ? "border-green-400 bg-green-50 dark:border-green-500 dark:bg-green-900/20"
              : isDark
                ? "border-gray-700 bg-surface-dark-card"
                : "border-gray-300 bg-white"
        }`}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={CONFIRMATION_TEXT}
          placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          accessibilityLabel={t("accountDeletion.confirmationInputLabel")}
          testID="deletion-confirmation-input"
          className={`text-base ${
            isDark ? "text-content-dark-primary" : "text-content-primary"
          }`}
          style={{ fontSize: 16, paddingVertical: 4 }}
        />
      </View>

      {showError && (
        <Text className="text-sm text-red-600 dark:text-red-400 mt-2">
          {t("accountDeletion.confirmationMismatch")}
        </Text>
      )}

      {isValid && (
        <Text className="text-sm text-green-600 dark:text-green-400 mt-2">
          {t("accountDeletion.confirmationMatch")}
        </Text>
      )}
    </View>
  );
}

export { DeletionConfirmation };
