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
}

const PADDING_LEFT = 30;
const PADDING_RIGHT = 8;
const PADDING_TOP = 8;
const PADDING_BOTTOM = 28;
const CHART_HEIGHT = 120;
const BAR_FILL_RATIO = 0.65;

export function StackedBarChartWithAxis({
  data,
  yAxisLabels,
  legend,
  maxY: maxYProp,
}: StackedBarChartWithAxisProps) {
  const { width: screenWidth } = useWindowDimensions();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const textTertiary = isDark ? TEXT.dark.tertiary : TEXT.light.tertiary;
  const textSecondary = isDark ? TEXT.dark.secondary : TEXT.light.secondary;
  const gridLine = isDark ? BORDER.dark.subtle : BORDER.light.subtle;

  const cardPadding = 64;
  const totalWidth = screenWidth - cardPadding;
  const chartAreaWidth = totalWidth - PADDING_LEFT - PADDING_RIGHT;
  const svgHeight = PADDING_TOP + CHART_HEIGHT + PADDING_BOTTOM;

  const maxY = maxYProp ?? Math.max(
    ...yAxisLabels,
    ...data.map((d) => d.segments.reduce((sum, s) => sum + s.value, 0))
  );
  const safeMaxY = maxY > 0 ? maxY : 1;

  const toSvgY = (value: number): number =>
    PADDING_TOP + CHART_HEIGHT - (value / safeMaxY) * CHART_HEIGHT;

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
                  x1={PADDING_LEFT}
                  y1={y}
                  x2={PADDING_LEFT + chartAreaWidth}
                  y2={y}
                  stroke={gridLine}
                  strokeWidth={0.5}
                />
                <SvgText
                  x={PADDING_LEFT - 4}
                  y={y + 3}
                  fontSize={9}
                  fill={textTertiary}
                  textAnchor="end"
                >
                  {String(value)}
                </SvgText>
              </G>
            );
          })}
        </G>

        <G>
          {data.map((bar, i) => {
            const slotX = PADDING_LEFT + i * slotWidth;
            const barX = slotX + (slotWidth - barWidth) / 2;

            let cumulative = 0;
            const rects = bar.segments.map((seg, si) => {
              const segH = (seg.value / safeMaxY) * CHART_HEIGHT;
              cumulative += seg.value;
              const segY = PADDING_TOP + CHART_HEIGHT - (cumulative / safeMaxY) * CHART_HEIGHT;
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

            return <G key={`bar-${i}`}>{rects}</G>;
          })}
        </G>

        <G>
          {data.map((bar, i) => {
            const slotX = PADDING_LEFT + i * slotWidth;
            const centerX = slotX + slotWidth / 2;
            return (
              <SvgText
                key={`label-${i}`}
                x={centerX}
                y={PADDING_TOP + CHART_HEIGHT + 16}
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
