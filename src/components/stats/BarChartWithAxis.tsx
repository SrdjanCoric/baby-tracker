import { View, useWindowDimensions } from "react-native";
import Svg, { Rect, Line, G, Text as SvgText } from "react-native-svg";
import { useColorScheme } from "nativewind";
import { TEXT, BORDER } from "@/constants/colors";

interface BarData {
  value: number;
  label: string;
}

interface BarChartWithAxisProps {
  data: BarData[];
  yAxisLabels: number[];
  barColor: string;
  formatValue?: (value: number) => string;
  formatBarLabel?: (value: number) => string;
  maxY?: number;
  showBarLabels?: boolean;
}

const PADDING_LEFT = 30;
const PADDING_RIGHT = 8;
const PADDING_TOP = 18;
const PADDING_BOTTOM = 28;
const CHART_HEIGHT = 120;
const BAR_FILL_RATIO = 0.65;

export function BarChartWithAxis({
  data,
  yAxisLabels,
  barColor,
  formatValue,
  formatBarLabel,
  maxY: maxYProp,
  showBarLabels = true,
}: BarChartWithAxisProps) {
  const { width: screenWidth } = useWindowDimensions();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const textTertiary = isDark ? TEXT.dark.tertiary : TEXT.light.tertiary;
  const textSecondary = isDark ? TEXT.dark.secondary : TEXT.light.secondary;
  const gridLine = isDark ? BORDER.dark.strong : BORDER.light.subtle;

  const cardPadding = 64;
  const totalWidth = screenWidth - cardPadding;
  const chartAreaWidth = totalWidth - PADDING_LEFT - PADDING_RIGHT;
  const svgHeight = PADDING_TOP + CHART_HEIGHT + PADDING_BOTTOM;

  const maxY = maxYProp ?? Math.max(...yAxisLabels, ...data.map((d) => d.value));
  const safeMaxY = maxY > 0 ? maxY : 1;

  const toSvgY = (value: number): number =>
    PADDING_TOP + CHART_HEIGHT - (value / safeMaxY) * CHART_HEIGHT;

  const barCount = data.length;
  const slotWidth = barCount > 0 ? chartAreaWidth / barCount : 0;
  const barWidth = Math.min(slotWidth * BAR_FILL_RATIO, 30);

  return (
    <View>
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
                  {formatValue ? formatValue(value) : String(value)}
                </SvgText>
              </G>
            );
          })}
        </G>

        <G>
          {data.map((bar, i) => {
            const slotX = PADDING_LEFT + i * slotWidth;
            const barX = slotX + (slotWidth - barWidth) / 2;
            const barH = (bar.value / safeMaxY) * CHART_HEIGHT;
            const barY = PADDING_TOP + CHART_HEIGHT - barH;
            const centerX = slotX + slotWidth / 2;

            return (
              <G key={`bar-${i}`}>
                {bar.value > 0 && (
                  <>
                    {showBarLabels && (
                      <SvgText
                        x={centerX}
                        y={barY - 4}
                        fontSize={9}
                        fontWeight="600"
                        fill={textSecondary}
                        textAnchor="middle"
                      >
                        {formatBarLabel ? formatBarLabel(bar.value) : String(bar.value)}
                      </SvgText>
                    )}
                    <Rect
                      x={barX}
                      y={barY}
                      width={barWidth}
                      height={barH}
                      fill={barColor}
                      rx={4}
                      ry={4}
                    />
                  </>
                )}
              </G>
            );
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
                fontSize={10}
                fill={textTertiary}
                fontWeight="500"
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
