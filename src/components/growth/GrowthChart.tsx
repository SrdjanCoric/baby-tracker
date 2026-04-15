import React, { useMemo } from "react";
import { View, Text, useColorScheme } from "react-native";
import Svg, {
  Path,
  Line,
  Circle,
  G,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
  Rect,
} from "react-native-svg";
import {
  generatePercentileLine,
  calculatePercentileFromMeasurement,
} from "@/utils/percentile-calculator";
import type {
  Gender,
  GrowthMeasurementType,
  GrowthChartPoint,
} from "@/types/growth-chart";
import {
  PERCENTILE_LINES,
  PERCENTILE_COLORS,
  CHART_AGE_RANGE,
} from "@/types/growth-chart";

interface GrowthChartProps {
  gender: Gender;
  measurementType: GrowthMeasurementType;
  measurements: Array<{
    date: Date;
    value: number;
    ageMonths: number;
    id: string;
  }>;
  width?: number;
  height?: number;
  showLabels?: boolean;
  showGrid?: boolean;
  axisLabel?: string;
  unitConverter?: (value: number) => number;
  onPointPress?: (point: GrowthChartPoint) => void;
}

interface ChartDimensions {
  width: number;
  height: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  chartWidth: number;
  chartHeight: number;
}

const DEFAULT_WIDTH = 340;
const DEFAULT_HEIGHT = 280;

