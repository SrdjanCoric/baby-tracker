import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { formatDuration, formatHourValue } from "@/utils/time";
import type { TimeFormat } from "@/utils/time";
import {
  buildDayViewData,
  getHoursForAxis,
  getNowPosition,
} from "@/utils/sleep-patterns";
import { DateNavigator } from "./DateNavigator";
import { Legend } from "./Legend";
import type { SleepPatternColors } from "./useSleepPatternColors";

const PX_PER_HOUR = 60;
const AXIS_WIDTH = 38;

export function DayView({
  data,
  timeFormat,
  selectedDate,
  onNavigate,
  dayStartHour,
  colors,
}: {
  data: ReturnType<typeof buildDayViewData>;
  timeFormat: TimeFormat;
  selectedDate: Date;
  onNavigate: (offset: number) => void;
  dayStartHour: number;
  colors: SleepPatternColors;
}) {
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const hours = getHoursForAxis(dayStartHour);
  const totalHeight = 24 * PX_PER_HOUR;
  const nowPos = getNowPosition(PX_PER_HOUR, new Date(), dayStartHour);
  const isViewingToday = data.dateLabel === t("sleepPatterns.today");

  const totalDaySeconds = data.totalSleepSeconds;

  useEffect(() => {
    if (isViewingToday && nowPos !== null && scrollRef.current) {
      const scrollTo = Math.max(0, nowPos - 200);
      setTimeout(() => scrollRef.current?.scrollTo({ y: scrollTo, animated: false }), 100);
    }
  }, [isViewingToday, nowPos]);

  return (
    <View style={{ flex: 1 }}>
      <DateNavigator
        label={data.dateLabel}
        onPrev={() => onNavigate(-1)}
        onNext={() => onNavigate(1)}
        colors={colors}
      />
      {totalDaySeconds > 0 && (
        <View style={{ alignItems: "center", paddingBottom: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>
            {t("sleepPatterns.totalSleep")}: {formatDuration(totalDaySeconds, "short")}
          </Text>
        </View>
      )}
      <Legend colors={colors} />
      <ScrollView ref={scrollRef} style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: totalHeight, position: "relative", marginBottom: 8, paddingTop: 7 }}>
          {hours.map((hour, i) => (
            <View
              key={hour}
              style={{
                position: "absolute",
                top: i * PX_PER_HOUR,
                left: 0,
                right: 0,
                height: PX_PER_HOUR,
                flexDirection: "row",
                alignItems: "flex-start",
              }}
            >
              <Text
                style={{
                  width: AXIS_WIDTH - 4,
                  textAlign: "right",
                  fontSize: 10,
                  color: colors.textTertiary,
                  lineHeight: 14,
                  marginTop: -7,
                }}
              >
                {formatHourValue(hour, timeFormat)}
              </Text>
              <View
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: colors.borderSubtle,
                  marginTop: 0,
                }}
              />
            </View>
          ))}

          {data.blocks.map((block, i) => (
            <View
              key={`${block.startedAt}-${i}`}
              style={{
                position: "absolute",
                top: block.topPx,
                left: AXIS_WIDTH,
                right: 8,
                height: block.heightPx,
                backgroundColor: block.type === "night" ? colors.nightColor : colors.napColor,
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 4,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                overflow: "hidden",
              }}
            >
              {block.heightPx >= 20 && (
                <>
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                    numberOfLines={1}
                  >
                    {block.type === "night"
                      ? t("sleepPatterns.nightSleep")
                      : t("sleepPatterns.napSleep")}
                  </Text>
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 11,
                      fontWeight: "500",
                    }}
                    numberOfLines={1}
                  >
                    {formatDuration(block.durationSeconds, "short")}
                  </Text>
                </>
              )}
            </View>
          ))}

          {isViewingToday && nowPos !== null && (
            <View
              style={{
                position: "absolute",
                top: nowPos,
                left: AXIS_WIDTH - 4,
                right: 0,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.accentColor,
                }}
              />
              <View
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor: colors.accentColor,
                }}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
