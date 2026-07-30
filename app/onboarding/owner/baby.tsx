import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { OnboardingIllustration, OnboardingScreen } from "@/components/onboarding";
import { useAuth, useBaby, useLanguage } from "@/contexts";
import { NewOwnerOnboardingStorageService } from "@/services/new-owner-onboarding-storage";
import type { BabyProfileDraft } from "@/types/new-owner-onboarding";
import { validateBabyName, validateNewBabyProfile, type BabyGender } from "@/validators/baby";
import { sanitizeName } from "@/utils/sanitize";
import { te } from "@/utils/translate-errors";
import { ACTION, BORDER, SEMANTIC, SURFACE, TEXT } from "@/constants/colors";
import { useColorScheme } from "nativewind";

export default function NewOwnerBabyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { addBaby, selectBaby } = useBaby();
  const { signOut } = useAuth();
  const { language, resolvedLanguage } = useLanguage();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const primaryTextColor = isDark ? TEXT.dark.primary : TEXT.light.primary;
  const secondaryTextColor = isDark ? TEXT.dark.secondary : TEXT.light.secondary;
  const borderColor = isDark ? BORDER.dark.default : BORDER.light.default;
  const selectedColor = isDark ? ACTION.dark.primary : ACTION.light.primary;
  const cardColor = isDark ? SURFACE.dark.card : SURFACE.light.card;
  const selectedCardColor = isDark ? SURFACE.dark.secondary : SURFACE.light.muted;
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState<Date | undefined>();
  const [gender, setGender] = useState<BabyGender | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [accountMode, setAccountMode] = useState<"guest" | "authenticated">("guest");
  const submittingRef = useRef(false);

  useEffect(() => {
    let active = true;
    NewOwnerOnboardingStorageService.getState(language).then(state => {
      if (!active) return;
      if (state.screen !== "owner-baby") {
        router.replace("/onboarding/owner");
        return;
      }
      setAccountMode(state.accountMode);
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

  const handleDateDone = useCallback(() => {
    const confirmedDate = birthDate ?? new Date();
    if (!birthDate) {
      setBirthDate(confirmedDate);
      setErrors(current => ({ ...current, birthDate: "" }));
      persistDraft({ name, birthDate: confirmedDate.toISOString(), gender: gender ?? null });
    }
    setShowDatePicker(false);
  }, [birthDate, gender, name, persistDraft]);

  const handleGender = useCallback((value: BabyGender) => {
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
      router.push(accountMode === "authenticated"
        ? "/onboarding/owner/invitation"
        : "/onboarding/owner/activity");
    } catch {
      setErrors({ submit: "newOwnerOnboarding.baby.createFailed" });
      setIsLoading(false);
      submittingRef.current = false;
    }
  }, [accountMode, addBaby, birthDate, gender, name, router, selectBaby]);

  const handleStartOver = useCallback(async () => {
    if (accountMode === "authenticated") await signOut();
    await NewOwnerOnboardingStorageService.startOver();
    router.replace("/onboarding/owner");
  }, [accountMode, router, signOut]);

  if (isLoading && !submittingRef.current) {
    return (
      <OnboardingScreen
        testID="new-owner-baby-screen"
        title={t("newOwnerOnboarding.baby.title")}
        description={t("newOwnerOnboarding.baby.requiredHint")}
        contentClassName="flex-1 items-center justify-center"
      >
        <View testID="onboarding-loading-indicator" accessibilityState={{ busy: true }}>
          <ActivityIndicator color={selectedColor} />
        </View>
      </OnboardingScreen>
    );
  }

  return (
    <OnboardingScreen
      testID="new-owner-baby-screen"
      title={t("newOwnerOnboarding.baby.title")}
      description={t("newOwnerOnboarding.baby.subtitle")}
      headerAccessory={<View className="items-center"><OnboardingIllustration type="baby-profile" /></View>}
    >
      <Text className="text-sm mb-2" style={{ color: secondaryTextColor }}>
        {t("newOwnerOnboarding.baby.requiredHint")}
      </Text>
      <Input
        label={t("newOwnerOnboarding.baby.name")}
        value={name}
        onChangeText={handleName}
        onBlur={() => {
          const error = validateBabyName(name);
          setErrors(current => ({ ...current, name: error ?? "" }));
        }}
        placeholder={t("newOwnerOnboarding.baby.namePlaceholder")}
        error={errors.name ? te(t, errors.name) : undefined}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        maxLength={100}
        testID="owner-baby-name"
      />

      <View className="mt-2">
        <Text
          className={`mb-2 text-sm font-medium ${errors.birthDate ? "text-red-600" : ""}`}
          style={errors.birthDate ? undefined : { color: secondaryTextColor }}
        >
          {t("newOwnerOnboarding.baby.birthDate")}
        </Text>
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            setShowDatePicker(true);
          }}
          className="min-h-[52px] rounded-2xl border-2 px-4 py-3 justify-center"
          style={{
            borderColor: errors.birthDate
              ? isDark ? SEMANTIC.error.dark : SEMANTIC.error.light
              : borderColor,
            backgroundColor: cardColor,
          }}
          accessibilityRole="button"
          accessibilityLabel={t("newOwnerOnboarding.baby.selectBirthDate")}
          accessibilityHint={errors.birthDate ? te(t, errors.birthDate) : undefined}
          testID="owner-baby-birth-date"
        >
          <Text className="text-base" style={{ color: birthDate ? primaryTextColor : secondaryTextColor }}>
            {birthDate
              ? birthDate.toLocaleDateString(resolvedLanguage, { month: "long", day: "numeric", year: "numeric" })
              : t("newOwnerOnboarding.baby.selectBirthDate")}
          </Text>
        </Pressable>
        {errors.birthDate ? (
          <Text accessibilityRole="alert" className="text-red-600 mt-1.5 text-sm">
            {te(t, errors.birthDate)}
          </Text>
        ) : null}
      </View>

      <View className="mt-2">
        <Text className="mb-2 text-sm font-medium" style={{ color: secondaryTextColor }}>
          {t("newOwnerOnboarding.baby.gender")}
        </Text>
        <View className="flex-row gap-3">
          {(["male", "female"] as const).map(value => {
            const selected = gender === value;
            return (
              <Pressable
                key={value}
                onPress={() => {
                  Keyboard.dismiss();
                  handleGender(value);
                }}
                className="flex-1 min-h-[72px] rounded-2xl border-2 px-4 py-3 items-center justify-center"
                style={{
                  borderColor: selected ? selectedColor : borderColor,
                  backgroundColor: selected ? selectedCardColor : cardColor,
                }}
                accessibilityRole="radio"
                accessibilityLabel={t(`newOwnerOnboarding.baby.${value}`)}
                accessibilityHint={errors.gender ? te(t, errors.gender) : undefined}
                accessibilityState={{ selected }}
                testID={`owner-baby-gender-${value}`}
              >
                <Text className="text-2xl mb-1">{value === "male" ? "👦" : "👧"}</Text>
                <Text className="font-medium text-center" style={{ color: selected ? selectedColor : primaryTextColor }}>
                  {t(`newOwnerOnboarding.baby.${value}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {errors.gender ? (
          <Text accessibilityRole="alert" className="text-red-600 mt-1.5 text-sm">
            {te(t, errors.gender)}
          </Text>
        ) : null}
      </View>

      {showDatePicker ? (
        <View>
          <DateTimePicker
            testID="owner-baby-birth-date-input"
            value={birthDate ?? new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleDate}
            maximumDate={new Date()}
            themeVariant={isDark ? "dark" : "light"}
          />
          {Platform.OS === "ios" ? (
            <Button
              variant="ghost"
              wrapText
              onPress={handleDateDone}
              testID="owner-baby-birth-date-done"
            >
              {t("common.done")}
            </Button>
          ) : null}
        </View>
      ) : null}

      {errors.submit ? (
        <Text accessibilityRole="alert" className="text-red-600 mt-1.5 text-sm">
          {t("newOwnerOnboarding.baby.createFailed")}
        </Text>
      ) : null}

      <View className="gap-3 mt-4 pb-4">
        <Button
          size="large"
          wrapText
          onPress={handleContinue}
          loading={isLoading}
          disabled={isLoading}
          testID="owner-baby-continue"
        >
          {t("common.continue")}
        </Button>
        <Button
          variant="ghost"
          size="large"
          wrapText
          onPress={handleStartOver}
          disabled={isLoading}
          testID="owner-start-over"
        >
          {t("newOwnerOnboarding.startOver")}
        </Button>
      </View>
    </OnboardingScreen>
  );
}