export function GrowthChart({
  gender,
  measurementType,
  measurements,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  showLabels = true,
  showGrid = true,
  axisLabel,
  unitConverter,
}: GrowthChartProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const convert = unitConverter ?? ((v: number) => v);

  const dimensions: ChartDimensions = useMemo(
    () => ({
      width,
      height,
      paddingLeft: showLabels ? (axisLabel ? 56 : 40) : 16,
      paddingRight: showLabels ? 36 : 16,
      paddingTop: 20,
      paddingBottom: showLabels ? 32 : 16,
      chartWidth: width - (showLabels ? (axisLabel ? 56 : 40) : 16) - (showLabels ? 36 : 16),
      chartHeight: height - 20 - (showLabels ? 32 : 16),
    }),
    [width, height, showLabels, axisLabel]
  );

  // Calculate Y-axis range based on percentile data and measurements
  const { minY, maxY } = useMemo(() => {
    const p3Data = generatePercentileLine(
      gender,
      measurementType,
      3,
      0,
      24,
      1
    );
    const p97Data = generatePercentileLine(
      gender,
      measurementType,
      97,
      0,
      24,
      1
    );

    let min = Math.min(...p3Data.map((p) => convert(p.value)));
    let max = Math.max(...p97Data.map((p) => convert(p.value)));

    if (measurements.length > 0) {
      const measurementValues = measurements.map((m) => convert(m.value));
      min = Math.min(min, ...measurementValues);
      max = Math.max(max, ...measurementValues);
    }

    // Add 10% padding
    const range = max - min;
    return {
      minY: Math.max(0, min - range * 0.1),
      maxY: max + range * 0.1,
    };
  }, [gender, measurementType, measurements, convert]);

  // Generate percentile line data
  const percentileLines = useMemo(() => {
    return PERCENTILE_LINES.map((percentile) => ({
      percentile,
      points: generatePercentileLine(gender, measurementType, percentile, 0, 24, 0.5),
      color: PERCENTILE_COLORS[percentile],
    }));
  }, [gender, measurementType]);

  // Convert data point to SVG coordinates
  const toSvgX = (ageMonths: number): number => {
    const ratio = ageMonths / CHART_AGE_RANGE.max;
    return dimensions.paddingLeft + ratio * dimensions.chartWidth;
  };

  const toSvgY = (value: number): number => {
    const ratio = (value - minY) / (maxY - minY);
    return dimensions.paddingTop + (1 - ratio) * dimensions.chartHeight;
  };

  const generatePath = (
    points: Array<{ ageMonths: number; value: number }>
  ): string => {
    if (points.length === 0) return "";

    const pathParts = points.map((p, i) => {
      const x = toSvgX(p.ageMonths);
      const y = toSvgY(convert(p.value));
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    });

    return pathParts.join(" ");
  };

  // Calculate user measurement points with percentiles
  const measurementPoints: GrowthChartPoint[] = useMemo(() => {
    return measurements
      .filter((m) => m.value != null && Number.isFinite(m.value))
      .map((m) => {
        const result = calculatePercentileFromMeasurement(
          gender,
          m.ageMonths,
          m.value,
          measurementType
        );
        return {
          ageMonths: m.ageMonths,
          value: m.value,
          percentile: result.percentile,
          zScore: result.zScore,
          date: m.date,
          measurementId: m.id,
        };
      });
  }, [measurements, gender, measurementType]);

  // Colors based on theme
  const colors = {
    background: isDark ? "#1E1E1E" : "#FFFFFF",
    grid: isDark ? "#374151" : "#E5E7EB",
    axisText: isDark ? "#A0A0A0" : "#6B6B6B",
    measurementPoint: isDark ? "#20BB97" : "#009B77",
    measurementLine: isDark ? "#20BB97" : "#009B77",
  };

  // Generate grid lines
  const gridLines = useMemo(() => {
    const lines: Array<{ type: "x" | "y"; value: number; label: string }> = [];

    // X-axis grid (age in months)
    for (let age = 0; age <= 24; age += 6) {
      lines.push({ type: "x", value: age, label: `${age}m` });
    }

    const yRange = maxY - minY;
    const yStep = yRange > 50 ? 10 : yRange > 10 ? 5 : yRange > 5 ? 2 : 1;
    const startY = Math.ceil(minY / yStep) * yStep;
    for (let y = startY; y <= maxY; y += yStep) {
      lines.push({
        type: "y",
        value: y,
        label: yStep < 1 || (measurementType === "weight" && yStep <= 2)
          ? y.toFixed(1)
          : Math.round(y).toString(),
      });
    }

    return lines;
  }, [minY, maxY, measurementType]);

  return (
    <View className="items-center">
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="normalZone" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#22c55e" stopOpacity="0.15" />
            <Stop offset="100%" stopColor="#22c55e" stopOpacity="0.05" />
          </LinearGradient>
        </Defs>

        {/* Background */}
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill={colors.background}
          rx={12}
        />

        {/* Y-axis label with bracket */}
        {showLabels && axisLabel && (
          <G>
            <Path
              d={`M ${dimensions.paddingLeft - 34} ${dimensions.paddingTop + 4} L ${dimensions.paddingLeft - 38} ${dimensions.paddingTop + 4} L ${dimensions.paddingLeft - 38} ${dimensions.paddingTop + dimensions.chartHeight / 2} L ${dimensions.paddingLeft - 42} ${dimensions.paddingTop + dimensions.chartHeight / 2} M ${dimensions.paddingLeft - 38} ${dimensions.paddingTop + dimensions.chartHeight / 2} L ${dimensions.paddingLeft - 38} ${dimensions.paddingTop + dimensions.chartHeight - 4} L ${dimensions.paddingLeft - 34} ${dimensions.paddingTop + dimensions.chartHeight - 4}`}
              stroke={isDark ? "#505050" : "#B0B0B0"}
              strokeWidth={0.8}
              fill="none"
              strokeLinecap="round"
            />
            <SvgText
              x={dimensions.paddingLeft - 44}
              y={dimensions.paddingTop + dimensions.chartHeight / 2}
              fontSize={10}
              fill={colors.axisText}
              textAnchor="middle"
              fontFamily="-apple-system, sans-serif"
              transform={`rotate(-90, ${dimensions.paddingLeft - 44}, ${dimensions.paddingTop + dimensions.chartHeight / 2})`}
            >
              {axisLabel}
            </SvgText>
          </G>
        )}

        {/* Grid lines */}
        {showGrid && (
          <G>
            {gridLines.map((line, i) => {
              if (line.type === "x") {
                const x = toSvgX(line.value);
                return (
                  <Line
                    key={`grid-x-${i}`}
                    x1={x}
                    y1={dimensions.paddingTop}
                    x2={x}
                    y2={dimensions.paddingTop + dimensions.chartHeight}
                    stroke={colors.grid}
                    strokeWidth={1}
                    strokeDasharray="4,4"
                  />
                );
              } else {
                const y = toSvgY(line.value);
                return (
                  <Line
                    key={`grid-y-${i}`}
                    x1={dimensions.paddingLeft}
                    y1={y}
                    x2={dimensions.paddingLeft + dimensions.chartWidth}
                    y2={y}
                    stroke={colors.grid}
                    strokeWidth={1}
                    strokeDasharray="4,4"
                  />
                );
              }
            })}
          </G>
        )}

        {/* Normal zone shading (15th-85th percentile) */}
        {percentileLines.length >= 5 && (
          <Path
            d={`${generatePath(percentileLines[1].points)}
                L ${toSvgX(24)} ${toSvgY(percentileLines[3].points[percentileLines[3].points.length - 1].value)}
                ${generatePath([...percentileLines[3].points].reverse()).replace("M", "L")}
                Z`}
            fill="url(#normalZone)"
          />
        )}

        {/* Percentile lines */}
        {percentileLines.map(({ percentile, points, color }) => (
          <Path
            key={percentile}
            d={generatePath(points)}
            stroke={color}
            strokeWidth={percentile === 50 ? 2.5 : 1.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={percentile === 50 ? 1 : 0.7}
          />
        ))}

        {/* User measurement line */}
        {measurementPoints.length > 1 && (
          <Path
            d={generatePath(
              measurementPoints.map((p) => ({
                ageMonths: p.ageMonths,
                value: p.value, // generatePath applies convert
              }))
            )}
            stroke={colors.measurementLine}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* User measurement points */}
        {measurementPoints.map((point) => (
          <G key={point.measurementId}>
            <Circle
              cx={toSvgX(point.ageMonths)}
              cy={toSvgY(convert(point.value))}
              r={8}
              fill={colors.measurementPoint}
              opacity={0.2}
            />
            <Circle
              cx={toSvgX(point.ageMonths)}
              cy={toSvgY(convert(point.value))}
              r={5}
              fill={colors.measurementPoint}
              stroke={colors.background}
              strokeWidth={2}
            />
          </G>
        ))}

        {/* Axis labels */}
        {showLabels && (
          <G>
            {/* X-axis labels */}
            {gridLines
              .filter((l) => l.type === "x")
              .map((line, i) => (
                <SvgText
                  key={`label-x-${i}`}
                  x={toSvgX(line.value)}
                  y={height - 8}
                  fontSize={10}
                  fill={colors.axisText}
                  textAnchor="middle"
                >
                  {line.label}
                </SvgText>
              ))}

            {/* Y-axis labels */}
            {gridLines
              .filter((l) => l.type === "y")
              .map((line, i) => (
                <SvgText
                  key={`label-y-${i}`}
                  x={dimensions.paddingLeft - 4}
                  y={toSvgY(line.value) + 4}
                  fontSize={10}
                  fill={colors.axisText}
                  textAnchor="end"
                >
                  {line.label}
                </SvgText>
              ))}
          </G>
        )}

        {/* Percentile labels on right side */}
        {percentileLines.map(({ percentile, points, color }) => {
          const lastPoint = points[points.length - 1];
          const label = percentile < 10 ? ` ${percentile}%` : `${percentile}%`;
          return (
            <SvgText
              key={`p-label-${percentile}`}
              x={dimensions.paddingLeft + dimensions.chartWidth + 4}
              y={toSvgY(convert(lastPoint.value)) + 3}
              fontSize={9}
              fill={color}
              textAnchor="start"
              fontWeight={percentile === 50 ? "bold" : "normal"}
            >
              {label}
            </SvgText>
          );
        })}
      </Svg>

      {/* Legend */}
      <View className="flex-row flex-wrap justify-center mt-3 px-4">
        {PERCENTILE_LINES.map((p) => (
          <View key={p} className="flex-row items-center mx-2 mb-1">
            <View
              className="w-3 h-0.5 mr-1 rounded"
              style={{ backgroundColor: PERCENTILE_COLORS[p] }}
            />
            <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary">
              {p === 50 ? "50th (median)" : `${p}th`}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default GrowthChart;
