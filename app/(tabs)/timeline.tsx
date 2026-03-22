import { useTranslation } from "react-i18next";
import { AppState, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMemo, useCallback, useState, useRef, useEffect } from "react";
import { useColorScheme } from "nativewind";
import { getActionColor } from "@/constants/design-tokens";
import { useRouter } from "expo-router";
import {
  TimelineItem,
  TimelineDayHeader,
  EmptyState,
  LoadingState,
} from "@/components";
import { ActivityFilterTabs, DailySummaryCard, type FilterType } from "@/components/timeline";
import { useFeeding, useSleep, useDiaper, usePumping, useGrowth, useTummyTime, useHealth, useHousehold, useTimeFormat, useBaby, useUnits } from "@/contexts";
import { formatTime, formatDuration, formatDayHeader } from "@/utils/time";
import { formatVolume } from "@/utils/volume";
import { formatWeight, formatHeight } from "@/utils/growth";
import { formatDualSideDuration } from "@/utils/feeding";
import {
  calculateDailySummary,
  formatDailySummaryText,
  type TimelineDataByDate,
  type DailySummary,
} from "@/utils/timeline";
import type { StoredFeedingEntry } from "@/services/feeding-storage";
import type { StoredSleepEntry } from "@/services/sleep-storage";
import type { StoredDiaperEntry } from "@/services/diaper-storage";
import type { StoredPumpingEntry } from "@/services/pumping-storage";
import type { StoredGrowthEntry } from "@/services/growth-storage";
import type { StoredTummyTimeEntry } from "@/services/tummyTime-storage";
import type { StoredHealthEntry } from "@/services/health-storage";
import type { ActivityType } from "@/constants/activities";
import { formatTemperature, getFeverStatus } from "@/utils/temperature";
import { getHealthDisplayName } from "@/utils/health-display";

interface TimelineEntry {
  id: string;
  activity: ActivityType;
  time: string;
  title: string;
  subtitle: string;
  date: Date;
  loggedBy?: string;
}

interface GroupedEntries {
  header: string;
  dateLabel: string;
  dateObj: Date;
  entries: TimelineEntry[];
  summaryLines: string[];
  summary: DailySummary;
}

function groupEntriesByDay(
  entries: TimelineEntry[],
  filter: FilterType,
  allData: TimelineDataByDate,
  t: (key: string, options?: Record<string, unknown>) => string,
  dayStartHour: number = 6,
  dayEndHour: number = 19
): GroupedEntries[] {
  const grouped: Map<string, { entries: TimelineEntry[]; date: Date }> = new Map();

  for (const entry of entries) {
    const dateKey = entry.date.toDateString();
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, { entries: [], date: entry.date });
    }
    grouped.get(dateKey)!.entries.push(entry);
  }

  const result: GroupedEntries[] = [];
  const now = new Date();

  for (const [_dateKey, { entries: dayEntries, date }] of grouped) {
    const header = formatDayHeader(date, now, t);
    const dateLabel = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });

    dayEntries.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Calculate daily summary
    const summary = calculateDailySummary(date, allData, dayStartHour, dayEndHour);
    const summaryLines = formatDailySummaryText(summary, filter, t);

    result.push({
      header,
      dateLabel,
      dateObj: date,
      entries: dayEntries,
      summaryLines,
      summary,
    });
  }

  result.sort((a, b) => {
    const dateA = new Date(a.entries[0]?.date || 0);
    const dateB = new Date(b.entries[0]?.date || 0);
    return dateB.getTime() - dateA.getTime();
  });

  return result;
}

