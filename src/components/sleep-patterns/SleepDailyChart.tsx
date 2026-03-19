import { View, Text, useWindowDimensions } from "react-native";
import Svg, { Rect, Line, G, Text as SvgText } from "react-native-svg";
import type { DailySleepBar } from "@/utils/sleep-patterns";
import type { SleepPatternColors } from "./useSleepPatternColors";

interface SleepDailyChartProps {
  data: DailySleepBar[];
  nightColor: string;
  napColor: string;
  nightLabel: string;
  napLabel: string;
  colors: SleepPatternColors;
  locale: string;
  labelInterval: number;
}

const PADDING_LEFT = 32;
const PADDING_RIGHT = 8;
const PADDING_TOP = 8;
const PADDING_BOTTOM = 36;
const CHART_HEIGHT = 180;
const BAR_FILL_RATIO = 0.7;
const GRID_STEP = 3;

function computeMaxY(data: DailySleepBar[]): number {
  let max = 0;
  for (const bar of data) {
    const total = bar.nightHours + bar.napHours;
    if (total > max) max = total;
  }
  const withHeadroom = Math.ceil((max * 1.1) / GRID_STEP) * GRID_STEP;
  return Math.max(withHeadroom, 18);
}

function getWeekday(dateKey: string, locale: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0);
  return date.toLocaleDateString(locale, { weekday: "short" });
}

export function SleepDailyChart({
  data,
  nightColor,
  napColor,
  nightLabel,
  napLabel,
  colors,
  locale,
  labelInterval,
}: SleepDailyChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const cardPadding = 32;
  const totalWidth = screenWidth - cardPadding;
  const chartAreaWidth = totalWidth - PADDING_LEFT - PADDING_RIGHT;
  const svgHeight = PADDING_TOP + CHART_HEIGHT + PADDING_BOTTOM;

  const maxY = computeMaxY(data);
  const gridValues: number[] = [];
  for (let v = 0; v <= maxY; v += GRID_STEP) {
    gridValues.push(v);
  }

  const toSvgY = (value: number): number =>
    PADDING_TOP + CHART_HEIGHT - (value / maxY) * CHART_HEIGHT;

  const barCount = data.length;
  const slotWidth = barCount > 0 ? chartAreaWidth / barCount : 0;
  const barWidth = slotWidth * BAR_FILL_RATIO;

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              backgroundColor: nightColor,
            }}
          />
          <Text style={{ fontSize: 11, color: colors.textSecondary }}>
            {nightLabel}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              backgroundColor: napColor,
            }}
          />
          <Text style={{ fontSize: 11, color: colors.textSecondary }}>
            {napLabel}
          </Text>
        </View>
      </View>

      <Svg width={totalWidth} height={svgHeight}>
        <G>
          {gridValues.map((value) => {
            const y = toSvgY(value);
            return (
              <G key={`grid-${value}`}>
                <Line
                  x1={PADDING_LEFT}
                  y1={y}
                  x2={PADDING_LEFT + chartAreaWidth}
                  y2={y}
                  stroke={colors.gridLine}
                  strokeWidth={0.5}
                />
                <SvgText
                  x={PADDING_LEFT - 4}
                  y={y + 3}
                  fontSize={10}
                  fill={colors.textTertiary}
                  textAnchor="end"
                >
                  {`${value}h`}
                </SvgText>
              </G>
            );
          })}
        </G>

        <G>
          {data.map((bar, i) => {
            const slotX = PADDING_LEFT + i * slotWidth;
            const barX = slotX + (slotWidth - barWidth) / 2;

            const nightH = (bar.nightHours / maxY) * CHART_HEIGHT;
            const napH = (bar.napHours / maxY) * CHART_HEIGHT;
            const totalH = nightH + napH;

            const nightY = PADDING_TOP + CHART_HEIGHT - totalH;
            const napY = nightY + napH;

            const hasNap = bar.napHours > 0;
            const hasNight = bar.nightHours > 0;

            return (
              <G key={`bar-${i}`}>
                {hasNight && (
                  <Rect
                    x={barX}
                    y={napY}
                    width={barWidth}
                    height={nightH}
                    fill={nightColor}
                    rx={hasNap ? 0 : 2}
                  />
                )}
                {hasNap && (
                  <Rect
                    x={barX}
                    y={nightY}
                    width={barWidth}
                    height={napH}
                    fill={napColor}
                    rx={2}
                  />
                )}
              </G>
            );
          })}
        </G>

        <G>
          {data.map((bar, i) => {
            if (i % labelInterval !== 0) return null;
            const slotX = PADDING_LEFT + i * slotWidth;
            const centerX = slotX + slotWidth / 2;
            const weekday = getWeekday(bar.dateKey, locale);

            return (
              <G key={`label-${i}`}>
                <SvgText
                  x={centerX}
                  y={PADDING_TOP + CHART_HEIGHT + 14}
                  fontSize={9}
                  fill={colors.textTertiary}
                  textAnchor="middle"
                >
                  {weekday}
                </SvgText>
                <SvgText
                  x={centerX}
                  y={PADDING_TOP + CHART_HEIGHT + 26}
                  fontSize={9}
                  fill={colors.textTertiary}
                  textAnchor="middle"
                >
                  {bar.label}
                </SvgText>
              </G>
            );
          })}
        </G>
      </Svg>
    </View>
  );
}
