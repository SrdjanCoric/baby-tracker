import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useAuth, useTheme } from "@/contexts";
import { SURFACE, TEXT, ACTION, BORDER } from "@/constants/colors";

interface DisplayNamePromptProps {
  visible: boolean;
  onComplete: () => void;
}

export function DisplayNamePrompt({ visible, onComplete }: DisplayNamePromptProps) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { updateDisplayName } = useAuth();

  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("errors.requiredField"));
      return;
    }

    if (trimmedName.length < 2) {
      setError(t("errors.requiredField"));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: updateError } = await updateDisplayName(trimmedName);
      if (updateError) {
        setError(t("errors.generic"));
      } else {
        onComplete();
      }
    } catch {
      setError(t("errors.generic"));
    } finally {
      setIsLoading(false);
    }
  }, [name, updateDisplayName, onComplete, t]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View
          className="flex-1 justify-center px-6"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          <View
            className="rounded-3xl p-6"
            style={{
              backgroundColor: isDark ? SURFACE.dark.card : SURFACE.light.card,
            }}
          >
            {/* Header */}
            <View className="items-center mb-6">
              <Text className="text-4xl mb-3">👋</Text>
              <Text
                className="text-xl text-center mb-2"
                style={{
                  color: isDark ? TEXT.dark.primary : TEXT.light.primary,
                  fontFamily: "Nunito-Bold",
                }}
              >
                {t("auth.displayName")}
              </Text>
              <Text
                className="text-base text-center"
                style={{
                  color: isDark ? TEXT.dark.secondary : TEXT.light.secondary,
                  fontFamily: "Nunito-Regular",
                }}
              >
                {t("auth.displayNamePlaceholder")}
              </Text>
            </View>

            {/* Input */}
            <View className="mb-4">
              <TextInput
                className="rounded-xl px-4"
                style={{
                  backgroundColor: isDark ? SURFACE.dark.background : SURFACE.light.background,
                  color: isDark ? TEXT.dark.primary : TEXT.light.primary,
                  fontFamily: "Nunito-Regular",
                  fontSize: 16,
                  paddingTop: 14,
                  paddingBottom: 14,
                  borderWidth: error ? 2 : 1,
                  borderColor: error
                    ? "#ef4444"
                    : isDark
                      ? BORDER.dark.default
                      : BORDER.light.subtle,
                }}
                placeholder={t("auth.displayNamePlaceholder")}
                placeholderTextColor={isDark ? TEXT.dark.tertiary : TEXT.light.muted}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  setError(null);
                }}
                autoCapitalize="words"
                autoCorrect={false}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSave}
                editable={!isLoading}
              />
              {error && (
                <Text
                  className="text-sm mt-1.5"
                  style={{ color: "#ef4444", fontFamily: "Nunito-Regular" }}
                >
                  {error}
                </Text>
              )}
            </View>

            {/* Save Button */}
            <Pressable
              onPress={handleSave}
              disabled={isLoading}
              className="rounded-xl py-4 items-center active:scale-[0.98]"
              style={{
                backgroundColor: isDark ? ACTION.dark.primary : ACTION.light.primary,
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  className="text-white text-base"
                  style={{ fontFamily: "Nunito-SemiBold" }}
                >
                  {t("common.continue")}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
