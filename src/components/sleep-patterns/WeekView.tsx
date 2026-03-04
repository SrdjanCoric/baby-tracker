import { useTranslation } from "react-i18next";
import { Text, View, useWindowDimensions } from "react-native";
import { formatHourValue, formatDuration } from "@/utils/time";
import type { TimeFormat } from "@/utils/time";
import {
  getEvenHoursForAxis,
  getNowFraction,
  formatWeekRange,
} from "@/utils/sleep-patterns";
import type { WeekColumn } from "@/utils/sleep-patterns";
import { DateNavigator } from "./DateNavigator";
import { Legend } from "./Legend";
import type { SleepPatternColors } from "./useSleepPatternColors";

const AXIS_WIDTH = 38;

export function WeekView({
  data,
  timeFormat,
  weekEndDate,
  onNavigate,
  dayStartHour,
  colors,
  locale,
}: {
  data: WeekColumn[];
  timeFormat: TimeFormat;
  weekEndDate: Date;
  onNavigate: (offset: number) => void;
  dayStartHour: number;
  colors: SleepPatternColors;
  locale: string;
}) {
  const { t } = useTranslation();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const evenHours = getEvenHoursForAxis(dayStartHour);
  const chartHeight = screenHeight - 460;
  const pxPerHour = chartHeight / 24;
  const totalHeight = 24 * pxPerHour;
  const nowFrac = getNowFraction(new Date(), dayStartHour);
  const colWidth = (screenWidth - AXIS_WIDTH - 16) / 7;

  const hasToday = data.some((c) => c.isToday);

  return (
    <View style={{ flex: 1 }}>
      <DateNavigator
        label={formatWeekRange(weekEndDate, locale)}
        onPrev={() => onNavigate(-1)}
        onNext={() => onNavigate(1)}
        colors={colors}
      />

      <View
        style={{
          flexDirection: "row",
          paddingLeft: AXIS_WIDTH,
          paddingRight: 8,
          marginBottom: 4,
        }}
      >
        {data.map((col) => {
          const colTotalSeconds = col.blocks.reduce(
            (sum, b) => sum + b.heightFraction * 24 * 3600,
            0
          );
          return (
            <View key={col.dateNum + col.dayLabel} style={{ width: colWidth, alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 10,
                  color: col.isToday ? colors.accentColor : colors.textTertiary,
                  fontWeight: col.isToday ? "700" : "500",
                }}
              >
                {col.dayLabel}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: col.isToday ? colors.accentColor : colors.textPrimary,
                  fontWeight: col.isToday ? "700" : "500",
                }}
              >
                {col.dateNum}
              </Text>
              {colTotalSeconds >= 60 && (
                <Text
                  style={{
                    fontSize: 9,
                    color: col.isToday ? colors.accentColor : colors.textTertiary,
                    fontWeight: "500",
                    marginTop: 1,
                  }}
                >
                  {formatDuration(Math.round(colTotalSeconds), "short")}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      <Legend colors={colors} />

      <View style={{ height: totalHeight + 6, position: "relative", marginBottom: 8, paddingTop: 6 }}>
          {[...evenHours, dayStartHour].map((hour, i) => (
            <View
              key={`${hour}-${i}`}
              style={{
                position: "absolute",
                top: 6 + i * 2 * pxPerHour,
                left: 0,
                right: 0,
                flexDirection: "row",
                alignItems: "flex-start",
              }}
            >
              <Text
                style={{
                  width: AXIS_WIDTH - 4,
                  textAlign: "right",
                  fontSize: 9,
                  color: colors.textTertiary,
                  lineHeight: 12,
                  marginTop: -6,
                }}
              >
                {formatHourValue(hour, timeFormat)}
              </Text>
              <View
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: colors.borderSubtle,
                }}
              />
            </View>
          ))}

          {data.map((col, colIdx) => (
            <View
              key={col.dateNum + col.dayLabel}
              style={{
                position: "absolute",
                top: 6,
                left: AXIS_WIDTH + colIdx * colWidth,
                width: colWidth,
                height: totalHeight,
              }}
            >
              {col.blocks.map((block, blockIdx) => (
                <View
                  key={blockIdx}
                  style={{
                    position: "absolute",
                    top: block.topFraction * totalHeight,
                    left: 2,
                    right: 2,
                    height: Math.max(block.heightFraction * totalHeight, 2),
                    backgroundColor: block.type === "night" ? colors.nightColor : colors.napColor,
                    borderRadius: 3,
                  }}
                />
              ))}
            </View>
          ))}

          {hasToday && nowFrac !== null && (
            <View
              style={{
                position: "absolute",
                top: 6 + nowFrac * totalHeight,
                left: AXIS_WIDTH - 4,
                right: 0,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors.accentColor,
                }}
              />
              <View
                style={{
                  flex: 1,
                  height: 1.5,
                  backgroundColor: colors.accentColor,
                }}
              />
            </View>
          )}
      </View>
    </View>
  );
}
