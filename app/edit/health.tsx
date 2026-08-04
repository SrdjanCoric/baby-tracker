import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import { useHealth } from "@/contexts/health-context";
import { useBaby, useTimeFormat, useUnits } from "@/contexts";
import { formatDate, formatTime } from "@/utils/time";
import { getFeverStatus, getFeverColor, celsiusToFahrenheit, fahrenheitToCelsius, TEMP_RANGE_CELSIUS } from "@/utils/temperature";
import type { UpdateHealthInput } from "@/services/health-storage";
import type { HealthType, MeasurementMethod, SymptomType, DosageUnit } from "@/constants/activities";
import { SYMPTOM_OPTIONS, MEASUREMENT_METHODS, DOSAGE_UNITS } from "@/constants/activities";
import { ACTIVITY } from "@/constants/colors";
import { getHealthDisplayName } from "@/utils/health-display";
import { exitModal } from "@/navigation";

const HEALTH_COLORS = {
  accent: { light: ACTIVITY.health.accent, dark: ACTIVITY.health.accentDark },
  muted: { light: ACTIVITY.health.muted, dark: ACTIVITY.health.mutedDark },
};

export default function EditHealthScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectedBaby } = useBaby();
  const { timeFormat } = useTimeFormat();
  const { healthEntries, updateHealth, deleteHealth } = useHealth();
  const { temperatureUnit } = useUnits();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const accentColor = isDark ? HEALTH_COLORS.accent.dark : HEALTH_COLORS.accent.light;
  const mutedColor = isDark ? HEALTH_COLORS.muted.dark : HEALTH_COLORS.muted.light;

  const health = useMemo(() => {
    return healthEntries.find(h => h.id === id) ?? null;
  }, [healthEntries, id]);

  const [healthType, setHealthType] = useState<HealthType>("medication");
  const [medicationName, setMedicationName] = useState("");
  const [dosageAmount, setDosageAmount] = useState<number | undefined>(undefined);
  const [dosageUnit, setDosageUnit] = useState<DosageUnit>("ml");
  const [doseNumber, setDoseNumber] = useState<number | undefined>(undefined);
  const [temperatureCelsius, setTemperatureCelsius] = useState<number>(36.5);
  const [measurementMethod, setMeasurementMethod] = useState<MeasurementMethod | undefined>(undefined);
  const [vaccineName, setVaccineName] = useState("");
  const [symptoms, setSymptoms] = useState<SymptomType[]>([]);
  const [notes, setNotes] = useState("");
  const [loggedAt, setLoggedAt] = useState(new Date());
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (health && !isInitialized) {
      setHealthType(health.type);
      setMedicationName(health.medicationName ?? "");
      setDosageAmount(health.dosageAmount);
      setDosageUnit(health.dosageUnit ?? "ml");
      setDoseNumber(health.doseNumber);
      setTemperatureCelsius(health.temperatureCelsius ?? 36.5);
      setMeasurementMethod(health.measurementMethod);
      setVaccineName(health.vaccineName ?? "");
      setSymptoms(health.symptoms ?? []);
      setNotes(health.notes ?? "");
      setLoggedAt(new Date(health.loggedAt));
      setIsInitialized(true);
    }
  }, [health, isInitialized]);

  const hasChanges = useMemo(() => {
    if (!health || !isInitialized) return false;

    if (healthType !== health.type) return true;
    if (medicationName !== (health.medicationName ?? "")) return true;
    if (dosageAmount !== health.dosageAmount) return true;
    if (dosageUnit !== (health.dosageUnit ?? "ml")) return true;
    if (doseNumber !== health.doseNumber) return true;
    if (temperatureCelsius !== (health.temperatureCelsius ?? 36.5)) return true;
    if (measurementMethod !== health.measurementMethod) return true;
    if (vaccineName !== (health.vaccineName ?? "")) return true;
    if (JSON.stringify(symptoms) !== JSON.stringify(health.symptoms ?? [])) return true;
    if (notes !== (health.notes ?? "")) return true;
    if (loggedAt.toISOString() !== health.loggedAt) return true;

    return false;
  }, [health, isInitialized, healthType, medicationName, dosageAmount, dosageUnit, doseNumber, temperatureCelsius, measurementMethod, vaccineName, symptoms, notes, loggedAt]);

  usePreventRemove(hasChanges, ({ data }) => {
    Alert.alert(
      t("timeline.discardChangesTitle"),
      t("timeline.discardChangesMessage"),
      [
        { text: t("timeline.keepEditing"), style: "cancel" },
        {
          text: t("timeline.discard"),
          style: "destructive",
          onPress: () => navigation.dispatch(data.action),
        },
      ]
    );
  });

  const handleSymptomToggle = useCallback((symptom: SymptomType) => {
    setSymptoms(prev =>
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
    if (!selectedBaby || !health) return;

    setIsSaving(true);
    try {
      const updateData: UpdateHealthInput = {
        type: healthType,
        medicationName: null,
        dosageAmount: null,
        dosageUnit: null,
        temperatureCelsius: null,
        measurementMethod: null,
        vaccineName: null,
        doseNumber: null,
        symptoms: null,
      };

      if (healthType === "medication") {
        updateData.medicationName = medicationName || undefined;
        updateData.dosageAmount = dosageAmount;
        updateData.dosageUnit = dosageUnit;
      } else if (healthType === "temperature") {
        updateData.temperatureCelsius = Math.min(TEMP_RANGE_CELSIUS.max, Math.max(TEMP_RANGE_CELSIUS.min, temperatureCelsius));
        updateData.measurementMethod = measurementMethod;
      } else if (healthType === "vaccination") {
        updateData.vaccineName = vaccineName || undefined;
        updateData.doseNumber = doseNumber;
      } else if (healthType === "symptom") {
        updateData.symptoms = symptoms.length > 0 ? symptoms : undefined;
      }

      updateData.notes = notes || undefined;
      updateData.loggedAt = loggedAt;

      await updateHealth(health.id, updateData);
      setIsInitialized(false);
      exitModal(router);
    } finally {
      setIsSaving(false);
    }
  }, [selectedBaby, health, healthType, medicationName, dosageAmount, dosageUnit, doseNumber, temperatureCelsius, measurementMethod, vaccineName, symptoms, notes, loggedAt, updateHealth, router]);

  const canSave = !isSaving && hasChanges && (
    (healthType === "medication" && !!medicationName) ||
    (healthType === "temperature") ||
    (healthType === "vaccination" && !!vaccineName) ||
    (healthType === "symptom" && symptoms.length > 0)
  );

  const handleDelete = useCallback(() => {
    if (!health) return;

    Alert.alert(
      t("timeline.deleteConfirmTitle"),
      t("timeline.deleteConfirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            await deleteHealth(health.id);
            exitModal(router);
          },
        },
      ]
    );
  }, [health, deleteHealth, router, t]);

  if (!selectedBaby || !health) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark items-center justify-center">
        <Text className="text-content-secondary dark:text-content-dark-secondary">
          {t("common.loading")}
        </Text>
      </SafeAreaView>
    );
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
        <View className="flex-row items-center w-full px-4">
          <View className="w-touch" />
          <View className="flex-1 items-center">
            <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
              {t("timeline.editEntry")}
            </Text>
            <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
              {t("health.title")}
            </Text>
          </View>
          <Pressable
            onPress={handleDelete}
            className="w-touch h-touch items-center justify-center rounded-full active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
            accessibilityRole="button"
            accessibilityLabel={t("common.delete")}
          >
            <Text className="text-2xl">🗑️</Text>
          </Pressable>
        </View>
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
          <View className="items-center mb-6">
            <View
              className="w-20 h-20 rounded-full items-center justify-center"
              style={{ backgroundColor: mutedColor }}
            >
              <Text className="text-4xl">🏥</Text>
            </View>
          </View>

          <View className="flex-row gap-3 mb-6">
            <Pressable
              onPress={() => Platform.OS === "ios" ? setShowDateTimePicker(true) : setShowDatePicker(true)}
              className="flex-1 flex-row items-center justify-between rounded-card-lg px-4 py-3"
              style={{ backgroundColor: mutedColor }}
              accessibilityRole="button"
              accessibilityLabel={t("health.selectDate")}
            >
              <Text className="text-base text-content-primary dark:text-content-dark-primary">
                {formatDate(loggedAt)}
              </Text>
              <Text style={{ color: accentColor }}>📅</Text>
            </Pressable>

            <Pressable
              onPress={() => Platform.OS === "ios" ? setShowDateTimePicker(true) : setShowTimePicker(true)}
              className="flex-1 flex-row items-center justify-between rounded-card-lg px-4 py-3"
              style={{ backgroundColor: mutedColor }}
              accessibilityRole="button"
              accessibilityLabel={t("health.selectTime")}
            >
              <Text className="text-base text-content-primary dark:text-content-dark-primary">
                {formatTime(loggedAt, timeFormat)}
              </Text>
              <Text style={{ color: accentColor }}>🕐</Text>
            </Pressable>
          </View>

          {showDateTimePicker && Platform.OS === "ios" && (
            <View className="mb-4">
              <View className="flex-row justify-end px-2">
                <Pressable
                  onPress={() => setShowDateTimePicker(false)}
                  className="py-1 px-3"
                >
                  <Text className="text-sm font-semibold" style={{ color: accentColor }}>
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

          <View className="mb-4">
            <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
              {t("health.selectType")}
            </Text>
            <View className="flex-row gap-2">
              {(["medication", "temperature", "vaccination", "symptom"] as const).map((type) => {
                const labelKey = type === "symptom" ? "symptomsLabel" : type;
                return (
                <Pressable
                  key={type}
                  onPress={() => setHealthType(type)}
                  className={`flex-1 py-3 rounded-button-lg items-center ${
                    healthType === type ? "" : "bg-surface-secondary dark:bg-surface-dark-secondary"
                  }`}
                  style={healthType === type ? { backgroundColor: accentColor } : undefined}
                >
                  <Text
                    className={`text-base font-medium ${
                      healthType === type
                        ? "text-white"
                        : "text-content-primary dark:text-content-dark-primary"
                    }`}
                  >
                    {t(`health.${labelKey}`)}
                  </Text>
                </Pressable>
                );
              })}
            </View>
          </View>

          {healthType === "medication" && (
            <>
              <View className="mb-4">
                <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
                  {t("health.selectMedication")}
                </Text>
                <TextInput
                  value={getHealthDisplayName(medicationName, "medication", t)}
                  onChangeText={setMedicationName}
                  placeholder={t("health.medicationNamePlaceholder")}
                  className="px-4 py-3 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-base text-content-primary dark:text-content-dark-primary"
                  placeholderTextColor="#999"
                />
              </View>

              <View className="mb-4">
                <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
                  {t("health.dosageUnit")} ({t("common.optional")})
                </Text>
                <View className="flex-row gap-2 mb-3">
                  {DOSAGE_UNITS.map(unit => {
                    let unitLabel = "";
                    if (unit === "ml") unitLabel = t("health.unitMl");
                    else if (unit === "mg") unitLabel = t("health.unitMg");
                    else if (unit === "drops") unitLabel = t("health.unitDrops", { count: 2 });
                    else if (unit === "tsp") unitLabel = t("health.unitTsp");

                    return (
                      <Pressable
                        key={unit}
                        onPress={() => setDosageUnit(unit)}
                        className={`px-4 py-2 rounded-full active:scale-[0.95] ${
                          dosageUnit === unit
                            ? ""
                            : "bg-surface-secondary dark:bg-surface-dark-secondary"
                        }`}
                        style={dosageUnit === unit ? { backgroundColor: accentColor } : undefined}
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
              </View>

              <View className="mb-4">
                <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
                  {t("health.dosage")} ({t("common.optional")})
                </Text>
                <TextInput
                  value={dosageAmount ? dosageAmount.toString() : ""}
                  onChangeText={(text) => setDosageAmount(text ? parseFloat(text) : undefined)}
                  placeholder={t("health.dosagePlaceholder")}
                  keyboardType="decimal-pad"
                  className="px-4 py-3 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-base text-content-primary dark:text-content-dark-primary"
                  placeholderTextColor="#999"
                />
              </View>

            </>
          )}

          {healthType === "temperature" && (
            <>
              <View className="items-center mb-6">
                <View
                  className="w-24 h-24 rounded-full items-center justify-center mb-4"
                  style={{ backgroundColor: feverColor[isDark ? "dark" : "light"] }}
                >
                  <Text className="text-4xl">🌡️</Text>
                </View>
                <Text className="text-3xl font-bold text-content-primary dark:text-content-dark-primary">
                  {displayTemperature.toFixed(1)}°
                </Text>
              </View>

              <View className="mb-4">
                <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
                  {t("health.temperature")} ({temperatureUnit})
                </Text>
                <TextInput
                  value={displayTemperature.toFixed(1)}
                  onChangeText={(text) => {
                    const val = parseFloat(text);
                    if (!isNaN(val)) {
                      setTemperatureCelsius(temperatureUnit === "°F" ? fahrenheitToCelsius(val) : val);
                    }
                  }}
                  keyboardType="decimal-pad"
                  className="px-4 py-3 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-base text-content-primary dark:text-content-dark-primary"
                />
              </View>

              <View className="mb-4">
                <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
                  {t("health.measurementMethodLabel")} ({t("common.optional")})
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {MEASUREMENT_METHODS.map((method: MeasurementMethod) => (
                    <Pressable
                      key={method}
                      onPress={() => setMeasurementMethod(measurementMethod === method ? undefined : method)}
                      className={`px-3 py-2 rounded-full ${
                        measurementMethod === method
                          ? ""
                          : "bg-surface-secondary dark:bg-surface-dark-secondary"
                      }`}
                      style={measurementMethod === method ? { backgroundColor: accentColor } : undefined}
                    >
                      <Text
                        className={`text-sm ${
                          measurementMethod === method
                            ? "text-white"
                            : "text-content-primary dark:text-content-dark-primary"
                        }`}
                      >
                        {t(`health.measurementMethod.${method}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </>
          )}

          {healthType === "vaccination" && (
            <>
              <View className="mb-4">
                <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
                  {t("health.selectVaccine")}
                </Text>
                <TextInput
                  value={getHealthDisplayName(vaccineName, "vaccine", t)}
                  onChangeText={setVaccineName}
                  placeholder={t("health.vaccineNamePlaceholder")}
                  className="px-4 py-3 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg text-base text-content-primary dark:text-content-dark-primary"
                  placeholderTextColor="#999"
                />
              </View>
              {doseNumber && (
                <View className="mb-4">
                  <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
                    {t("health.doseOf", { current: doseNumber, total: 1 })} ({t("common.optional")})
                  </Text>
                  <Pressable
                    onPress={() => setDoseNumber(undefined)}
                    className="px-4 py-3 bg-surface-secondary dark:bg-surface-dark-secondary rounded-button-lg"
                  >
                    <Text className="text-base text-content-primary dark:text-content-dark-primary">
                      {t("health.doseLabel", { number: doseNumber })}
                    </Text>
                  </Pressable>
                </View>
              )}
            </>
          )}

          {healthType === "symptom" && (
            <>
              <View className="mb-4">
                <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-2">
                  {t("health.selectSymptoms")}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {SYMPTOM_OPTIONS.map((symptom) => (
                    <Pressable
                      key={symptom}
                      onPress={() => handleSymptomToggle(symptom)}
                      className={`px-4 py-2 rounded-full ${
                        symptoms.includes(symptom)
                          ? ""
                          : "bg-surface-secondary dark:bg-surface-dark-secondary"
                      }`}
                      style={symptoms.includes(symptom) ? { backgroundColor: accentColor } : undefined}
                    >
                      <Text
                        className={`text-sm ${
                          symptoms.includes(symptom)
                            ? "text-white"
                            : "text-content-primary dark:text-content-dark-primary"
                        }`}
                      >
                        {t(`health.symptom.${symptom}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </>
          )}

          <View>
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
        </ScrollView>

        <View className="px-6 pb-6">
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            className={`w-full py-4 rounded-button-lg items-center justify-center active:scale-[0.98] ${
              !canSave ? "opacity-50" : ""
            }`}
            style={{ backgroundColor: accentColor }}
            accessibilityRole="button"
            accessibilityLabel={t("common.save")}
          >
            <Text className="text-white text-lg font-semibold">
              {isSaving ? t("common.loading") : t("common.save")}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
