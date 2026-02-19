import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import { ACTION_COLORS, SURFACE } from "@/constants/design-tokens";
import type { StatisticsPeriod } from "@/utils/statistics";

interface PeriodPickerProps {
  selectedPeriod: StatisticsPeriod;
  onPeriodChange: (period: StatisticsPeriod) => void;
}

const PERIODS: StatisticsPeriod[] = ["today", "7days", "30days"];

const PERIOD_KEYS: Record<StatisticsPeriod, string> = {
  today: "statistics.periodToday",
  "7days": "statistics.period7Days",
  "30days": "statistics.period30Days",
};

export function PeriodPicker({ selectedPeriod, onPeriodChange }: PeriodPickerProps) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View
      className="flex-row rounded-full p-1 mb-4 mt-2"
      style={{ backgroundColor: isDark ? SURFACE.dark.card : SURFACE.light.card }}
    >
      {PERIODS.map((period) => {
        const isSelected = period === selectedPeriod;
        return (
          <Pressable
            key={period}
            className="flex-1 rounded-full py-2.5 items-center"
            style={isSelected ? {
              backgroundColor: isDark ? ACTION_COLORS.dark.primary : ACTION_COLORS.light.primary,
            } : undefined}
            onPress={() => onPeriodChange(period)}
          >
            <Text
              className="text-sm"
              style={{
                color: isSelected
                  ? "#FFFFFF"
                  : isDark ? "#B8B3B0" : "#5C5752",
                fontWeight: isSelected ? "600" : "500",
              }}
            >
              {t(PERIOD_KEYS[period] as never)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
