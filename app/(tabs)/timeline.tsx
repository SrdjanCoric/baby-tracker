import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMemo, useCallback } from "react";
import {
  TimelineItem,
  TimelineDayHeader,
  TimelineDivider,
} from "@/components";
import { useFeeding } from "@/contexts";
import { formatTime, formatDuration, formatDayHeader } from "@/utils/time";
import type { StoredFeedingEntry } from "@/services/feeding-storage";

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
  const { feedings } = useFeeding();

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

  const timelineEntries = useMemo(() => {
    const feedingEntries = feedings.map(feedingToTimelineEntry);
    return feedingEntries.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [feedings, feedingToTimelineEntry]);

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
                    onPress={() => {
                      // Navigate to edit screen
                    }}
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
