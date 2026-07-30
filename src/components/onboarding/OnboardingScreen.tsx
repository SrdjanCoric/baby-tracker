import type { ReactNode } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { SURFACE, TEXT } from "@/constants/colors";

interface OnboardingScreenProps {
  testID: string;
  title: string;
  description?: string;
  headerAccessory?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
}

export function OnboardingScreen({
  testID,
  title,
  description,
  headerAccessory,
  children,
  contentClassName = "gap-3",
}: OnboardingScreenProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: isDark ? SURFACE.dark.background : SURFACE.light.background }}
      testID={testID}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          testID="onboarding-scroll-view"
          contentContainerClassName="flex-grow px-6 py-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {headerAccessory}
          <Pressable onPress={Keyboard.dismiss} testID="dismiss-keyboard">
            <Text
              className="text-3xl font-bold mb-3"
              style={{ color: isDark ? TEXT.dark.primary : TEXT.light.primary }}
              accessibilityRole="header"
            >
              {title}
            </Text>
            {description ? (
              <Text
                className="text-base leading-6 mb-5"
                style={{ color: isDark ? TEXT.dark.secondary : TEXT.light.secondary }}
              >
                {description}
              </Text>
            ) : null}
          </Pressable>
          <View className={contentClassName}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
