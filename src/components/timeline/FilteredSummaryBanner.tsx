/**
 * FilteredSummaryBanner - Shows aggregate summary when a filter is selected
 * Displays prominent stats like "Bottle feeding: 200ml · 5 times"
 */

import { View, Text } from "react-native";
import { useColorScheme } from "nativewind";
import { ACTIVITY_CONFIG, type ActivityType } from "@/constants/activities";
import { CONTENT_COLORS } from "@/constants/design-tokens";
import type { DailySummary } from "@/utils/timeline";
import type { FilterType } from "./ActivityFilterTabs";

interface FilteredSummaryBannerProps {
  filter: FilterType;
  summaries: DailySummary[];
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function FilteredSummaryBanner({
  filter,
  summaries,
  t,
}: FilteredSummaryBannerProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // Don't show banner for "all" filter
  if (filter === "all") {
    return null;
  }

  // Aggregate summaries
  const totals = summaries.reduce(
    (acc, summary) => {
      return {
        nursingMinutes: acc.nursingMinutes + summary.nursingMinutes,
        nursingCount: acc.nursingCount + summary.nursingCount,
        bottleCount: acc.bottleCount + summary.bottleCount,
        feedingTotalMl: acc.feedingTotalMl + summary.feedingTotalMl,
        solidCount: acc.solidCount + summary.solidCount,
        sleepMinutes: acc.sleepMinutes + summary.sleepMinutes,
        napCount: acc.napCount + summary.napCount,
        nightSleepCount: acc.nightSleepCount + summary.nightSleepCount,
        diaperWet: acc.diaperWet + summary.diaperCount.wet,
        diaperDirty: acc.diaperDirty + summary.diaperCount.dirty,
        diaperMixed: acc.diaperMixed + summary.diaperCount.mixed,
        diaperDry: acc.diaperDry + summary.diaperCount.dry,
        diaperTotal: acc.diaperTotal + summary.diaperCount.total,
        pumpingCount: acc.pumpingCount + summary.pumpingCount,
        pumpingTotalMl: acc.pumpingTotalMl + summary.pumpingTotalMl,
        growthCount: acc.growthCount + summary.growthCount,
        tummyTimeMinutes: acc.tummyTimeMinutes + summary.tummyTimeMinutes,
        tummyTimeCount: acc.tummyTimeCount + summary.tummyTimeCount,
      };
    },
    {
      nursingMinutes: 0,
      nursingCount: 0,
      bottleCount: 0,
      feedingTotalMl: 0,
      solidCount: 0,
      sleepMinutes: 0,
      napCount: 0,
      nightSleepCount: 0,
      diaperWet: 0,
      diaperDirty: 0,
      diaperMixed: 0,
      diaperDry: 0,
      diaperTotal: 0,
      pumpingCount: 0,
      pumpingTotalMl: 0,
      growthCount: 0,
      tummyTimeMinutes: 0,
      tummyTimeCount: 0,
    }
  );

  // Generate summary lines based on filter
  const getSummaryContent = () => {
    switch (filter) {
      case "feeding": {
        const lines: { label: string; value: string }[] = [];
        if (totals.nursingCount > 0) {
          const hours = Math.floor(totals.nursingMinutes / 60);
          const mins = totals.nursingMinutes % 60;
          const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
          lines.push({
            label: t("feeding.breastfeeding"),
            value: `${timeStr} · ${totals.nursingCount}×`,
          });
        }
        if (totals.bottleCount > 0) {
          lines.push({
            label: t("feeding.bottle"),
            value: `${totals.feedingTotalMl}ml · ${totals.bottleCount}×`,
          });
        }
        if (totals.solidCount > 0) {
          lines.push({
            label: t("feeding.solid"),
            value: `${totals.solidCount}×`,
          });
        }
        return lines;
      }
      case "sleep": {
        const lines: { label: string; value: string }[] = [];
        const hours = Math.floor(totals.sleepMinutes / 60);
        const mins = totals.sleepMinutes % 60;
        const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        if (totals.napCount > 0) {
          lines.push({
            label: t("sleep.nap"),
            value: `${totals.napCount}×`,
          });
        }
        if (totals.nightSleepCount > 0) {
          lines.push({
            label: t("sleep.night"),
            value: `${totals.nightSleepCount}×`,
          });
        }
        if (totals.sleepMinutes > 0) {
          lines.push({
            label: t("common.total"),
            value: timeStr,
          });
        }
        return lines;
      }
      case "diaper": {
        const lines: { label: string; value: string }[] = [];
        if (totals.diaperWet > 0) {
          lines.push({ label: t("diaper.wet"), value: `${totals.diaperWet}×` });
        }
        if (totals.diaperDirty > 0) {
          lines.push({ label: t("diaper.dirty"), value: `${totals.diaperDirty}×` });
        }
        if (totals.diaperMixed > 0) {
          lines.push({ label: t("diaper.mixed"), value: `${totals.diaperMixed}×` });
        }
        if (totals.diaperDry > 0) {
          lines.push({ label: t("diaper.dry"), value: `${totals.diaperDry}×` });
        }
        return lines;
      }
      case "pumping": {
        if (totals.pumpingCount > 0) {
          return [
            {
              label: t("pumping.title"),
              value: `${totals.pumpingTotalMl}ml · ${totals.pumpingCount}×`,
            },
          ];
        }
        return [];
      }
      case "growth": {
        if (totals.growthCount > 0) {
          return [
            {
              label: t("growth.title"),
              value: `${totals.growthCount}×`,
            },
          ];
        }
        return [];
      }
      case "tummyTime": {
        if (totals.tummyTimeCount > 0) {
          return [
            {
              label: t("tummyTime.title"),
              value: `${totals.tummyTimeMinutes}m · ${totals.tummyTimeCount}×`,
            },
          ];
        }
        return [];
      }
      default:
        return [];
    }
  };

  const content = getSummaryContent();

  if (content.length === 0) {
    return null;
  }

  const config = ACTIVITY_CONFIG[filter as ActivityType];
  const bgColor = isDark ? config.mutedBgDark : config.mutedBg;
  const accentColor = config.accentColor;

  return (
    <View
      className="mx-4 mt-3 mb-1 rounded-xl p-3"
      style={{
        backgroundColor: bgColor,
        borderLeftWidth: 4,
        borderLeftColor: accentColor,
      }}
    >
      <View className="flex-row items-center mb-2">
        <Text className="text-lg mr-2">{config.icon}</Text>
        <Text
          className="text-sm font-semibold"
          style={{ color: accentColor }}
        >
          {t("timeline.summary")}
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-x-4 gap-y-1">
        {content.map((item, index) => (
          <View key={index} className="flex-row items-center">
            <Text
              className="text-sm"
              style={{ color: isDark ? CONTENT_COLORS.dark.secondary : CONTENT_COLORS.light.secondary }}
            >
              {item.label}:{" "}
            </Text>
            <Text
              className="text-sm font-semibold"
              style={{ color: isDark ? CONTENT_COLORS.dark.primary : CONTENT_COLORS.light.primary }}
            >
              {item.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
