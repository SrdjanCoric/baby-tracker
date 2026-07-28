import { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Input } from "@/components";
import { OnboardingIllustration } from "@/components/onboarding";
import { useBaby, useLanguage } from "@/contexts";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";
import type { BabyProfileDraft } from "@/types/new-owner-onboarding";
import { validateNewBabyProfile } from "@/validators/baby";
import { sanitizeName } from "@/utils/sanitize";
import { te } from "@/utils/translate-errors";
import { ACTION } from "@/constants/colors";

type Gender = "male" | "female";

export default function NewOwnerBabyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { addBaby, selectBaby } = useBaby();
  const { language, resolvedLanguage } = useLanguage();
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState<Date | undefined>();
  const [gender, setGender] = useState<Gender | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const submittingRef = useRef(false);

  useEffect(() => {
    let active = true;
    NewOwnerOnboardingStorageService.getState(language).then(state => {
      if (!active) return;
      if (state.screen !== "owner-baby") {
        router.replace("/onboarding/owner");
        return;
      }
      setName(state.babyDraft.name);
      setBirthDate(state.babyDraft.birthDate ? new Date(state.babyDraft.birthDate) : undefined);
      setGender(state.babyDraft.gender ?? undefined);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [language, router]);

  const persistDraft = useCallback((draft: BabyProfileDraft) => {
    void NewOwnerOnboardingStorageService.updateBabyDraft(draft);
  }, []);

  const handleName = useCallback((value: string) => {
    setName(value);
    setErrors(current => ({ ...current, name: "" }));
    persistDraft({
      name: value,
      birthDate: birthDate?.toISOString() ?? null,
      gender: gender ?? null,
    });
  }, [birthDate, gender, persistDraft]);

  const handleDate = useCallback((_event: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (!value) return;
    setBirthDate(value);
    setErrors(current => ({ ...current, birthDate: "" }));
    persistDraft({ name, birthDate: value.toISOString(), gender: gender ?? null });
  }, [gender, name, persistDraft]);

  const handleGender = useCallback((value: Gender) => {
    setGender(value);
    setErrors(current => ({ ...current, gender: "" }));
    persistDraft({
      name,
      birthDate: birthDate?.toISOString() ?? null,
      gender: value,
    });
  }, [birthDate, name, persistDraft]);

  const handleContinue = useCallback(async () => {
    if (submittingRef.current) return;
    const validation = validateNewBabyProfile({
      name: sanitizeName(name),
      birthDate,
      gender,
    });
    setErrors(validation.errors);
    if (!validation.isValid) return;

    submittingRef.current = true;
    setIsLoading(true);
    try {
      const baby = await addBaby(validation.data);
      await selectBaby(baby.id);
      await NewOwnerOnboardingStorageService.markBabyCreated(baby.id);
      router.push("/onboarding/owner/activity");
    } catch {
      setErrors({ submit: "newOwnerOnboarding.baby.createFailed" });
      setIsLoading(false);
      submittingRef.current = false;
    }
  }, [addBaby, birthDate, gender, name, router, selectBaby]);

  const handleStartOver = useCallback(async () => {
    await NewOwnerOnboardingStorageService.startOver();
    router.replace("/onboarding/owner");
  }, [router]);

  if (isLoading && !submittingRef.current) {
    return <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" testID="new-owner-baby-screen" />;
  }

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" testID="new-owner-baby-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <Pressable onPress={Keyboard.dismiss} className="items-center py-3" testID="dismiss-keyboard">
          <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
            {t("newOwnerOnboarding.baby.requiredHint")}
          </Text>
        </Pressable>
        <ScrollView contentContainerClassName="px-6 pb-8" keyboardShouldPersistTaps="handled">
          <View className="items-center mb-5"><OnboardingIllustration type="baby-profile" /></View>
          <Text className="text-3xl font-bold text-content-primary dark:text-content-dark-primary mb-2">
            {t("newOwnerOnboarding.baby.title")}
          </Text>
          <Text className="text-base text-content-secondary dark:text-content-dark-secondary mb-7">
            {t("newOwnerOnboarding.baby.subtitle")}
          </Text>

          <Text className="text-sm font-semibold text-content-primary dark:text-content-dark-primary mb-2">
            {t("newOwnerOnboarding.baby.name")}
          </Text>
          <Input
            value={name}
            onChangeText={handleName}
            placeholder={t("newOwnerOnboarding.baby.namePlaceholder")}
            error={errors.name ? te(t, errors.name) : undefined}
            autoCapitalize="words"
            maxLength={100}
            testID="owner-baby-name"
          />

          <Text className="text-sm font-semibold text-content-primary dark:text-content-dark-primary mt-5 mb-2">
            {t("newOwnerOnboarding.baby.birthDate")}
          </Text>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            className="rounded-lg border border-border dark:border-border-dark px-4 py-4"
            accessibilityRole="button"
            testID="owner-baby-birth-date"
          >
            <Text className="text-content-primary dark:text-content-dark-primary">
              {birthDate
                ? birthDate.toLocaleDateString(resolvedLanguage, { month: "long", day: "numeric", year: "numeric" })
                : t("newOwnerOnboarding.baby.selectBirthDate")}
            </Text>
          </Pressable>
          {errors.birthDate && <Text className="text-red-500 mt-1">{te(t, errors.birthDate)}</Text>}

          <Text className="text-sm font-semibold text-content-primary dark:text-content-dark-primary mt-5 mb-2">
            {t("newOwnerOnboarding.baby.gender")}
          </Text>
          <View className="flex-row gap-3">
            {(["male", "female"] as const).map(value => (
              <Pressable
                key={value}
                onPress={() => handleGender(value)}
                className="flex-1 rounded-lg border px-4 py-4 items-center"
                style={{ borderColor: gender === value ? ACTION.light.primary : "#CCC" }}
                accessibilityRole="radio"
                accessibilityState={{ selected: gender === value }}
                testID={`owner-baby-gender-${value}`}
              >
                <Text className="text-content-primary dark:text-content-dark-primary">
                  {t(`newOwnerOnboarding.baby.${value}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          {errors.gender && <Text className="text-red-500 mt-1">{te(t, errors.gender)}</Text>}
          {errors.submit && (
            <Text className="text-red-500 mt-4">
              {t("newOwnerOnboarding.baby.createFailed")}
            </Text>
          )}
        </ScrollView>

        <View className="px-6 pb-6 gap-3">
          <Pressable
            onPress={handleContinue}
            disabled={isLoading}
            className="rounded-button-lg py-4 items-center"
            style={{ backgroundColor: ACTION.light.primary, opacity: isLoading ? 0.5 : 1 }}
            accessibilityRole="button"
            testID="owner-baby-continue"
          >
            <Text className="text-white text-lg font-bold">{t("common.continue")}</Text>
          </Pressable>
          <Pressable onPress={handleStartOver} className="py-3 items-center" accessibilityRole="button" testID="owner-start-over">
            <Text className="text-content-secondary dark:text-content-dark-secondary">
              {t("newOwnerOnboarding.startOver")}
            </Text>
          </Pressable>
        </View>

        {showDatePicker && (
          <DateTimePicker
            testID="owner-baby-birth-date-input"
            value={birthDate ?? new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleDate}
            maximumDate={new Date()}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
