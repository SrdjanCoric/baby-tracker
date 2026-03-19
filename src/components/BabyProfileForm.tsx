import { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Platform,
  useColorScheme,
  Image,
  Alert,
  Keyboard,
} from "react-native";
import { useTranslation } from "react-i18next";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { Input } from "./Input";
import { Button } from "./Button";
import { te } from "@/utils/translate-errors";
import { validateBabyName, validateBirthDate } from "@/validators/baby";

const isAndroid = Platform.OS === "android";

type Gender = "male" | "female";

interface BabyProfileFormData {
  name: string;
  birthDate?: Date;
  gender?: Gender;
  photoUri?: string;
}

interface BabyProfileFormProps {
  initialData?: BabyProfileFormData;
  onSave: (data: BabyProfileFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

function BabyProfileForm({
  initialData,
  onSave,
  onCancel,
  isLoading = false,
}: BabyProfileFormProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const GENDER_OPTIONS = [
    { value: "male" as Gender, labelKey: "baby.boy" as const, emoji: "👦" },
    { value: "female" as Gender, labelKey: "baby.girl" as const, emoji: "👧" },
  ];

  const [name, setName] = useState(initialData?.name ?? "");
  const [birthDate, setBirthDate] = useState<Date | undefined>(initialData?.birthDate);
  const [gender, setGender] = useState<Gender | undefined>(initialData?.gender);
  const [photoUri, setPhotoUri] = useState<string | undefined>(initialData?.photoUri);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        t("common.error"),
        t("baby.photoPermissionDenied")
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }, [t]);

