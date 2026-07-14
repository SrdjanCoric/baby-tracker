import { useCallback, useRef, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
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
import type { HealthType, MeasurementMethod, SymptomType, DosageUnit } from "@/constants/activities";
import { COMMON_MEDICATION_KEYS, COMMON_VACCINE_KEYS, SYMPTOM_OPTIONS, MEASUREMENT_METHODS, DOSAGE_UNITS, DOSAGE_QUICK_VALUES } from "@/constants/activities";
import { CDC_VACCINE_SCHEDULE, getNextDoseNumber } from "@/constants/vaccine-schedule";
import { ACTIVITY, TEXT } from "@/constants/colors";
import { getFeverStatus, getFeverColor, QUICK_TEMPS_CELSIUS, DEFAULT_TEMP_CELSIUS, TEMP_RANGE_CELSIUS, celsiusToFahrenheit } from "@/utils/temperature";
import { getHealthDisplayName } from "@/utils/health-display";

const HEALTH_ACCENT = ACTIVITY.health.accent;
const HEALTH_ACCENT_DARK = ACTIVITY.health.accentDark;

export default function ManualHealthScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { selectedBaby } = useBaby();
  const { timeFormat } = useTimeFormat();
  const { addHealth, healthEntries, getCompletedVaccinations } = useHealth();
  const { colorScheme } = useColorScheme();
  const { temperatureUnit } = useUnits();
  const isDark = colorScheme === "dark";

  const colors = {
    accent: isDark ? HEALTH_ACCENT_DARK : HEALTH_ACCENT,
    mutedBg: isDark ? ACTIVITY.health.mutedDark : ACTIVITY.health.muted,
    textOnMuted: isDark ? ACTIVITY.health.textAccentDark : ACTIVITY.health.textAccent,
  };

  const [selectedType, setSelectedType] = useState<HealthType | null>(null);
  const [medicationName, setMedicationName] = useState("");
  const [customMedicationName, setCustomMedicationName] = useState("");
  const [dosageAmount, setDosageAmount] = useState<number | null>(null);
  const [dosageUnit, setDosageUnit] = useState<DosageUnit>("ml");
  const [customDosage, setCustomDosage] = useState("");
  const [temperatureCelsius, setTemperatureCelsius] = useState<number>(DEFAULT_TEMP_CELSIUS);
  const [measurementMethod, setMeasurementMethod] = useState<MeasurementMethod | null>(null);
  const [vaccineName, setVaccineName] = useState("");
  const [customVaccineName, setCustomVaccineName] = useState("");
  const [doseNumber, setDoseNumber] = useState<number | null>(null);
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
    setDosageAmount(null);
    setDosageUnit("ml");
    setCustomDosage("");
    setTemperatureCelsius(DEFAULT_TEMP_CELSIUS);
    setMeasurementMethod(null);
    setVaccineName("");
    setCustomVaccineName("");
    setDoseNumber(null);
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
      if (dosageAmount) {
        base.dosageAmount = dosageAmount;
        base.dosageUnit = dosageUnit;
      }
    } else if (selectedType === "temperature") {
      base.temperatureCelsius = temperatureCelsius;
      if (measurementMethod) base.measurementMethod = measurementMethod;
    } else if (selectedType === "vaccination") {
      const finalVaccineName = vaccineName === "custom" ? customVaccineName : vaccineName;
      if (!finalVaccineName) return;
      base.vaccineName = finalVaccineName;
      if (doseNumber) {
        base.doseNumber = doseNumber;
      } else {
        const scheduleEntry = CDC_VACCINE_SCHEDULE.find(e => e.key === vaccineName);
        if (scheduleEntry) {
          const allCompleted = getCompletedVaccinations();
          const completedDoses = allCompleted.filter(c => c.vaccineName === vaccineName);
          base.doseNumber = getNextDoseNumber(vaccineName, completedDoses);
        }
      }
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
    } catch {
      Alert.alert(t("common.error"), t("health.saveError"));
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [selectedBaby, selectedType, medicationName, customMedicationName, dosageAmount, dosageUnit, temperatureCelsius, measurementMethod, vaccineName, customVaccineName, doseNumber, selectedSymptoms, notes, loggedAt, addHealth, router, getCompletedVaccinations, t]);

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

  const feverStatus = getFeverStatus(temperatureCelsius, measurementMethod);
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
                        setMedicationName(key);
                        setCustomMedicationName("");
                      }}
                      className={`px-4 py-2 rounded-full active:scale-[0.95] ${
                        medicationName === key
                          ? ""
                          : "bg-surface-secondary dark:bg-surface-dark-secondary"
                      }`}
                      style={medicationName === key ? { backgroundColor: colors.accent } : undefined}
                    >
                      <Text
                        className={`text-sm font-medium ${
                          medicationName === key
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
                    maxLength={50}
                    className="px-4 py-3 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-base text-content-primary dark:text-content-dark-primary"
                    placeholderTextColor="#999"
                  />
                </View>
              )}

              <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
                {t("health.dosageUnit")} ({t("common.optional")})
              </Text>

              <View className="flex-row gap-2 mb-4">
                {DOSAGE_UNITS.map(unit => {
                  let unitLabel = "";
                  if (unit === "ml") unitLabel = t("health.unitMl");
                  else if (unit === "mg") unitLabel = t("health.unitMg");
                  else if (unit === "drops") unitLabel = t("health.unitDrops", { count: 2 });
                  else if (unit === "tsp") unitLabel = t("health.unitTsp");

                  return (
                    <Pressable
                      key={unit}
                      onPress={() => {
                        setDosageUnit(unit);
                        setDosageAmount(null);
                        setCustomDosage("");
                      }}
                      className={`px-4 py-2 rounded-full active:scale-[0.95] ${
                        dosageUnit === unit
                          ? ""
                          : "bg-surface-secondary dark:bg-surface-dark-secondary"
                      }`}
                      style={dosageUnit === unit ? { backgroundColor: colors.accent } : undefined}
                    >
                      <Text
                        className={`text-sm font-medium ${
                          dosageUnit === unit
                            ? "text-white"
                            : "text-content-primary dark:text-content-dark-primary"
                        }`}
                      >
                        {unitLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View className="flex-row flex-wrap gap-2 mb-3">
                {DOSAGE_QUICK_VALUES[dosageUnit].map(val => {
                  let unitLabel = "";
                  if (dosageUnit === "ml") unitLabel = t("health.unitMl");
                  else if (dosageUnit === "mg") unitLabel = t("health.unitMg");
                  else if (dosageUnit === "drops") unitLabel = t("health.unitDrops", { count: val });

                  return (
                    <Pressable
                      key={val}
                      onPress={() => {
                        setDosageAmount(val);
                        setCustomDosage(val.toString());
                      }}
                      className={`px-3 py-2 rounded-full active:scale-[0.95] ${
                        dosageAmount === val
                          ? ""
                          : "bg-surface-secondary dark:bg-surface-dark-secondary"
                      }`}
                      style={dosageAmount === val ? { backgroundColor: colors.accent } : undefined}
                    >
                      <Text
                        className={`text-sm ${
                          dosageAmount === val
                            ? "text-white"
                            : "text-content-secondary dark:text-content-dark-secondary"
                        }`}
                      >
                        {val} {unitLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                value={customDosage}
                onChangeText={(text) => {
                  setCustomDosage(text);
                  const val = parseFloat(text);
                  if (!isNaN(val) && val > 0) {
                    setDosageAmount(val);
                  } else {
                    setDosageAmount(null);
                  }
                }}
                placeholder={t("health.customDosage")}
                keyboardType="decimal-pad"
                className="px-4 py-3 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-base text-content-primary dark:text-content-dark-primary mb-6"
                placeholderTextColor="#999"
              />
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
                        setVaccineName(key);
                        setCustomVaccineName("");
                        setDoseNumber(null);
                      }}
                      className={`px-4 py-2 rounded-full active:scale-[0.95] ${
                        vaccineName === key
                          ? ""
                          : "bg-surface-secondary dark:bg-surface-dark-secondary"
                      }`}
                      style={vaccineName === key ? { backgroundColor: colors.accent } : undefined}
                    >
                      <Text
                        className={`text-sm font-medium ${
                          vaccineName === key
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
                    setDoseNumber(null);
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
                    maxLength={50}
                    className="px-4 py-3 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-base text-content-primary dark:text-content-dark-primary"
                    placeholderTextColor="#999"
                  />
                </View>
              )}

              {vaccineName === "custom" && (
                <View className="mb-6">
                  <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
                    {t("health.customDose")} ({t("common.optional")})
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map(num => (
                      <Pressable
                        key={num}
                        onPress={() => setDoseNumber(doseNumber === num ? null : num)}
                        className={`w-10 h-10 rounded-full items-center justify-center active:scale-[0.95] ${
                          doseNumber === num
                            ? ""
                            : "bg-surface-secondary dark:bg-surface-dark-secondary"
                        }`}
                        style={doseNumber === num ? { backgroundColor: colors.accent } : undefined}
                      >
                        <Text
                          className={`text-sm font-medium ${
                            doseNumber === num
                              ? "text-white"
                              : "text-content-primary dark:text-content-dark-primary"
                          }`}
                        >
                          {num}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {vaccineName && vaccineName !== "custom" && (() => {
                const scheduleEntry = CDC_VACCINE_SCHEDULE.find(e => e.key === vaccineName);
                if (!scheduleEntry) return null;

                const allCompleted = getCompletedVaccinations();
                const completedDoses = allCompleted.filter(c => c.vaccineName === vaccineName);

                const nextDose = getNextDoseNumber(vaccineName, completedDoses);
                const allDone = completedDoses.length >= scheduleEntry.totalDoses;
                const effectiveNext = allDone ? null : nextDose;

                return (
                  <View className="mb-6">
                    {allDone ? (
                      <View
                        className="flex-row items-center gap-2 py-3 px-4 rounded-button-lg mb-2"
                        style={{ backgroundColor: isDark ? "#16a34a20" : "#22c55e15" }}
                      >
                        <Text className="text-lg">✅</Text>
                        <Text className="text-sm font-medium" style={{ color: isDark ? "#4ade80" : "#22c55e" }}>
                          {t("health.allDosesCompleted")}
                        </Text>
                      </View>
                    ) : (
                      <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-2">
                        {t("health.doseOf", { current: doseNumber || effectiveNext, total: scheduleEntry.totalDoses })}
                      </Text>
                    )}
                    <View className="flex-row flex-wrap gap-2">
                      {Array.from({ length: scheduleEntry.totalDoses }, (_, i) => i + 1).map(num => {
                        const isCompleted = completedDoses.some(d => d.doseNumber === num);
                        return (
                          <Pressable
                            key={num}
                            onPress={() => setDoseNumber(num)}
                            className={`w-10 h-10 rounded-full items-center justify-center active:scale-[0.95] ${
                              (doseNumber || effectiveNext) === num
                                ? ""
                                : isCompleted
                                  ? ""
                                  : "bg-surface-secondary dark:bg-surface-dark-secondary"
                            }`}
                            style={
                              (doseNumber || effectiveNext) === num
                                ? { backgroundColor: colors.accent }
                                : isCompleted
                                  ? { backgroundColor: isDark ? "#4ade80" : "#22c55e" }
                                  : undefined
                            }
                          >
                            <Text
                              className={`text-sm font-medium ${
                                (doseNumber || effectiveNext) === num || isCompleted
                                  ? "text-white"
                                  : "text-content-primary dark:text-content-dark-primary"
                              }`}
                            >
                              {num}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <View
                      className="rounded-xl p-3 mt-2 mb-6"
                      style={{ backgroundColor: isDark ? ACTIVITY.health.mutedDark : ACTIVITY.health.muted }}
                    >
                      <View className="flex-row items-center justify-between px-1">
                        {scheduleEntry.doses.map((dose) => {
                          const isGiven = completedDoses.some(d => d.doseNumber === dose.doseNumber);
                          const isNext = !isGiven && dose.doseNumber === effectiveNext;
                          const successColor = isDark ? "#4ade80" : "#22c55e";
                          const warningColor = isDark ? "#fbbf24" : "#f59e0b";
                          const neutralColor = isDark ? "#9ca3af" : "#6b7280";

                          const ageLabel = dose.recommendedAgeMonths === 0
                            ? t("health.ageBirth")
                            : dose.recommendedAgeMonths >= 24
                              ? `${Math.floor(dose.recommendedAgeMonths / 12)} ${t("health.yrShort")}`
                              : `${dose.recommendedAgeMonths} ${t("health.moShort")}`;

                          return (
                            <View key={dose.doseNumber} className="items-center" style={{ flex: 1 }}>
                              <View
                                style={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: 13,
                                  alignItems: "center",
                                  justifyContent: "center",
                                  backgroundColor: isGiven ? successColor : isNext ? "transparent" : "transparent",
                                  borderWidth: isGiven ? 0 : 2,
                                  borderColor: isGiven ? successColor : isNext ? warningColor : neutralColor,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 10,
                                    fontWeight: "700",
                                    color: isGiven ? "#fff" : isNext ? warningColor : neutralColor,
                                  }}
                                >
                                  {isGiven ? "✓" : dose.doseNumber}
                                </Text>
                              </View>
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontWeight: "600",
                                  marginTop: 4,
                                  color: isNext ? warningColor : isDark ? TEXT.dark.tertiary : TEXT.light.tertiary,
                                }}
                              >
                                {ageLabel}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                );
              })()}
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
  type,
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
      testID={`type-${type}`}
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
