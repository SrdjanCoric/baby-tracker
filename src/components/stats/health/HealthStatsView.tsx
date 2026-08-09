import { useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useColorScheme } from "nativewind";
import { useHealth } from "@/contexts/health-context";
import { useBaby } from "@/contexts";
import { useUnits } from "@/contexts";
import type { StoredHealthEntry } from "@/services/health-storage";
import { ACTIVITY, SURFACE, TEXT as TEXT_COLORS, BORDER, SEMANTIC } from "@/constants/colors";
import { CDC_VACCINE_SCHEDULE } from "@/constants/vaccine-schedule";
import { formatTemperature, getFeverStatus } from "@/utils/temperature";
import { timeSince } from "@/utils/time";
import { StatsMetricCard } from "../StatsMetricCard";
import { getHealthDisplayName } from "@/utils/health-display";

function buildMedicationSubtitle(lastMed: StoredHealthEntry | null, t: TFunction): string {
  if (!lastMed || !lastMed.medicationName) {
    return t("stats.health.noEntries");
  }

  let subtitle = getHealthDisplayName(lastMed.medicationName, "medication", t);
  if (lastMed.dosageAmount !== undefined && lastMed.dosageAmount !== null) {
    subtitle += ` ${lastMed.dosageAmount}`;
    if (lastMed.dosageUnit) {
      const unitKey = `unit${lastMed.dosageUnit.charAt(0).toUpperCase() + lastMed.dosageUnit.slice(1)}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      subtitle += ` ${t(`health.${unitKey}` as any, { count: lastMed.dosageAmount })}`;
    }
  }
  return subtitle;
}

function getVaccineName(vaccineKey: string, t: TFunction): string {
  return getHealthDisplayName(vaccineKey, "vaccine", t);
}

function getSymptomName(symptomKey: string, t: TFunction): string {
  const symptomNames: Record<string, string> = {
    runny_nose: t("health.symptom.runny_nose"),
    vomiting: t("health.symptom.vomiting"),
    fussy: t("health.symptom.fussy"),
    lethargic: t("health.symptom.lethargic"),
    wont_eat: t("health.symptom.wont_eat"),
    rash: t("health.symptom.rash"),
    cough: t("health.symptom.cough"),
    congestion: t("health.symptom.congestion"),
    diarrhea: t("health.symptom.diarrhea"),
    ear_pulling: t("health.symptom.ear_pulling"),
    teething: t("health.symptom.teething"),
    excessive_crying: t("health.symptom.excessive_crying"),
    eye_discharge: t("health.symptom.eye_discharge"),
    skin_irritation: t("health.symptom.skin_irritation"),
  };
  return symptomNames[symptomKey] || symptomKey;
}

export function HealthStatsView() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { healthEntries, getCompletedVaccinations } = useHealth();
  const { selectedBaby } = useBaby();
  const { temperatureUnit } = useUnits();

  const accentColor = isDark ? ACTIVITY.health.accentDark : ACTIVITY.health.accent;
  const textAccent = isDark ? ACTIVITY.health.textAccentDark : ACTIVITY.health.textAccent;
  const cardBg = isDark ? SURFACE.dark.card : SURFACE.light.card;
  const textPrimary = isDark ? TEXT_COLORS.dark.primary : TEXT_COLORS.light.primary;
  const textSecondary = isDark ? TEXT_COLORS.dark.secondary : TEXT_COLORS.light.secondary;
  const textTertiary = isDark ? TEXT_COLORS.dark.tertiary : TEXT_COLORS.light.tertiary;
  const borderColor = isDark ? BORDER.dark.subtle : BORDER.light.subtle;
  const successLight = isDark ? SEMANTIC.success.dark : SEMANTIC.success.light;
  const warningLight = isDark ? SEMANTIC.warning.dark : SEMANTIC.warning.light;
  const errorLight = isDark ? SEMANTIC.error.dark : SEMANTIC.error.light;
  const neutralLight = isDark ? SEMANTIC.neutral.dark : SEMANTIC.neutral.light;
  const accentMuted = isDark ? `${accentColor}30` : `${accentColor}15`;
  const successMuted = isDark ? `${successLight}30` : `${successLight}15`;
  const warningMuted = isDark ? `${warningLight}30` : `${warningLight}15`;
  const errorMuted = isDark ? `${errorLight}30` : `${errorLight}15`;

  const stats = useMemo(() => {
    if (!selectedBaby) return null;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sortedEntries = healthEntries
      .filter((entry) => entry.babyId === selectedBaby.id)
      .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());

    const temperatureEntries = sortedEntries.filter((e) => e.type === "temperature");
    const medicationEntries = sortedEntries.filter((e) => e.type === "medication");
    const vaccinationEntries = sortedEntries.filter((e) => e.type === "vaccination");
    const symptomEntries = sortedEntries.filter((e) => e.type === "symptom");

    const latestTemp = temperatureEntries.length > 0 ? temperatureEntries[0] : null;

    const todaysMeds = medicationEntries.filter((e) => {
      const entryDate = new Date(e.loggedAt);
      return entryDate >= today;
    });
    const lastMed = todaysMeds.length > 0 ? todaysMeds[0] : null;

    const completedVaccinations = getCompletedVaccinations();
    const vaccineEntries = vaccinationEntries.length > 0 ? vaccinationEntries : null;

    const recentSymptoms = symptomEntries.filter((e) => {
      const entryDate = new Date(e.loggedAt);
      return entryDate >= thirtyDaysAgo;
    });

    const symptomsFrequency: Record<string, number> = {};
    recentSymptoms.forEach((entry) => {
      if (entry.symptoms && Array.isArray(entry.symptoms)) {
        entry.symptoms.forEach((symptom) => {
          symptomsFrequency[symptom] = (symptomsFrequency[symptom] || 0) + 1;
        });
      }
    });

    const recentEntries = sortedEntries.slice(0, 5);

    return {
      entryCount: sortedEntries.length,
      latestTemp,
      todaysMedCount: todaysMeds.length,
      lastMed,
      vaccineEntries,
      completedVaccinations,
      symptomsFrequency,
      recentEntries,
    };
  }, [healthEntries, selectedBaby, getCompletedVaccinations]);

  if (!stats) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={{ backgroundColor: cardBg, borderRadius: 12, padding: 24, alignItems: "center" }}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>🏥</Text>
          <Text style={{ fontSize: 14, color: textSecondary, textAlign: "center" }}>
            {t("stats.health.noEntries")}
          </Text>
        </View>
      </ScrollView>
    );
  }

  if (stats.entryCount === 0) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={{ backgroundColor: cardBg, borderRadius: 12, padding: 24, alignItems: "center" }}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>🏥</Text>
          <Text style={{ fontSize: 14, color: textSecondary, textAlign: "center" }}>
            {t("stats.health.noEntries")}
          </Text>
        </View>
      </ScrollView>
    );
  }

  const getVaccinesToDisplay = () => {
    const loggedVaccineKeys = new Set<string>();

    stats.completedVaccinations.forEach(v => loggedVaccineKeys.add(v.vaccineName));

    (stats.vaccineEntries ?? [])
      .filter(h => h.vaccineName)
      .forEach(h => {
        const schedule = CDC_VACCINE_SCHEDULE.find(s => s.key === h.vaccineName);
        if (schedule) {
          if (schedule.isCombo && schedule.coversVaccines) {
            schedule.coversVaccines.forEach(k => loggedVaccineKeys.add(k));
          } else {
            loggedVaccineKeys.add(h.vaccineName!);
          }
        }
      });

    const withDoses = CDC_VACCINE_SCHEDULE.filter(
      v => !v.isCombo && loggedVaccineKeys.has(v.key)
    );
    if (withDoses.length > 0) return withDoses;

    return CDC_VACCINE_SCHEDULE.filter((v) => v.mandatory && !v.isCombo).slice(0, 8);
  };

  const vaccinesToDisplay = getVaccinesToDisplay();

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <StatsMetricCard
          label={t("stats.health.latestTemp")}
          value={
            stats.latestTemp && stats.latestTemp.temperatureCelsius !== undefined
              ? formatTemperature(stats.latestTemp.temperatureCelsius, temperatureUnit)
              : t("stats.health.noReadings")
          }
          subtitle={
            stats.latestTemp && stats.latestTemp.temperatureCelsius !== undefined
              ? `${t(`health.feverStatus.${getFeverStatus(stats.latestTemp.temperatureCelsius, stats.latestTemp.measurementMethod)}`)}`
              : undefined
          }
        />
        <StatsMetricCard
          label={t("stats.health.medsToday")}
          value={stats.todaysMedCount.toString()}
          subtitle={buildMedicationSubtitle(stats.lastMed, t)}
        />
      </View>

      <View style={{ backgroundColor: cardBg, borderRadius: 12, overflow: "hidden" }}>
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: borderColor }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: textAccent,
              marginBottom: 12,
            }}
          >
            {t("stats.health.vaccineProgress")}
          </Text>

          {vaccinesToDisplay.map((vaccine) => {
            const completedForVaccine = stats.completedVaccinations.filter(
              (v) => v.vaccineName === vaccine.key
            );
            const progress = completedForVaccine.length;
            const total = vaccine.totalDoses;

            return (
              <View
                key={vaccine.key}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: borderColor,
                }}
              >
                <Text style={{ flex: 1, fontSize: 13, color: textSecondary }}>
                  {getVaccineName(vaccine.key, t)}
                </Text>

                <View style={{ flexDirection: "row", gap: 4, marginHorizontal: 12 }}>
                  {Array.from({ length: total }).map((_, i) => {
                    const doseNum = i + 1;
                    const isCompleted = completedForVaccine.some(v => v.doseNumber === doseNum);
                    const isNext = !isCompleted && doseNum === Math.min(
                      ...Array.from({ length: total }, (__, j) => j + 1)
                        .filter(d => !completedForVaccine.some(v => v.doseNumber === d))
                    );

                    return (
                      <View
                        key={i}
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 8,
                          backgroundColor: isCompleted
                            ? successLight
                            : isNext
                              ? warningMuted
                              : `${neutralLight}30`,
                          borderWidth: isNext ? 1.5 : 0,
                          borderColor: isNext ? warningLight : undefined,
                        }}
                      />
                    );
                  })}
                </View>

                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color:
                      progress === total
                        ? successLight
                        : progress > 0
                          ? warningLight
                          : neutralLight,
                    minWidth: 30,
                    textAlign: "right",
                  }}
                >
                  {progress}/{total}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {Object.keys(stats.symptomsFrequency).length > 0 && (
        <View style={{ backgroundColor: cardBg, borderRadius: 12, padding: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                color: textAccent,
              }}
            >
              {t("stats.health.recentSymptoms")}
            </Text>
            <Text style={{ fontSize: 11, color: textTertiary }}>
              {t("stats.health.range30DaysShort")}
            </Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(stats.symptomsFrequency)
              .sort(([, a], [, b]) => b - a)
              .map(([symptom, count]) => {
                const total = Object.values(stats.symptomsFrequency).reduce((a, b) => a + b, 0);
                const percentage = count / total;
                let bgColor = accentMuted;

                if (percentage > 0.4) {
                  bgColor = errorMuted;
                } else if (percentage > 0.2) {
                  bgColor = warningMuted;
                } else if (percentage > 0.1) {
                  bgColor = accentMuted;
                }

                return (
                  <View
                    key={symptom}
                    style={{
                      backgroundColor: bgColor,
                      borderRadius: 16,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: textSecondary }}>
                      {getSymptomName(symptom, t)}{" "}
                      {count > 1 ? t("stats.health.symptomCountShort", { count }) : ""}
                    </Text>
                  </View>
                );
              })}
          </View>
        </View>
      )}

      {stats.recentEntries.length > 0 && (
        <View style={{ backgroundColor: cardBg, borderRadius: 12, overflow: "hidden" }}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: borderColor }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                color: textAccent,
              }}
            >
              {t("stats.health.recentEntries")}
            </Text>
          </View>

          {stats.recentEntries.map((entry, index) => {
            let emoji = "📝";
            let bgColor = accentMuted;
            let detail = "";
            let displayName = "";

            if (entry.type === "medication") {
              emoji = "💊";
              bgColor = accentMuted;
              displayName = entry.medicationName ? getHealthDisplayName(entry.medicationName, "medication", t) : "";
              if (entry.dosageAmount !== undefined && entry.dosageAmount !== null) {
                detail = ` ${entry.dosageAmount}`;
                if (entry.dosageUnit) {
                  const unitKey = `unit${entry.dosageUnit.charAt(0).toUpperCase() + entry.dosageUnit.slice(1)}`;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  detail += ` ${t(`health.${unitKey}` as any, { count: entry.dosageAmount })}`;
                }
              }
            } else if (entry.type === "temperature") {
              emoji = "🌡️";
              bgColor = successMuted;
              displayName = t("health.temperature");
              if (entry.temperatureCelsius !== undefined) {
                detail = formatTemperature(entry.temperatureCelsius, temperatureUnit);
              }
            } else if (entry.type === "vaccination") {
              emoji = "💉";
              bgColor = warningMuted;
              displayName = entry.vaccineName ? getHealthDisplayName(entry.vaccineName, "vaccine", t) : "";
              if (entry.doseNumber !== undefined && entry.doseNumber !== null) {
                detail = t("health.doseLabel", { number: entry.doseNumber });
              }
            } else if (entry.type === "symptom") {
              emoji = "🤒";
              bgColor = errorMuted;
              displayName = t("health.symptomsLabel");
              if (entry.symptoms && Array.isArray(entry.symptoms)) {
                detail = entry.symptoms.map((s) => getSymptomName(s, t)).join(", ");
              }
            }

            return (
              <View
                key={entry.id}
                testID={`health-recent-entry-${entry.id}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderBottomWidth: index === stats.recentEntries.length - 1 ? 0 : 1,
                  borderBottomColor: borderColor,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    backgroundColor: bgColor,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{emoji}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "500", color: textPrimary }}>
                    {displayName}
                  </Text>
                  {detail && (
                    <Text style={{ fontSize: 12, color: textTertiary, marginTop: 2 }}>
                      {detail}
                    </Text>
                  )}
                </View>

                <Text style={{ fontSize: 12, color: textTertiary }}>
                  {timeSince(new Date(entry.loggedAt), undefined, t)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