export default function TimelineScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { feedings, isLoading: feedingsLoading, refreshFeedings } = useFeeding();
  const { sleeps, isLoading: sleepsLoading, refreshSleeps, wakeWindowConfig } = useSleep();
  const { diapers, isLoading: diapersLoading, refreshDiapers } = useDiaper();
  const { pumpings, isLoading: pumpingsLoading, refreshPumpings } = usePumping();
  const { measurements, isLoading: growthLoading, refreshMeasurements } = useGrowth();
  const { tummyTimes, isLoading: tummyTimesLoading, refreshTummyTimes } = useTummyTime();
  const { healthEntries, isLoading: healthLoading, refreshHealth } = useHealth();
  const { temperatureUnit } = useUnits();
  const { members } = useHousehold();
  const { timeFormat } = useTimeFormat();
  const { selectedBaby } = useBaby();
  const { colorScheme } = useColorScheme();

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        setRefreshing(false);
      }
    });
    return () => subscription.remove();
  }, []);

  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const scrollViewRef = useRef<ScrollView>(null);
  const dayPositionsRef = useRef<Map<string, number>>(new Map());

  const getMemberName = useCallback((userId: string | undefined): string | undefined => {
    // Don't show "logged by" if there's only 1 person in the household
    if (members.length <= 1) return undefined;
    if (!userId) return undefined;

    // Find the member who logged this entry
    const member = members.find(m => m.id === userId);
    if (!member) return undefined;

    // Use display name if available
    if (member.displayName) return member.displayName;

    // Fall back to email username (capitalize first letter)
    if (member.email) {
      const emailName = member.email.split('@')[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }

    return undefined;
  }, [members]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.race([
        Promise.all([
          refreshFeedings(),
          refreshSleeps(),
          refreshDiapers(),
          refreshPumpings(),
          refreshMeasurements(),
          refreshTummyTimes(),
          refreshHealth(),
        ]),
        new Promise((resolve) => setTimeout(resolve, 15000)),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshFeedings, refreshSleeps, refreshDiapers, refreshPumpings, refreshMeasurements, refreshTummyTimes, refreshHealth]);

  const isLoading = feedingsLoading || sleepsLoading || diapersLoading || pumpingsLoading || growthLoading || tummyTimesLoading || healthLoading;

  const handleEditEntry = useCallback((activity: TimelineEntry["activity"], id: string) => {
    router.push(`/edit/${activity}?id=${id}`);
  }, [router]);

  const handleFilterChange = useCallback((filter: FilterType) => {
    setActiveFilter(filter);
  }, []);

  // Collect all data for summary calculations
  const allData: TimelineDataByDate = useMemo(() => ({
    feedings,
    sleeps,
    diapers,
    pumpings,
    growths: measurements,
    tummyTimes,
  }), [feedings, sleeps, diapers, pumpings, measurements, tummyTimes]);

  const feedingToTimelineEntry = useCallback((feeding: StoredFeedingEntry): TimelineEntry => {
    const date = new Date(feeding.startedAt);
    const time = formatTime(date, timeFormat);

    let title = "";
    let subtitle = "";

    if (feeding.type === "breast") {
      title = t("feeding.breastfeeding");

      const hasDualSideDurations = feeding.leftDurationSeconds || feeding.rightDurationSeconds;
      if (hasDualSideDurations) {
        subtitle = formatDualSideDuration(
          feeding.leftDurationSeconds,
          feeding.rightDurationSeconds
        );
      } else {
        const sideLabel = feeding.side === "left"
          ? t("feeding.left")
          : feeding.side === "right"
            ? t("feeding.right")
            : t("feeding.both");
        const durationLabel = feeding.durationSeconds
          ? formatDuration(feeding.durationSeconds, "short")
          : "";
        subtitle = durationLabel ? `${sideLabel} · ${durationLabel}` : sideLabel;
      }
    } else if (feeding.type === "bottle") {
      const contentLabel = feeding.contentType === "breastMilk"
        ? t("feeding.breastMilk")
        : t("feeding.formula");
      title = `${t("feeding.bottle")} (${contentLabel})`;
      subtitle = feeding.amountMl ? `${feeding.amountMl} ml` : "";
    } else {
      title = t("feeding.solid");
      const foodLabel = feeding.foodType || "";
      let reactionDisplay = "";
      if (feeding.reaction) {
        const reactionEmojis: Record<string, string> = {
          loved: "😍",
          meh: "😐",
          refused: "😣",
        };
        const emoji = reactionEmojis[feeding.reaction] || "";
        const label = t(`feeding.${feeding.reaction}`);
        reactionDisplay = `${emoji} ${label}`;
      }
      subtitle = reactionDisplay ? `${foodLabel} · ${reactionDisplay}` : foodLabel;
    }

    return {
      id: feeding.id,
      activity: "feeding",
      time,
      title,
      subtitle,
      date,
      loggedBy: feeding.loggedBy,
    };
  }, [t, timeFormat]);

  const sleepToTimelineEntry = useCallback((sleep: StoredSleepEntry): TimelineEntry => {
    const date = new Date(sleep.startedAt);
    const time = formatTime(date, timeFormat);

    const title = sleep.type === "nap" ? t("sleep.nap") : t("sleep.night");
    const durationLabel = sleep.durationSeconds
      ? formatDuration(sleep.durationSeconds, "short")
      : "";
    const subtitle = durationLabel;

    return {
      id: sleep.id,
      activity: "sleep",
      time,
      title,
      subtitle,
      date,
      loggedBy: sleep.loggedBy,
    };
  }, [t, timeFormat]);

  const diaperToTimelineEntry = useCallback((diaper: StoredDiaperEntry): TimelineEntry => {
    const date = new Date(diaper.changedAt);
    const time = formatTime(date, timeFormat);

    const typeLabels: Record<string, string> = {
      wet: t("diaper.wet"),
      dirty: t("diaper.dirty"),
      mixed: t("diaper.mixed"),
      dry: t("diaper.dry"),
    };

    const title = t("diaper.title");
    const typeLabel = typeLabels[diaper.type] || diaper.type;
    const colorLabel = diaper.stoolColor
      ? t(`stoolColors.${diaper.stoolColor}`)
      : "";
    const subtitle = colorLabel ? `${typeLabel} · ${colorLabel}` : typeLabel;

    return {
      id: diaper.id,
      activity: "diaper",
      time,
      title,
      subtitle,
      date,
      loggedBy: diaper.loggedBy,
    };
  }, [t, timeFormat]);

  const pumpingToTimelineEntry = useCallback((pumping: StoredPumpingEntry): TimelineEntry => {
    const date = new Date(pumping.startedAt);
    const time = formatTime(date, timeFormat);

    const title = t("pumping.title");
    const sideLabel = pumping.side === "left"
      ? t("feeding.left")
      : pumping.side === "right"
        ? t("feeding.right")
        : t("feeding.both");
    const volumeLabel = pumping.volumeMl ? formatVolume(pumping.volumeMl, "ml") : "";
    const durationLabel = pumping.durationSeconds
      ? formatDuration(pumping.durationSeconds, "short")
      : "";

    const parts = [sideLabel];
    if (volumeLabel) parts.push(volumeLabel);
    if (durationLabel) parts.push(durationLabel);
    const subtitle = parts.join(" · ");

    return {
      id: pumping.id,
      activity: "pumping",
      time,
      title,
      subtitle,
      date,
      loggedBy: pumping.loggedBy,
    };
  }, [t, timeFormat]);

  const growthToTimelineEntry = useCallback((growth: StoredGrowthEntry): TimelineEntry => {
    const date = new Date(growth.measuredAt);
    const time = formatTime(date, timeFormat);

    const title = t("growth.title");
    const parts: string[] = [];
    if (growth.weightKg) parts.push(formatWeight(growth.weightKg, "kg"));
    if (growth.heightCm) parts.push(formatHeight(growth.heightCm, "cm"));
    if (growth.headCircumferenceCm) parts.push(`${t("growth.headCircumference")}: ${growth.headCircumferenceCm} cm`);
    const subtitle = parts.join(" · ");

    return {
      id: growth.id,
      activity: "growth",
      time,
      title,
      subtitle,
      date,
      loggedBy: growth.loggedBy,
    };
  }, [t, timeFormat]);

  const tummyTimeToTimelineEntry = useCallback((tummyTime: StoredTummyTimeEntry): TimelineEntry => {
    const date = new Date(tummyTime.startedAt);
    const time = formatTime(date, timeFormat);

    const title = t("tummyTime.title");
    const durationLabel = tummyTime.durationSeconds
      ? formatDuration(tummyTime.durationSeconds, "short")
      : "";
    const subtitle = durationLabel;

    return {
      id: tummyTime.id,
      activity: "tummyTime",
      time,
      title,
      subtitle,
      date,
      loggedBy: tummyTime.loggedBy,
    };
  }, [t, timeFormat]);

  const healthToTimelineEntry = useCallback((entry: StoredHealthEntry): TimelineEntry => {
    const date = new Date(entry.loggedAt);
    const time = formatTime(date, timeFormat);

    let title = "";
    let subtitle = "";

    switch (entry.type) {
      case "medication": {
        title = t("health.medication");
        const doseAmt = entry.dosageAmount || 0;
        const unitLabels = { ml: t("health.unitMl"), mg: t("health.unitMg"), drops: t("health.unitDrops", { count: doseAmt }), tsp: t("health.unitTsp") } as const;
        const dosageStr = entry.dosageAmount ? `${entry.dosageAmount} ${unitLabels[entry.dosageUnit || "ml"] || t("health.unitMl")}` : "";
        subtitle = [entry.medicationName ? getHealthDisplayName(entry.medicationName, "medication", t) : "", dosageStr].filter(Boolean).join(" \u00B7 ");
        break;
      }
      case "temperature":
        title = t("health.temperature");
        if (entry.temperatureCelsius) {
          const tempStr = formatTemperature(entry.temperatureCelsius, temperatureUnit);
          const status = getFeverStatus(entry.temperatureCelsius, entry.measurementMethod);
          subtitle = `${tempStr} \u00B7 ${t(`health.feverStatus.${status}`)}`;
        }
        break;
      case "vaccination":
        title = t("health.vaccination");
        subtitle = entry.vaccineName ? getHealthDisplayName(entry.vaccineName, "vaccine", t) : "";
        break;
      case "symptom":
        title = t("health.symptomsLabel");
        if (entry.symptoms && entry.symptoms.length > 0) {
          subtitle = entry.symptoms.map(s => t(`health.symptom.${s}`)).join(", ");
        }
        break;
    }

    return {
      id: entry.id,
      activity: "health",
      time,
      title,
      subtitle,
      date,
      loggedBy: entry.loggedBy,
    };
  }, [t, timeFormat, temperatureUnit]);

  const timelineEntries = useMemo(() => {
    const filterActivity = (activity: ActivityType) => {
      if (activeFilter === "all") return true;
      return activity === activeFilter;
    };

    const feedingEntries = filterActivity("feeding")
      ? feedings.map(feedingToTimelineEntry)
      : [];
    const sleepEntries = filterActivity("sleep")
      ? sleeps.map(sleepToTimelineEntry)
      : [];
    const diaperEntries = filterActivity("diaper")
      ? diapers.map(diaperToTimelineEntry)
      : [];
    const pumpingEntries = filterActivity("pumping")
      ? pumpings.map(pumpingToTimelineEntry)
      : [];
    const growthEntries = filterActivity("growth")
      ? measurements.map(growthToTimelineEntry)
      : [];
    const tummyTimeEntries = filterActivity("tummyTime")
      ? tummyTimes.map(tummyTimeToTimelineEntry)
      : [];
    const healthTimelineEntries = filterActivity("health")
      ? healthEntries.map(healthToTimelineEntry)
      : [];

    const allEntries = [
      ...feedingEntries,
      ...sleepEntries,
      ...diaperEntries,
      ...pumpingEntries,
      ...growthEntries,
      ...tummyTimeEntries,
      ...healthTimelineEntries,
    ];
    return allEntries
      .map(entry => ({
        ...entry,
        loggedBy: getMemberName(entry.loggedBy),
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [
    feedings,
    sleeps,
    diapers,
    pumpings,
    measurements,
    tummyTimes,
    activeFilter,
    feedingToTimelineEntry,
    sleepToTimelineEntry,
    diaperToTimelineEntry,
    pumpingToTimelineEntry,
    growthToTimelineEntry,
    tummyTimeToTimelineEntry,
    healthEntries,
    healthToTimelineEntry,
    getMemberName,
  ]);

  // Type cast for t function to match component interfaces
  const translate = t as (key: string, options?: Record<string, unknown>) => string;

  const groupedEntries = useMemo(() => {
    dayPositionsRef.current.clear();
    const startHour = wakeWindowConfig?.dayStartHour ?? 6;
    const endHour = wakeWindowConfig?.dayEndHour ?? 19;
    return groupEntriesByDay(timelineEntries, activeFilter, allData, translate, startHour, endHour);
  }, [timelineEntries, activeFilter, allData, translate, wakeWindowConfig?.dayStartHour, wakeWindowConfig?.dayEndHour]);

  const handleSummaryDateChange = useCallback((date: Date) => {
    const dateKey = date.toDateString();
    const y = dayPositionsRef.current.get(dateKey);
    if (y !== undefined) {
      scrollViewRef.current?.scrollTo({ y, animated: true });
    }
  }, []);

  const hasEntries = timelineEntries.length > 0;

  if (isLoading && !hasEntries) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["bottom"]}>
        <LoadingState fullScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["bottom"]} testID="timeline-screen">
      {/* Filter tabs */}
      <ActivityFilterTabs
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
        t={translate}
      />

      {/* Daily summary card for filtered views */}
      <DailySummaryCard
        filter={activeFilter}
        allData={allData}
        birthDate={selectedBaby?.birthDate}
        dayStartHour={wakeWindowConfig?.dayStartHour ?? 6}
        timeFormat={timeFormat}
        t={translate}
        onDateChange={handleSummaryDateChange}
      />

      {hasEntries ? (
        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={getActionColor("primary", colorScheme === "dark")}
              colors={[getActionColor("primary", colorScheme === "dark")]}
            />
          }
        >
          {groupedEntries.map((group) => (
            <View
              key={group.header + group.dateLabel}
              onLayout={(e) => {
                dayPositionsRef.current.set(
                  group.dateObj.toDateString(),
                  e.nativeEvent.layout.y
                );
              }}
            >
              <TimelineDayHeader
                title={group.header}
                date={group.dateLabel}
                dateObj={group.dateObj}
                filter={activeFilter}
              />

              {group.entries.map((item, index) => (
                <TimelineItem
                  key={item.id}
                  activity={item.activity}
                  time={item.time}
                  title={item.title}
                  subtitle={item.subtitle}
                  loggedBy={item.loggedBy}
                  isLast={index === group.entries.length - 1}
                  onPress={() => handleEditEntry(item.activity, item.id)}
                  testID="timeline-item"
                />
              ))}
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flex: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={getActionColor("primary", colorScheme === "dark")}
              colors={[getActionColor("primary", colorScheme === "dark")]}
            />
          }
        >
          <EmptyState
            icon="📋"
            title={t("timeline.noEntries")}
            description={t("timeline.startTracking")}
            testID="empty-timeline"
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
