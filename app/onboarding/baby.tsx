/**
 * Baby Setup Screen - Final onboarding screen
 */

import { useCallback, useState } from "react";
import { View, Text, Pressable, Platform, useColorScheme, ScrollView, KeyboardAvoidingView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Input } from "@/components";
import { useOnboarding, useBaby } from "@/contexts";
import { OnboardingPagination, OnboardingIllustration } from "@/components/onboarding";
import { validateBabyName, validateBirthDate } from "@/validators/baby";

const PRIMARY_COLOR = "#7C3AED";

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
    const newErrors: Record<string, string> = {};

    const nameError = validateBabyName(name);
    if (nameError) newErrors.name = nameError;

    const birthDateError = validateBirthDate(birthDate);
    if (birthDateError) newErrors.birthDate = birthDateError;

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setIsLoading(true);
    try {
      const newBaby = await addBaby({
        name: name.trim(),
        birthDate,
        gender,
      });
      await selectBaby(newBaby.id);
      await completeOnboarding();
      router.replace("/(tabs)");
    } catch {
      setIsLoading(false);
    }
  }, [name, birthDate, gender, addBaby, selectBaby, completeOnboarding, router]);

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["top", "bottom"]}>
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
                error={errors.name}
                autoCapitalize="words"
              />
            </View>

            {/* Birth Date */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-content-primary dark:text-content-dark-primary mb-2">
                {t("onboarding.birthDate")}
              </Text>
              <Pressable
                onPress={() => setShowDatePicker(true)}
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
                <Text className="text-red-500 text-sm mt-1">{errors.birthDate}</Text>
              )}
            </View>

            {/* Gender Selection */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-content-primary dark:text-content-dark-primary mb-2">
                {t("onboarding.gender")}
              </Text>
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setGender("male")}
                  className={`flex-1 py-3 rounded-lg items-center border ${
                    gender === "male"
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                      : isDark
                      ? "border-gray-700 bg-gray-800"
                      : "border-gray-300 bg-gray-50"
                  }`}
                >
                  <Text className="text-xl mb-1">👦</Text>
                  <Text
                    className={
                      gender === "male"
                        ? "text-purple-700 dark:text-purple-300 font-medium"
                        : "text-content-secondary dark:text-content-dark-secondary"
                    }
                  >
                    {t("onboarding.male")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setGender("female")}
                  className={`flex-1 py-3 rounded-lg items-center border ${
                    gender === "female"
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                      : isDark
                      ? "border-gray-700 bg-gray-800"
                      : "border-gray-300 bg-gray-50"
                  }`}
                >
                  <Text className="text-xl mb-1">👧</Text>
                  <Text
                    className={
                      gender === "female"
                        ? "text-purple-700 dark:text-purple-300 font-medium"
                        : "text-content-secondary dark:text-content-dark-secondary"
                    }
                  >
                    {t("onboarding.female")}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Section */}
        <View className="px-8 pb-8">
          {/* Pagination dots */}
          <OnboardingPagination currentStep={state.currentStep} totalSteps={4} />

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
          >
            <Text className="text-lg font-semibold text-white">
              {isLoading ? t("common.loading") : t("onboarding.continue")}
            </Text>
          </Pressable>
        </View>

        {/* Date Picker */}
        {showDatePicker && (
          <DateTimePicker
            value={birthDate || new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleDateChange}
            maximumDate={new Date()}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
