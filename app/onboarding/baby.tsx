/**
 * Baby Setup Screen - Final onboarding screen
 */

import { useCallback, useState, useRef } from "react";
import { View, Text, Pressable, Platform, useColorScheme, ScrollView, KeyboardAvoidingView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Input } from "@/components";
import { useOnboarding, useBaby } from "@/contexts";
import { te } from "@/utils/translate-errors";
import { OnboardingPagination, OnboardingIllustration } from "@/components/onboarding";
import { validateNewBabyProfile } from "@/validators/baby";
import { sanitizeName } from "@/utils/sanitize";

const PRIMARY_COLOR = "#6B9E6E";

type Gender = "male" | "female";

export default function BabySetupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { state, completeOnboarding, skipOnboarding } = useOnboarding();
  const { addBaby, selectBaby } = useBaby();

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState<Date | undefined>();
  const [gender, setGender] = useState<Gender | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);

  const handleSkip = useCallback(async () => {
    await skipOnboarding();
    router.replace("/(tabs)");
  }, [skipOnboarding, router]);

  const handleDateChange = useCallback(
    (_event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === "android") {
        setShowDatePicker(false);
      }
      if (selectedDate) {
        setBirthDate(selectedDate);
        setErrors((prev) => ({ ...prev, birthDate: "" }));
      }
    },
    []
  );

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleContinue = useCallback(async () => {
    if (isSubmittingRef.current) {
      return;
    }

    const validation = validateNewBabyProfile({
      name: sanitizeName(name),
      birthDate,
      gender,
    });

    setErrors(validation.errors);

    if (!validation.isValid) {
      return;
    }

    isSubmittingRef.current = true;
    setIsLoading(true);
    setErrors({});

    try {
      const newBaby = await addBaby(validation.data);
      await selectBaby(newBaby.id);
      await completeOnboarding();
      router.replace("/(tabs)");
    } catch (error) {
      const errorMessage =
        error instanceof Error && error.message.includes("network")
          ? t("onboarding.errors.networkError")
          : t("onboarding.errors.createBabyFailed");
      setErrors({ submit: errorMessage });
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  }, [name, birthDate, gender, addBaby, selectBaby, completeOnboarding, router, t]);

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["top", "bottom"]} testID="baby-setup-screen">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Skip button */}
        <View className="absolute top-4 right-4 z-10">
          <Pressable
            onPress={handleSkip}
            className="py-2 px-4 active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel={t("common.skip")}
            testID="skip-button"
          >
            <Text className="text-base text-content-secondary dark:text-content-dark-secondary font-medium">
              {t("common.skip")}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="px-8 pt-12 pb-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Illustration */}
          <View className="items-center mb-8">
            <OnboardingIllustration type="baby-profile" />
          </View>

          {/* Title */}
          <Text className="text-2xl font-bold text-content-primary dark:text-content-dark-primary text-center mb-2">
            {t("onboarding.baby.title")}
          </Text>

          {/* Subtitle */}
          <Text className="text-base text-content-secondary dark:text-content-dark-secondary text-center mb-8">
            {t("onboarding.baby.subtitle")}
          </Text>

          {/* Submit Error */}
          {errors.submit && (
            <View className="bg-red-100 dark:bg-red-900/30 rounded-xl p-4 mb-4">
              <Text className="text-red-700 dark:text-red-300 text-center">
                {errors.submit}
              </Text>
              <Pressable
                onPress={() => {
                  setErrors((prev) => ({ ...prev, submit: "" }));
                  isSubmittingRef.current = false;
                }}
                className="mt-2 py-2"
              >
                <Text className="text-red-700 dark:text-red-300 text-center font-medium underline">
                  {t("common.retry")}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Form */}
          <View className="mb-6">
            {/* Name Input */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-content-primary dark:text-content-dark-primary mb-2">
                {t("onboarding.babyName")}
              </Text>
              <Input
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  setErrors((prev) => ({ ...prev, name: "" }));
                }}
                placeholder={t("onboarding.babyNamePlaceholder")}
                error={errors.name ? te(t, errors.name) : undefined}
                autoCapitalize="words"
                maxLength={100}
                testID="baby-name-input"
              />
            </View>

            {/* Birth Date */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-content-primary dark:text-content-dark-primary mb-2">
                {t("onboarding.birthDate")}
              </Text>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                accessibilityRole="button"
                accessibilityLabel={t("onboarding.selectBirthDate")}
                accessibilityHint={errors.birthDate ? te(t, errors.birthDate) : undefined}
                testID="birth-date-picker"
                className={`px-4 py-4 rounded-lg border ${
                  errors.birthDate
                    ? "border-red-500"
                    : isDark
                    ? "border-gray-700 bg-gray-800"
                    : "border-gray-300 bg-gray-50"
                }`}
              >
                <Text
                  className={
                    birthDate
                      ? "text-content-primary dark:text-content-dark-primary"
                      : "text-gray-400"
                  }
                >
                  {birthDate ? formatDate(birthDate) : t("onboarding.selectBirthDate")}
                </Text>
              </Pressable>
              {errors.birthDate && (
                <Text accessibilityRole="alert" className="text-red-500 text-sm mt-1">
                  {te(t, errors.birthDate)}
                </Text>
              )}
            </View>

            {/* Gender Selection */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-content-primary dark:text-content-dark-primary mb-2">
                {t("onboarding.gender")}
              </Text>
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => {
                    setGender("male");
                    setErrors((prev) => ({ ...prev, gender: "" }));
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: gender === "male" }}
                  className={`flex-1 py-3 rounded-lg items-center border ${
                    gender === "male"
                      ? "border-green-600 bg-green-50 dark:bg-green-900/20"
                      : isDark
                      ? "border-gray-700 bg-gray-800"
                      : "border-gray-300 bg-gray-50"
                  }`}
                  testID="gender-male"
                >
                  <Text className="text-xl mb-1">👦</Text>
                  <Text
                    className={
                      gender === "male"
                        ? "text-green-700 dark:text-green-300 font-medium"
                        : "text-content-secondary dark:text-content-dark-secondary"
                    }
                  >
                    {t("onboarding.male")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setGender("female");
                    setErrors((prev) => ({ ...prev, gender: "" }));
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: gender === "female" }}
                  className={`flex-1 py-3 rounded-lg items-center border ${
                    gender === "female"
                      ? "border-green-600 bg-green-50 dark:bg-green-900/20"
                      : isDark
                      ? "border-gray-700 bg-gray-800"
                      : "border-gray-300 bg-gray-50"
                  }`}
                  testID="gender-female"
                >
                  <Text className="text-xl mb-1">👧</Text>
                  <Text
                    className={
                      gender === "female"
                        ? "text-green-700 dark:text-green-300 font-medium"
                        : "text-content-secondary dark:text-content-dark-secondary"
                    }
                  >
                    {t("onboarding.female")}
                  </Text>
                </Pressable>
              </View>
              {errors.gender && (
                <Text accessibilityRole="alert" className="text-red-500 text-sm mt-1">
                  {te(t, errors.gender)}
                </Text>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Bottom Section */}
        <View className="px-8 pb-8">
          {/* Pagination dots */}
          <OnboardingPagination currentStep={state.currentStep} totalSteps={6} />

          {/* Continue button */}
          <Pressable
            onPress={handleContinue}
            disabled={isLoading}
            className={`py-4 rounded-button-lg items-center active:scale-[0.98] ${
              isLoading ? "opacity-50" : ""
            }`}
            style={{ backgroundColor: PRIMARY_COLOR }}
            accessibilityRole="button"
            accessibilityLabel={t("onboarding.continue")}
            accessibilityState={{ disabled: isLoading }}
            testID="continue-button"
          >
            <Text className="text-lg font-semibold text-white">
              {isLoading ? t("common.loading") : t("onboarding.continue")}
            </Text>
          </Pressable>
        </View>

        {/* Date Picker */}
        {showDatePicker && (
          <View>
            {Platform.OS === "ios" && (
              <View className="flex-row justify-end px-4 py-2 bg-surface-secondary dark:bg-surface-dark-secondary border-t border-border dark:border-border-dark">
                <Pressable
                  onPress={() => setShowDatePicker(false)}
                  className="py-2 px-4"
                  accessibilityRole="button"
                  accessibilityLabel={t("common.done")}
                >
                  <Text className="font-semibold" style={{ color: PRIMARY_COLOR }}>
                    {t("common.done")}
                  </Text>
                </Pressable>
              </View>
            )}
            <DateTimePicker
              testID="birth-date-input"
              value={birthDate || new Date()}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={handleDateChange}
              maximumDate={new Date()}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