  const handlePhotoPress = useCallback(() => {
    Keyboard.dismiss();
    if (photoUri) {
      Alert.alert(
        t("baby.changePhoto"),
        t("baby.changePhotoMessage"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("baby.chooseNewPhoto"), onPress: pickImage },
          {
            text: t("baby.removePhoto"),
            style: "destructive",
            onPress: () => setPhotoUri(undefined)
          },
        ]
      );
    } else {
      pickImage();
    }
  }, [photoUri, pickImage, t]);

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};

    const nameError = validateBabyName(name);
    if (nameError) newErrors.name = nameError;

    const birthDateError = validateBirthDate(birthDate);
    if (birthDateError) newErrors.birthDate = birthDateError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, birthDate]);

  const handleSave = useCallback(() => {
    setTouched({ name: true, birthDate: true, gender: true });
    if (validateForm()) {
      onSave({ name: name.trim(), birthDate, gender, photoUri });
    }
  }, [name, birthDate, gender, photoUri, validateForm, onSave]);

  const handleDateChange = useCallback(
    (_event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === "android") {
        setShowDatePicker(false);
      }
      if (selectedDate) {
        setBirthDate(selectedDate);
        setTouched((prev) => ({ ...prev, birthDate: true }));
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

  return (
    <ScrollView
      className={`flex-1 ${isDark ? "bg-surface-dark" : "bg-surface"}`}
      contentContainerClassName={isAndroid ? "p-4 pb-8" : "p-6 pb-12"}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="mb-8">
        <Pressable
          onPress={handlePhotoPress}
          className={`
            self-center w-32 h-32 rounded-full items-center justify-center overflow-hidden
            ${photoUri ? "" : "border-4 border-dashed"}
            ${isDark ? "border-gray-600 bg-surface-dark-card" : "border-gray-200 bg-gray-50"}
          `}
          accessibilityLabel={photoUri ? t("baby.changePhoto") : t("baby.addPhoto")}
        >
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <>
              <Text className="text-5xl mb-1">👶</Text>
              <Text className={`text-xs font-medium ${isDark ? "text-content-dark-secondary" : "text-content-secondary"}`}>
                {t("baby.addPhoto")}
              </Text>
            </>
          )}
        </Pressable>
        {photoUri && (
          <Text className={`text-center text-xs mt-2 ${isDark ? "text-content-dark-tertiary" : "text-content-tertiary"}`}>
            {t("baby.tapToChange")}
          </Text>
        )}
      </View>

      <View className="mb-6">
        <Input
          label={t("baby.babyName")}
          placeholder={t("baby.babyNamePlaceholder")}
          value={name}
          testID="baby-name-input"
          onChangeText={(text) => {
            setName(text);
            if (touched.name) {
              const error = validateBabyName(text);
              setErrors((prev) => ({ ...prev, name: error ?? "" }));
            }
          }}
          onBlur={() => {
            setTouched((prev) => ({ ...prev, name: true }));
            const error = validateBabyName(name);
            setErrors((prev) => ({ ...prev, name: error ?? "" }));
          }}
          error={touched.name ? (errors.name ? te(t, errors.name) : undefined) : undefined}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
        />
      </View>

      <View className="mb-6">
        <Text
          className={`mb-2 text-sm font-medium ${
            touched.birthDate && errors.birthDate
              ? "text-red-600"
              : isDark
                ? "text-content-dark-secondary"
                : "text-gray-700"
          }`}
        >
          {t("baby.birthDateOptional")}
        </Text>

        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            setShowDatePicker(true);
          }}
          className={`
            min-h-[48px] px-4 rounded-2xl border-2 flex-row items-center justify-between
            ${
              touched.birthDate && errors.birthDate
                ? "border-red-400 bg-red-50"
                : isDark
                  ? "border-gray-700 bg-surface-dark-card"
                  : "border-gray-200 bg-white"
            }
          `}
          accessibilityLabel={t("baby.selectBirthDate")}
          testID="birth-date-picker"
        >
          <Text
            className={`text-base ${
              birthDate
                ? isDark
                  ? "text-content-dark-primary"
                  : "text-gray-900"
                : isDark
                  ? "text-content-dark-tertiary"
                  : "text-gray-400"
            }`}
          >
            {birthDate ? formatDate(birthDate) : t("baby.selectBirthDate")}
          </Text>
          <Text className="text-xl">📅</Text>
        </Pressable>

        {touched.birthDate && errors.birthDate && (
          <Text className="mt-1.5 text-sm text-red-600">{te(t, errors.birthDate)}</Text>
        )}

        {showDatePicker && (
          <View className={`mt-2 ${Platform.OS === "ios" ? "rounded-2xl overflow-hidden" : ""}`}>
            <DateTimePicker
              value={birthDate ?? new Date()}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={handleDateChange}
              maximumDate={new Date()}
              themeVariant={isDark ? "dark" : "light"}
            />
            {Platform.OS === "ios" && (
              <View className="flex-row justify-end mt-2">
                <Button
                  variant="ghost"
                  onPress={() => {
                    if (!birthDate) {
                      setBirthDate(new Date());
                      setTouched((prev) => ({ ...prev, birthDate: true }));
                    }
                    setShowDatePicker(false);
                  }}
                  testID="birth-date-done-button"
                >
                  {t("common.done")}
                </Button>
              </View>
            )}
          </View>
        )}
      </View>

      <View className="mb-8">
        <Text
          className={`mb-3 text-sm font-medium ${isDark ? "text-content-dark-secondary" : "text-gray-700"}`}
        >
          {t("baby.genderOptional")}
        </Text>

        <View className="flex-row gap-3">
          {GENDER_OPTIONS.map((option) => {
            const isSelected = gender === option.value;
            const label = t(option.labelKey);
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  Keyboard.dismiss();
                  setGender(isSelected ? undefined : option.value);
                }}
                className={`
                  flex-1 min-h-[72px] rounded-2xl items-center justify-center py-3
                  border-2
                  ${
                    isSelected
                      ? isDark
                        ? "border-action-dark-primary bg-action-dark-primary/20"
                        : "border-action-primary bg-action-primary/10"
                      : isDark
                        ? "border-gray-700 bg-surface-dark-card"
                        : "border-gray-200 bg-white"
                  }
                `}
                accessibilityLabel={label}
                accessibilityState={{ selected: isSelected }}
                testID={`gender-${option.value}`}
              >
                <Text className="text-2xl mb-1">{option.emoji}</Text>
                <Text
                  className={`text-sm font-medium ${
                    isSelected
                      ? isDark
                        ? "text-action-dark-primary"
                        : "text-action-primary"
                      : isDark
                        ? "text-content-dark-secondary"
                        : "text-content-secondary"
                  }`}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="gap-3 mt-4 w-full">
        <Button
          variant="primary"
          size="large"
          onPress={handleSave}
          loading={isLoading}
          disabled={isLoading}
          testID="save-baby-button"
        >
          {initialData ? t("baby.saveChanges") : t("baby.addBaby")}
        </Button>

        <Button
          variant="ghost"
          size="large"
          onPress={onCancel}
          disabled={isLoading}
        >
          {t("common.cancel")}
        </Button>
      </View>
    </ScrollView>
  );
}

export { BabyProfileForm, type BabyProfileFormData, type BabyProfileFormProps };
