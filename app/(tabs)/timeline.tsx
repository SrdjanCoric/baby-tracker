import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMemo, useCallback } from "react";
import { useRouter } from "expo-router";
import {
  TimelineItem,
  TimelineDayHeader,
  TimelineDivider,
} from "@/components";
import { useFeeding, useSleep, useDiaper, usePumping, useGrowth, useTummyTime } from "@/contexts";
import { formatTime, formatDuration, formatDayHeader } from "@/utils/time";
import { formatVolume } from "@/utils/volume";
import { formatWeight, formatHeight } from "@/utils/growth";
import type { StoredFeedingEntry } from "@/services/feeding-storage";
import type { StoredSleepEntry } from "@/services/sleep-storage";
import type { StoredDiaperEntry } from "@/services/diaper-storage";
import type { StoredPumpingEntry } from "@/services/pumping-storage";
import type { StoredGrowthEntry } from "@/services/growth-storage";
import type { StoredTummyTimeEntry } from "@/services/tummyTime-storage";

interface TimelineEntry {
  id: string;
  activity: "feeding" | "sleep" | "diaper" | "pumping" | "growth" | "tummyTime";
  time: string;
  title: string;
  subtitle: string;
  date: Date;
}

interface GroupedEntries {
  header: string;
  dateLabel: string;
  entries: TimelineEntry[];
}

function groupEntriesByDay(entries: TimelineEntry[]): GroupedEntries[] {
  const grouped: Map<string, TimelineEntry[]> = new Map();

  for (const entry of entries) {
    const dateKey = entry.date.toDateString();
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(entry);
  }

  const result: GroupedEntries[] = [];
  const now = new Date();

  for (const [dateKey, dayEntries] of grouped) {
    const date = new Date(dateKey);
    const header = formatDayHeader(date, now);
    const dateLabel = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    dayEntries.sort((a, b) => b.date.getTime() - a.date.getTime());

    result.push({ header, dateLabel, entries: dayEntries });
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
  const { feedings } = useFeeding();
  const { sleeps } = useSleep();
  const { diapers } = useDiaper();
  const { pumpings } = usePumping();
  const { measurements } = useGrowth();
  const { tummyTimes } = useTummyTime();

  const handleEditEntry = useCallback((activity: TimelineEntry["activity"], id: string) => {
    router.push(`/edit/${activity}?id=${id}`);
  }, [router]);

  const feedingToTimelineEntry = useCallback((feeding: StoredFeedingEntry): TimelineEntry => {
    const date = new Date(feeding.startedAt);
    const time = formatTime(date);

    let title = "";
    let subtitle = "";

    if (feeding.type === "breast") {
      title = t("feeding.breastfeeding");
      const sideLabel = feeding.side === "left"
        ? t("feeding.left")
        : feeding.side === "right"
          ? t("feeding.right")
          : t("feeding.both");
      const durationLabel = feeding.durationSeconds
        ? formatDuration(feeding.durationSeconds, "short")
        : "";
      subtitle = durationLabel ? `${sideLabel} · ${durationLabel}` : sideLabel;
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
    };
  }, [t]);

  const sleepToTimelineEntry = useCallback((sleep: StoredSleepEntry): TimelineEntry => {
    const date = new Date(sleep.startedAt);
    const time = formatTime(date);

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
    };
  }, [t]);

  const diaperToTimelineEntry = useCallback((diaper: StoredDiaperEntry): TimelineEntry => {
    const date = new Date(diaper.changedAt);
    const time = formatTime(date);

    const typeLabels: Record<string, string> = {
      wet: t("diaper.wet"),
      dirty: t("diaper.dirty"),
      mixed: t("diaper.mixed"),
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
    };
  }, [t]);

  const pumpingToTimelineEntry = useCallback((pumping: StoredPumpingEntry): TimelineEntry => {
    const date = new Date(pumping.startedAt);
    const time = formatTime(date);

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
    };
  }, [t]);

  const growthToTimelineEntry = useCallback((growth: StoredGrowthEntry): TimelineEntry => {
    const date = new Date(growth.measuredAt);
    const time = formatTime(date);

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
    };
  }, [t]);

  const tummyTimeToTimelineEntry = useCallback((tummyTime: StoredTummyTimeEntry): TimelineEntry => {
    const date = new Date(tummyTime.startedAt);
    const time = formatTime(date);

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
    };
  }, [t]);

  const timelineEntries = useMemo(() => {
    const feedingEntries = feedings.map(feedingToTimelineEntry);
    const sleepEntries = sleeps.map(sleepToTimelineEntry);
    const diaperEntries = diapers.map(diaperToTimelineEntry);
    const pumpingEntries = pumpings.map(pumpingToTimelineEntry);
    const growthEntries = measurements.map(growthToTimelineEntry);
    const tummyTimeEntries = tummyTimes.map(tummyTimeToTimelineEntry);
    const allEntries = [...feedingEntries, ...sleepEntries, ...diaperEntries, ...pumpingEntries, ...growthEntries, ...tummyTimeEntries];
    return allEntries.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [feedings, sleeps, diapers, pumpings, measurements, tummyTimes, feedingToTimelineEntry, sleepToTimelineEntry, diaperToTimelineEntry, pumpingToTimelineEntry, growthToTimelineEntry, tummyTimeToTimelineEntry]);

  const groupedEntries = useMemo(() => {
    return groupEntriesByDay(timelineEntries);
  }, [timelineEntries]);

  const hasEntries = timelineEntries.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["bottom"]}>
      {hasEntries ? (
        <ScrollView className="flex-1">
          {groupedEntries.map((group) => (
            <View key={group.header + group.dateLabel}>
              <TimelineDayHeader title={group.header} date={group.dateLabel} />

              {group.entries.map((item, index) => (
                <View key={item.id}>
                  <TimelineItem
                    activity={item.activity}
                    time={item.time}
                    title={item.title}
                    subtitle={item.subtitle}
                    onPress={() => handleEditEntry(item.activity, item.id)}
                  />
                  {index < group.entries.length - 1 && <TimelineDivider />}
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-6xl mb-4">📋</Text>
          <Text className="text-xl font-semibold text-content-primary dark:text-content-dark-primary mb-2">
            {t("timeline.noEntries")}
          </Text>
          <Text className="text-center text-content-secondary dark:text-content-dark-secondary">
            {t("timeline.startTracking")}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
