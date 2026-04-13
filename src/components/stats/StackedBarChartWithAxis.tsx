import { View, Text, useWindowDimensions } from "react-native";
import Svg, { Rect, Line, G, Text as SvgText } from "react-native-svg";
import { useColorScheme } from "nativewind";
import { TEXT, BORDER } from "@/constants/colors";

interface StackedSegment {
  value: number;
  color: string;
}

interface StackedBarData {
  segments: StackedSegment[];
  label: string;
}

interface LegendItem {
  color: string;
  label: string;
}

interface StackedBarChartWithAxisProps {
  data: StackedBarData[];
  yAxisLabels: number[];
  legend: LegendItem[];
  maxY?: number;
  formatValue?: (value: number) => string;
  formatBarLabel?: (value: number) => string;
  showBarLabels?: boolean;
}

const PADDING_RIGHT = 8;
const PADDING_TOP_NO_LABELS = 8;
const PADDING_TOP_WITH_LABELS = 18;
const PADDING_BOTTOM = 28;
const CHART_HEIGHT = 120;
const BAR_FILL_RATIO = 0.65;
const CHAR_WIDTH = 5.5;
const MIN_PADDING_LEFT = 30;

function estimateLabelWidth(labels: number[], formatValue?: (v: number) => string): number {
  let maxLen = 0;
  for (const v of labels) {
    const text = formatValue ? formatValue(v) : String(v);
    if (text.length > maxLen) maxLen = text.length;
  }
  return Math.max(maxLen * CHAR_WIDTH + 8, MIN_PADDING_LEFT);
}

export function StackedBarChartWithAxis({
  data,
  yAxisLabels,
  legend,
  maxY: maxYProp,
  formatValue,
  formatBarLabel,
  showBarLabels = false,
}: StackedBarChartWithAxisProps) {
  const { width: screenWidth } = useWindowDimensions();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const textTertiary = isDark ? TEXT.dark.tertiary : TEXT.light.tertiary;
  const textSecondary = isDark ? TEXT.dark.secondary : TEXT.light.secondary;
  const gridLine = isDark ? BORDER.dark.strong : BORDER.light.subtle;

  const paddingLeft = estimateLabelWidth(yAxisLabels, formatValue);
  const paddingTop = showBarLabels ? PADDING_TOP_WITH_LABELS : PADDING_TOP_NO_LABELS;
  const cardPadding = 64;
  const totalWidth = screenWidth - cardPadding;
  const chartAreaWidth = totalWidth - paddingLeft - PADDING_RIGHT;
  const svgHeight = paddingTop + CHART_HEIGHT + PADDING_BOTTOM;

  const maxY = maxYProp ?? Math.max(
    ...yAxisLabels,
    ...data.map((d) => d.segments.reduce((sum, s) => sum + s.value, 0))
  );
  const safeMaxY = maxY > 0 ? maxY : 1;

  const toSvgY = (value: number): number =>
    paddingTop + CHART_HEIGHT - (value / safeMaxY) * CHART_HEIGHT;

  const barCount = data.length;
  const slotWidth = barCount > 0 ? chartAreaWidth / barCount : 0;
  const barWidth = Math.min(slotWidth * BAR_FILL_RATIO, 30);

  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12, marginBottom: 8 }}>
        {legend.map((item, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: item.color }} />
            <Text style={{ fontSize: 11, color: textSecondary }}>{item.label}</Text>
          </View>
        ))}
      </View>

      <Svg width={totalWidth} height={svgHeight}>
        <G>
          {yAxisLabels.map((value) => {
            const y = toSvgY(value);
            return (
              <G key={`grid-${value}`}>
                <Line
                  x1={paddingLeft}
                  y1={y}
                  x2={paddingLeft + chartAreaWidth}
                  y2={y}
                  stroke={gridLine}
                  strokeWidth={0.5}
                />
                <SvgText
                  x={paddingLeft - 4}
                  y={y + 3}
                  fontSize={9}
                  fill={textTertiary}
                  textAnchor="end"
                >
                  {formatValue ? formatValue(value) : String(value)}
                </SvgText>
              </G>
            );
          })}
        </G>

        <G>
          {data.map((bar, i) => {
            const slotX = paddingLeft + i * slotWidth;
            const barX = slotX + (slotWidth - barWidth) / 2;
            const centerX = slotX + slotWidth / 2;

            let cumulative = 0;
            const rects = bar.segments.map((seg, si) => {
              const segH = (seg.value / safeMaxY) * CHART_HEIGHT;
              cumulative += seg.value;
              const segY = paddingTop + CHART_HEIGHT - (cumulative / safeMaxY) * CHART_HEIGHT;
              const isTop = si === bar.segments.length - 1;
              return seg.value > 0 ? (
                <Rect
                  key={`seg-${i}-${si}`}
                  x={barX}
                  y={segY}
                  width={barWidth}
                  height={segH}
                  fill={seg.color}
                  rx={isTop ? 4 : 0}
                  ry={isTop ? 4 : 0}
                />
              ) : null;
            });

            const total = bar.segments.reduce((sum, s) => sum + s.value, 0);
            const topY = paddingTop + CHART_HEIGHT - (total / safeMaxY) * CHART_HEIGHT;

            return (
              <G key={`bar-${i}`}>
                {rects}
                {showBarLabels && total > 0 && (
                  <SvgText
                    x={centerX}
                    y={topY - 4}
                    fontSize={9}
                    fontWeight="600"
                    fill={textSecondary}
                    textAnchor="middle"
                  >
                    {formatBarLabel ? formatBarLabel(total) : String(total)}
                  </SvgText>
                )}
              </G>
            );
          })}
        </G>

        <G>
          {data.map((bar, i) => {
            const slotX = paddingLeft + i * slotWidth;
            const centerX = slotX + slotWidth / 2;
            return (
              <SvgText
                key={`label-${i}`}
                x={centerX}
                y={paddingTop + CHART_HEIGHT + 16}
                fontSize={9}
                fill={textTertiary}
                textAnchor="middle"
              >
                {bar.label}
              </SvgText>
            );
          })}
        </G>
      </Svg>
    </View>
  );
}
