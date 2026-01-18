import { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Platform,
  useColorScheme,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Input } from "./Input";
import { Button } from "./Button";
import { validateBabyName, validateBirthDate } from "@/validators/baby";

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

const GENDER_OPTIONS: { value: Gender; label: string; emoji: string }[] = [
  { value: "male", label: "Boy", emoji: "👦" },
  { value: "female", label: "Girl", emoji: "👧" },
];

function BabyProfileForm({
  initialData,
  onSave,
  onCancel,
  isLoading = false,
}: BabyProfileFormProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [name, setName] = useState(initialData?.name ?? "");
  const [birthDate, setBirthDate] = useState<Date | undefined>(initialData?.birthDate);
  const [gender, setGender] = useState<Gender | undefined>(initialData?.gender);
  const [photoUri] = useState<string | undefined>(initialData?.photoUri);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

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
      contentContainerClassName="p-6 pb-12"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="mb-8">
        <Pressable
          className={`
            self-center w-32 h-32 rounded-full items-center justify-center
            border-4 border-dashed
            ${isDark ? "border-gray-600 bg-surface-dark-card" : "border-gray-200 bg-gray-50"}
          `}
          accessibilityLabel="Add baby photo"
          accessibilityHint="Tap to select a photo for your baby"
        >
          <Text className="text-5xl mb-1">👶</Text>
          <Text className={`text-xs font-medium ${isDark ? "text-content-dark-secondary" : "text-content-secondary"}`}>
            Add Photo
          </Text>
        </Pressable>
      </View>

      <View className="mb-6">
        <Input
          label="Baby's Name"
          placeholder="Enter your baby's name"
          value={name}
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
          error={touched.name ? errors.name : undefined}
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
          Birth Date (Optional)
        </Text>

        <Pressable
          onPress={() => setShowDatePicker(true)}
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
          accessibilityLabel="Select birth date"
          accessibilityHint={birthDate ? `Current date: ${formatDate(birthDate)}` : "Tap to select a birth date"}
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
            {birthDate ? formatDate(birthDate) : "Select birth date"}
          </Text>
          <Text className="text-xl">📅</Text>
        </Pressable>

        {touched.birthDate && errors.birthDate && (
          <Text className="mt-1.5 text-sm text-red-600">{errors.birthDate}</Text>
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
                  onPress={() => setShowDatePicker(false)}
                >
                  Done
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
          Gender (Optional)
        </Text>

        <View className="flex-row gap-3">
          {GENDER_OPTIONS.map((option) => {
            const isSelected = gender === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setGender(isSelected ? undefined : option.value)}
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
                accessibilityLabel={option.label}
                accessibilityState={{ selected: isSelected }}
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
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="gap-3 mt-4">
        <Button
          variant="primary"
          size="large"
          onPress={handleSave}
          loading={isLoading}
          disabled={isLoading}
        >
          {initialData ? "Save Changes" : "Add Baby"}
        </Button>

        <Button
          variant="ghost"
          size="large"
          onPress={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
      </View>
    </ScrollView>
  );
}

export { BabyProfileForm, type BabyProfileFormData, type BabyProfileFormProps };
