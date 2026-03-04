import { Text, View, useWindowDimensions } from "react-native";
import Svg, { Path, Circle as SvgCircle, Line } from "react-native-svg";
import { formatTime } from "@/utils/time";
import type { TimeFormat } from "@/utils/time";
import type { SleepSummary } from "@/utils/sleep-patterns";
import type { SleepPatternColors } from "./useSleepPatternColors";

function buildSmoothPath(
  points: { x: number; y: number }[]
): string {
  if (points.length < 2) return "";

  let path = `M ${points[0].x},${points[0].y}`;

  if (points.length === 2) {
    path += ` L ${points[1].x},${points[1].y}`;
    return path;
  }

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const tension = 0.3;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  return path;
}

export function TrendChart({
  bedtimeTrend,
  wakeTimeTrend,
  timeFormat,
  colors,
  locale,
}: {
  bedtimeTrend: SleepSummary["bedtimeTrend"];
  wakeTimeTrend: SleepSummary["wakeTimeTrend"];
  timeFormat: TimeFormat;
  colors: SleepPatternColors;
  locale: string;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 80;
  const chartHeight = 120;

  const allTimes = [
    ...bedtimeTrend.map((d) => d.time),
    ...wakeTimeTrend.map((d) => d.time),
  ];

  if (allTimes.length === 0) return null;

  const minutes = allTimes.map((t) => t.getHours() * 60 + t.getMinutes());
  const minMin = Math.min(...minutes);
  const maxMin = Math.max(...minutes);
  const range = Math.max(maxMin - minMin, 60);

  const allDates = [
    ...bedtimeTrend.map((d) => d.date),
    ...wakeTimeTrend.map((d) => d.date),
  ];
  const sortedDates = [...new Set(allDates.map((d) => d.toISOString().slice(0, 10)))].sort();
  const dateCount = Math.max(sortedDates.length, 1);

  const getX = (date: Date) => {
    const key = date.toISOString().slice(0, 10);
    const idx = sortedDates.indexOf(key);
    return (idx / Math.max(dateCount - 1, 1)) * chartWidth;
  };

  const getY = (time: Date) => {
    const mins = time.getHours() * 60 + time.getMinutes();
    return chartHeight - ((mins - minMin) / range) * chartHeight;
  };

  const dayLabels = sortedDates.map((ds) => {
    const d = new Date(ds + "T12:00:00");
    return d.toLocaleDateString(locale, { weekday: "short" });
  });

  const minTimeLabel = formatTime(
    (() => {
      const d = new Date(0);
      d.setHours(Math.floor(minMin / 60), minMin % 60);
      return d;
    })(),
    timeFormat
  );
  const maxTimeLabel = formatTime(
    (() => {
      const d = new Date(0);
      d.setHours(Math.floor(maxMin / 60), maxMin % 60);
      return d;
    })(),
    timeFormat
  );

  const bedtimePoints = bedtimeTrend.map((p) => ({ x: getX(p.date), y: getY(p.time) }));
  const wakePoints = wakeTimeTrend.map((p) => ({ x: getX(p.date), y: getY(p.time) }));

  const bedtimePath = buildSmoothPath(bedtimePoints);
  const wakePath = buildSmoothPath(wakePoints);

  return (
    <View>
      <View style={{ flexDirection: "row" }}>
        <View
          style={{
            justifyContent: "space-between",
            height: chartHeight,
            marginRight: 4,
          }}
        >
          <Text style={{ fontSize: 9, color: colors.textTertiary }}>{maxTimeLabel}</Text>
          <Text style={{ fontSize: 9, color: colors.textTertiary }}>{minTimeLabel}</Text>
        </View>
        <Svg width={chartWidth} height={chartHeight}>
          <Line x1={0} y1={0} x2={chartWidth} y2={0} stroke={colors.gridLine} strokeWidth={1} />
          <Line x1={0} y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke={colors.gridLine} strokeWidth={1} />

          {bedtimePath !== "" && (
            <Path d={bedtimePath} stroke={colors.nightColor} strokeWidth={2} fill="none" />
          )}
          {wakePath !== "" && (
            <Path d={wakePath} stroke={colors.accentColor} strokeWidth={2} fill="none" />
          )}

          {bedtimeTrend.map((point, i) => (
            <SvgCircle
              key={`bed-${i}`}
              cx={getX(point.date)}
              cy={getY(point.time)}
              r={4}
              fill={colors.nightColor}
            />
          ))}
          {wakeTimeTrend.map((point, i) => (
            <SvgCircle
              key={`wake-${i}`}
              cx={getX(point.date)}
              cy={getY(point.time)}
              r={4}
              fill={colors.accentColor}
            />
          ))}
        </Svg>
      </View>

      <View
        style={{
          flexDirection: "row",
          marginLeft: 28,
          marginTop: 4,
          width: chartWidth,
          justifyContent: "space-between",
        }}
      >
        {dayLabels.map((label, i) => (
          <Text key={i} style={{ fontSize: 9, color: colors.textTertiary, textAlign: "center" }}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}
