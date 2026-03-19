import { useCallback, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useColorScheme } from "nativewind";
import { useHealth } from "@/contexts/health-context";
import { useBaby, useTimeFormat, useUnits } from "@/contexts";
import { formatTime as formatTimeUtil } from "@/utils/time";
import { NoBabyScreen } from "@/components/NoBabyScreen";
import type { CreateHealthInput } from "@/services/health-storage";
import type { HealthType, MeasurementMethod, SymptomType } from "@/constants/activities";
import { COMMON_MEDICATION_KEYS, COMMON_VACCINE_KEYS, SYMPTOM_OPTIONS, MEASUREMENT_METHODS } from "@/constants/activities";
import { ACTIVITY, TEXT, SURFACE } from "@/constants/colors";
import { formatTemperature, getFeverStatus, getFeverColor, QUICK_TEMPS_CELSIUS, DEFAULT_TEMP_CELSIUS, TEMP_RANGE_CELSIUS, celsiusToFahrenheit, fahrenheitToCelsius } from "@/utils/temperature";
import { formatVolume } from "@/utils/volume";

const HEALTH_ACCENT = ACTIVITY.health.accent;
const HEALTH_ACCENT_DARK = ACTIVITY.health.accentDark;

export default function ManualHealthScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { selectedBaby } = useBaby();
  const { timeFormat } = useTimeFormat();
  const { addHealth } = useHealth();
  const { colorScheme } = useColorScheme();
  const { volumeUnit, temperatureUnit } = useUnits();
  const isDark = colorScheme === "dark";

  const colors = {
    accent: isDark ? HEALTH_ACCENT_DARK : HEALTH_ACCENT,
    mutedBg: isDark ? ACTIVITY.health.mutedDark : ACTIVITY.health.muted,
    textOnMuted: isDark ? ACTIVITY.health.textAccentDark : ACTIVITY.health.textAccent,
  };

  const [selectedType, setSelectedType] = useState<HealthType | null>(null);
  const [medicationName, setMedicationName] = useState("");
  const [customMedicationName, setCustomMedicationName] = useState("");
  const [dosageMl, setDosageMl] = useState<number | null>(null);
  const [reminderHours, setReminderHours] = useState<number | null>(null);
  const [temperatureCelsius, setTemperatureCelsius] = useState<number>(DEFAULT_TEMP_CELSIUS);
  const [measurementMethod, setMeasurementMethod] = useState<MeasurementMethod | null>(null);
  const [vaccineName, setVaccineName] = useState("");
  const [customVaccineName, setCustomVaccineName] = useState("");
  const [selectedSymptoms, setSelectedSymptoms] = useState<SymptomType[]>([]);
  const [notes, setNotes] = useState("");
  const [loggedAt, setLoggedAt] = useState(new Date());
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  const handleTypeSelect = useCallback((type: HealthType) => {
    setSelectedType(type);
    setMedicationName("");
    setCustomMedicationName("");
    setDosageMl(null);
    setReminderHours(null);
    setTemperatureCelsius(DEFAULT_TEMP_CELSIUS);
    setMeasurementMethod(null);
    setVaccineName("");
    setCustomVaccineName("");
    setSelectedSymptoms([]);
    setNotes("");
  }, []);

  const handleSymptomToggle = useCallback((symptom: SymptomType) => {
    setSelectedSymptoms(prev =>
      prev.includes(symptom)
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  }, []);

  const handleDateChange = useCallback((_event: unknown, date?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (date) {
      const newDateTime = new Date(loggedAt);
      newDateTime.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      setLoggedAt(newDateTime);
    }
  }, [loggedAt]);

  const handleTimeChange = useCallback((_event: unknown, date?: Date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    if (date) {
      const newDateTime = new Date(loggedAt);
      newDateTime.setHours(date.getHours(), date.getMinutes());
      setLoggedAt(newDateTime);
    }
  }, [loggedAt]);

  const handleDateTimeChange = useCallback((_event: unknown, selectedDateTime?: Date) => {
    if (selectedDateTime) {
      setLoggedAt(selectedDateTime);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (isSavingRef.current) return;
    if (!selectedBaby || !selectedType) return;

    const base: CreateHealthInput = {
      babyId: selectedBaby.id,
      type: selectedType,
      loggedAt,
    };

    if (selectedType === "medication") {
      const finalMedicationName = medicationName === "custom" ? customMedicationName : medicationName;
      if (!finalMedicationName) return;
      base.medicationName = finalMedicationName;
      if (dosageMl) base.dosageMl = dosageMl;
      if (reminderHours) base.reminderIntervalHours = reminderHours;
    } else if (selectedType === "temperature") {
      base.temperatureCelsius = temperatureCelsius;
      if (measurementMethod) base.measurementMethod = measurementMethod;
    } else if (selectedType === "vaccination") {
      const finalVaccineName = vaccineName === "custom" ? customVaccineName : vaccineName;
      if (!finalVaccineName) return;
      base.vaccineName = finalVaccineName;
    } else if (selectedType === "symptom") {
      if (selectedSymptoms.length === 0) return;
      base.symptoms = selectedSymptoms;
    } else {
      return;
    }

    if (notes) base.notes = notes;

    isSavingRef.current = true;
    setIsSaving(true);
    try {
      await addHealth(base);
      router.replace("/(tabs)");
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [selectedBaby, selectedType, medicationName, customMedicationName, dosageMl, reminderHours, temperatureCelsius, measurementMethod, vaccineName, customVaccineName, selectedSymptoms, notes, loggedAt, addHealth, router]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "2-digit",
    });
  };

  const formatDateDisplay = (date: Date) => formatTimeUtil(date, timeFormat);

  const canSave = selectedType !== null && !isSaving && (
    (selectedType === "medication" && (medicationName === "custom" ? customMedicationName : medicationName)) ||
    (selectedType === "temperature") ||
    (selectedType === "vaccination" && (vaccineName === "custom" ? customVaccineName : vaccineName)) ||
    (selectedType === "symptom" && selectedSymptoms.length > 0)
  );

  if (!selectedBaby) {
    return <NoBabyScreen />;
  }

  const displayTemperature = temperatureUnit === "°F"
    ? celsiusToFahrenheit(temperatureCelsius)
    : temperatureCelsius;

  const feverStatus = getFeverStatus(temperatureCelsius);
  const feverColor = getFeverColor(feverStatus);

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <Pressable
        onPress={() => Keyboard.dismiss()}
        className="items-center pt-2 pb-3"
        testID="dismiss-keyboard"
      >
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
          {t("health.logPastHealth")}
        </Text>
        <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
          {selectedBaby.name}
        </Text>
      </Pressable>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 pb-6"
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-3">
            {t("health.logTime")}
          </Text>

          <View className="flex-row gap-3 mb-6">
            <Pressable
              onPress={() => Platform.OS === "ios" ? setShowDateTimePicker(true) : setShowDatePicker(true)}
              className="flex-1 flex-row items-center justify-between rounded-card-lg px-4 py-3"
              style={{ backgroundColor: colors.mutedBg }}
              accessibilityRole="button"
              accessibilityLabel={t("health.selectDate")}
            >
              <Text className="text-base" style={{ color: colors.textOnMuted }}>
                {formatDate(loggedAt)}
              </Text>
              <Text style={{ color: colors.accent }}>📅</Text>
            </Pressable>

            <Pressable
              onPress={() => Platform.OS === "ios" ? setShowDateTimePicker(true) : setShowTimePicker(true)}
              className="flex-1 flex-row items-center justify-between rounded-card-lg px-4 py-3"
              style={{ backgroundColor: colors.mutedBg }}
              accessibilityRole="button"
              accessibilityLabel={t("health.selectTime")}
            >
              <Text className="text-base" style={{ color: colors.textOnMuted }}>
                {formatDateDisplay(loggedAt)}
              </Text>
              <Text style={{ color: colors.accent }}>🕐</Text>
            </Pressable>
          </View>

          {showDateTimePicker && Platform.OS === "ios" && (
            <View className="mb-4">
              <View className="flex-row justify-end px-2">
                <Pressable
                  onPress={() => setShowDateTimePicker(false)}
                  className="py-1 px-3"
                >
                  <Text className="text-sm font-semibold" style={{ color: colors.accent }}>
                    {t("common.done")}
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={loggedAt}
                mode="datetime"
                display="spinner"
                onChange={handleDateTimeChange}
                maximumDate={new Date()}
              />
            </View>
          )}

          {showDatePicker && Platform.OS === "android" && (
            <DateTimePicker
              value={loggedAt}
              mode="date"
              display="default"
              onChange={handleDateChange}
              maximumDate={new Date()}
            />
          )}

          {showTimePicker && Platform.OS === "android" && (
            <DateTimePicker
              value={loggedAt}
              mode="time"
              display="default"
              onChange={handleTimeChange}
            />
          )}

          <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-3">
            {t("health.selectType")}
          </Text>

          <View className="gap-3 mb-6">
            <HealthTypeButton
              type="medication"
              label={t("health.medication")}
              icon="💊"
              isSelected={selectedType === "medication"}
              onPress={() => handleTypeSelect("medication")}
              accentColor={colors.accent}
              mutedColor={colors.mutedBg}
              textColor={colors.textOnMuted}
            />
            <HealthTypeButton
              type="temperature"
              label={t("health.temperature")}
              icon="🌡️"
              isSelected={selectedType === "temperature"}
              onPress={() => handleTypeSelect("temperature")}
              accentColor={colors.accent}
              mutedColor={colors.mutedBg}
              textColor={colors.textOnMuted}
            />
            <HealthTypeButton
              type="vaccination"
              label={t("health.vaccination")}
              icon="💉"
              isSelected={selectedType === "vaccination"}
              onPress={() => handleTypeSelect("vaccination")}
              accentColor={colors.accent}
              mutedColor={colors.mutedBg}
              textColor={colors.textOnMuted}
            />
            <HealthTypeButton
              type="symptom"
              label={t("health.symptomsLabel")}
              icon="🤒"
              isSelected={selectedType === "symptom"}
              onPress={() => handleTypeSelect("symptom")}
              accentColor={colors.accent}
              mutedColor={colors.mutedBg}
              textColor={colors.textOnMuted}
            />
          </View>

          {selectedType === "medication" && (
            <>
              <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-3">
                {t("health.selectMedication")}
              </Text>

              <View className="flex-row flex-wrap gap-2 mb-6">
                {COMMON_MEDICATION_KEYS.map(key => {
                  const label = t(`health.commonMedication.${key}`);
                  return (
                    <Pressable
                      key={key}
                      onPress={() => {
                        setMedicationName(label);
                        setCustomMedicationName("");
                      }}
                      className={`px-4 py-2 rounded-full active:scale-[0.95] ${
                        medicationName === label
                          ? ""
                          : "bg-surface-secondary dark:bg-surface-dark-secondary"
                      }`}
                      style={medicationName === label ? { backgroundColor: colors.accent } : undefined}
                    >
                      <Text
                        className={`text-sm font-medium ${
                          medicationName === label
                            ? "text-white"
                            : "text-content-primary dark:text-content-dark-primary"
                        }`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => {
                    setMedicationName("custom");
                    setCustomMedicationName("");
                  }}
                  className={`px-4 py-2 rounded-full active:scale-[0.95] ${
                    medicationName === "custom"
                      ? ""
                      : "bg-surface-secondary dark:bg-surface-dark-secondary"
                  }`}
                  style={medicationName === "custom" ? { backgroundColor: colors.accent } : undefined}
                >
                  <Text
                    className={`text-sm font-medium ${
                      medicationName === "custom"
                        ? "text-white"
                        : "text-content-primary dark:text-content-dark-primary"
                    }`}
                  >
                    + {t("common.custom")}
                  </Text>
                </Pressable>
              </View>

              {medicationName === "custom" && (
                <View className="mb-6">
                  <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
                    {t("health.medicationName")}
                  </Text>
                  <TextInput
                    value={customMedicationName}
                    onChangeText={setCustomMedicationName}
                    placeholder={t("health.medicationNamePlaceholder")}
                    className="px-4 py-3 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-base text-content-primary dark:text-content-dark-primary"
                    placeholderTextColor="#999"
                  />
                </View>
              )}

              <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
                {t("health.dosage")} ({t("common.optional")})
              </Text>

              <View className="flex-row gap-2 mb-6">
                {[2.5, 5, 7.5, 10].map(ml => (
                  <Pressable
                    key={ml}
                    onPress={() => setDosageMl(ml)}
                    className={`px-3 py-2 rounded-full active:scale-[0.95] ${
                      dosageMl === ml
                        ? ""
                        : "bg-surface-secondary dark:bg-surface-dark-secondary"
                    }`}
                    style={dosageMl === ml ? { backgroundColor: colors.accent } : undefined}
                  >
                    <Text
                      className={`text-sm ${
                        dosageMl === ml
                          ? "text-white"
                          : "text-content-secondary dark:text-content-dark-secondary"
                      }`}
                    >
                      {formatVolume(ml, volumeUnit)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
                {t("health.reminderInterval")} ({t("common.optional")})
              </Text>

              <View className="flex-row gap-2 mb-6">
                {[4, 6, 8].map(hours => (
                  <Pressable
                    key={hours}
                    onPress={() => setReminderHours(reminderHours === hours ? null : hours)}
                    className={`px-3 py-2 rounded-full active:scale-[0.95] ${
                      reminderHours === hours
                        ? ""
                        : "bg-surface-secondary dark:bg-surface-dark-secondary"
                    }`}
                    style={reminderHours === hours ? { backgroundColor: colors.accent } : undefined}
                  >
                    <Text
                      className={`text-sm ${
                        reminderHours === hours
                          ? "text-white"
                          : "text-content-secondary dark:text-content-dark-secondary"
                      }`}
                    >
                      {hours}h
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => setReminderHours(null)}
                  className={`px-3 py-2 rounded-full active:scale-[0.95] ${
                    reminderHours === null
                      ? ""
                      : "bg-surface-secondary dark:bg-surface-dark-secondary"
                  }`}
                  style={reminderHours === null ? { backgroundColor: colors.accent } : undefined}
                >
                  <Text
                    className={`text-sm ${
                      reminderHours === null
                        ? "text-white"
                        : "text-content-secondary dark:text-content-dark-secondary"
                    }`}
                  >
                    {t("health.noReminder")}
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          {selectedType === "temperature" && (
            <>
              <View className="items-center mb-6">
                <View
                  className="w-32 h-32 rounded-full items-center justify-center mb-4"
                  style={{ backgroundColor: feverColor[isDark ? "dark" : "light"] }}
                >
                  <Text className="text-5xl">🌡️</Text>
                </View>
                <View className="flex-row items-center justify-center gap-4">
                  <Pressable
                    onPress={() => setTemperatureCelsius(prev =>
                      Math.max(TEMP_RANGE_CELSIUS.min, Number((prev - (temperatureUnit === "°F" ? 5 / 18 : 0.1)).toFixed(1)))
                    )}
                    className="w-12 h-12 rounded-full items-center justify-center active:scale-[0.95]"
                    style={{ backgroundColor: colors.mutedBg }}
                  >
                    <Text className="text-2xl font-bold" style={{ color: colors.accent }}>−</Text>
                  </Pressable>
                  <Text className="text-4xl font-bold text-content-primary dark:text-content-dark-primary">
                    {displayTemperature.toFixed(1)}°
                  </Text>
                  <Pressable
                    onPress={() => setTemperatureCelsius(prev =>
                      Math.min(TEMP_RANGE_CELSIUS.max, Number((prev + (temperatureUnit === "°F" ? 5 / 18 : 0.1)).toFixed(1)))
                    )}
                    className="w-12 h-12 rounded-full items-center justify-center active:scale-[0.95]"
                    style={{ backgroundColor: colors.mutedBg }}
                  >
                    <Text className="text-2xl font-bold" style={{ color: colors.accent }}>+</Text>
                  </Pressable>
                </View>
                <Text
                  className="text-base font-medium mt-2"
                  style={{ color: feverColor[isDark ? "dark" : "light"] }}
                >
                  {t(`health.feverStatus.${feverStatus}`)}
                </Text>
              </View>

              <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-3">
                {t("health.quickTemperatures")}
              </Text>

              <View className="flex-row flex-wrap gap-2 mb-6">
                {QUICK_TEMPS_CELSIUS.map(temp => {
                  const displayTemp = temperatureUnit === "°F" ? celsiusToFahrenheit(temp) : temp;
                  return (
                    <Pressable
                      key={temp}
                      onPress={() => setTemperatureCelsius(temp)}
                      className={`px-4 py-2 rounded-full active:scale-[0.95] ${
                        temperatureCelsius === temp
                          ? ""
                          : "bg-surface-secondary dark:bg-surface-dark-secondary"
                      }`}
                      style={temperatureCelsius === temp ? { backgroundColor: colors.accent } : undefined}
                    >
                      <Text
                        className={`text-sm font-medium ${
                          temperatureCelsius === temp
                            ? "text-white"
                            : "text-content-primary dark:text-content-dark-primary"
                        }`}
                      >
                        {displayTemp.toFixed(1)}°
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
                {t("health.measurementMethodLabel")} ({t("common.optional")})
              </Text>

              <View className="flex-row flex-wrap gap-2 mb-6">
                {MEASUREMENT_METHODS.map((method: MeasurementMethod) => (
                  <Pressable
                    key={method}
                    onPress={() => setMeasurementMethod(measurementMethod === method ? null : method)}
                    className={`px-3 py-2 rounded-full active:scale-[0.95] ${
                      measurementMethod === method
                        ? ""
                        : "bg-surface-secondary dark:bg-surface-dark-secondary"
                    }`}
                    style={measurementMethod === method ? { backgroundColor: colors.accent } : undefined}
                  >
                    <Text
                      className={`text-sm ${
                        measurementMethod === method
                          ? "text-white"
                          : "text-content-secondary dark:text-content-dark-secondary"
                      }`}
                    >
                      {t(`health.measurementMethod.${method}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {selectedType === "vaccination" && (
            <>
              <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-3">
                {t("health.selectVaccine")}
              </Text>

              <View className="flex-row flex-wrap gap-2 mb-6">
                {COMMON_VACCINE_KEYS.map(key => {
                  const label = t(`health.commonVaccine.${key}`);
                  return (
                    <Pressable
                      key={key}
                      onPress={() => {
                        setVaccineName(label);
                        setCustomVaccineName("");
                      }}
                      className={`px-4 py-2 rounded-full active:scale-[0.95] ${
                        vaccineName === label
                          ? ""
                          : "bg-surface-secondary dark:bg-surface-dark-secondary"
                      }`}
                      style={vaccineName === label ? { backgroundColor: colors.accent } : undefined}
                    >
                      <Text
                        className={`text-sm font-medium ${
                          vaccineName === label
                            ? "text-white"
                            : "text-content-primary dark:text-content-dark-primary"
                        }`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => {
                    setVaccineName("custom");
                    setCustomVaccineName("");
                  }}
                  className={`px-4 py-2 rounded-full active:scale-[0.95] ${
                    vaccineName === "custom"
                      ? ""
                      : "bg-surface-secondary dark:bg-surface-dark-secondary"
                  }`}
                  style={vaccineName === "custom" ? { backgroundColor: colors.accent } : undefined}
                >
                  <Text
                    className={`text-sm font-medium ${
                      vaccineName === "custom"
                        ? "text-white"
                        : "text-content-primary dark:text-content-dark-primary"
                    }`}
                  >
                    + {t("common.custom")}
                  </Text>
                </Pressable>
              </View>

              {vaccineName === "custom" && (
                <View className="mb-6">
                  <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
                    {t("health.vaccineName")}
                  </Text>
                  <TextInput
                    value={customVaccineName}
                    onChangeText={setCustomVaccineName}
                    placeholder={t("health.vaccineNamePlaceholder")}
                    className="px-4 py-3 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-base text-content-primary dark:text-content-dark-primary"
                    placeholderTextColor="#999"
                  />
                </View>
              )}
            </>
          )}

          {selectedType === "symptom" && (
            <>
              <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-3">
                {t("health.selectSymptoms")}
              </Text>

              <View className="flex-row flex-wrap gap-2 mb-6">
                {SYMPTOM_OPTIONS.map(symptom => (
                  <Pressable
                    key={symptom}
                    onPress={() => handleSymptomToggle(symptom)}
                    className={`px-4 py-2 rounded-full active:scale-[0.95] ${
                      selectedSymptoms.includes(symptom)
                        ? ""
                        : "bg-surface-secondary dark:bg-surface-dark-secondary"
                    }`}
                    style={selectedSymptoms.includes(symptom) ? { backgroundColor: colors.accent } : undefined}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        selectedSymptoms.includes(symptom)
                          ? "text-white"
                          : "text-content-primary dark:text-content-dark-primary"
                      }`}
                    >
                      {t(`health.symptom.${symptom}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {selectedType && (
            <View className="mb-6">
              <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
                {t("common.notes")} ({t("common.optional")})
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={t("health.notesPlaceholder")}
                multiline
                numberOfLines={3}
                className="h-24 px-4 py-3 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-base text-content-primary dark:text-content-dark-primary"
                placeholderTextColor="#999"
                textAlignVertical="top"
              />
            </View>
          )}
        </ScrollView>

        <View className="px-6 pb-6">
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            className={`w-full py-4 rounded-button-lg items-center justify-center active:scale-[0.98] ${
              !canSave ? "opacity-50" : ""
            }`}
            style={{ backgroundColor: colors.accent }}
            accessibilityRole="button"
            accessibilityLabel={t("health.logHealth")}
            testID="save-button"
          >
            <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "700", fontFamily: "System" }}>
              {isSaving ? t("common.loading") : t("health.logHealth")}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface HealthTypeButtonProps {
  type: HealthType;
  label: string;
  icon: string;
  isSelected: boolean;
  onPress: () => void;
  accentColor: string;
  mutedColor: string;
  textColor: string;
}

function HealthTypeButton({
  type: _type,
  label,
  icon,
  isSelected,
  onPress,
  accentColor,
  mutedColor,
  textColor,
}: HealthTypeButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center p-4 rounded-card-lg active:scale-[0.98] ${
        isSelected ? "" : "bg-surface-secondary dark:bg-surface-dark-secondary"
      }`}
      style={isSelected ? { backgroundColor: mutedColor } : undefined}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      testID={`type-${_type}`}
    >
      <Text className="text-3xl mr-4">{icon}</Text>
      <View className="flex-1">
        <Text
          className={`text-base font-medium ${
            isSelected
              ? ""
              : "text-content-primary dark:text-content-dark-primary"
          }`}
          style={isSelected ? { color: textColor } : undefined}
        >
          {label}
        </Text>
      </View>
      {isSelected && (
        <View
          className="w-6 h-6 rounded-full items-center justify-center"
          style={{ backgroundColor: accentColor }}
        >
          <Text className="text-white text-sm">✓</Text>
        </View>
      )}
    </Pressable>
  );
}
