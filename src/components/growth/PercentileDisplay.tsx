import React from "react";
import { View, Text } from "react-native";
import {
  classifyPercentile,
  getPercentileClassificationLabel,
  type PercentileClassification,
} from "@/types/growth-chart";

interface PercentileDisplayProps {
  percentile: number;
  measurementType: "weight" | "height" | "head";
  value: number;
  unit: string;
  compact?: boolean;
  label?: string;
}

const CLASSIFICATION_COLORS: Record<
  PercentileClassification,
  { bg: string; text: string; bgDark: string; textDark: string }
> = {
  very_low: {
    bg: "bg-red-100",
    text: "text-red-700",
    bgDark: "bg-red-900/30",
    textDark: "text-red-400",
  },
  low: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    bgDark: "bg-orange-900/30",
    textDark: "text-orange-400",
  },
  normal: {
    bg: "bg-green-100",
    text: "text-green-700",
    bgDark: "bg-green-900/30",
    textDark: "text-green-400",
  },
  high: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    bgDark: "bg-orange-900/30",
    textDark: "text-orange-400",
  },
  very_high: {
    bg: "bg-red-100",
    text: "text-red-700",
    bgDark: "bg-red-900/30",
    textDark: "text-red-400",
  },
};

export function PercentileDisplay({
  percentile,
  measurementType,
  value,
  unit,
  compact = false,
  label: customLabel,
}: PercentileDisplayProps) {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  const classification = classifyPercentile(percentile);
  const colors = CLASSIFICATION_COLORS[classification];
  const classificationLabel = getPercentileClassificationLabel(classification);

  const measurementLabel = customLabel ?? (
    measurementType === "weight"
      ? "Weight"
      : measurementType === "height"
        ? "Height"
        : "Head"
  );

  if (compact) {
    return (
      <View
        className={`flex-row items-center px-3 py-1.5 rounded-full ${colors.bg} dark:${colors.bgDark}`}
      >
        <Text
          className={`text-sm font-semibold ${colors.text} dark:${colors.textDark}`}
        >
          {Math.round(percentile)}th percentile
        </Text>
      </View>
    );
  }

  return (
    <View className="bg-surface-card dark:bg-surface-dark-card rounded-2xl p-4">
      <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mb-1">
        {measurementLabel}
      </Text>

      <View className="flex-row items-baseline mb-2">
        <Text className="text-3xl font-bold text-content-primary dark:text-content-dark-primary">
          {measurementType === "weight" ? value.toFixed(2) : value.toFixed(1)}
        </Text>
        <Text className="text-lg text-content-secondary dark:text-content-dark-secondary ml-1">
          {unit}
        </Text>
      </View>

      <View className="flex-row items-center justify-between">
        <View
          className={`px-3 py-1.5 rounded-full ${colors.bg} dark:${colors.bgDark}`}
        >
          <Text
            className={`text-sm font-semibold ${colors.text} dark:${colors.textDark}`}
          >
            {Math.round(percentile)}th percentile
          </Text>
        </View>

        <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary">
          {classificationLabel}
        </Text>
      </View>

      {/* Visual percentile bar */}
      <View className="mt-3">
        <View className="h-2 bg-border-subtle dark:bg-border-dark-subtle rounded-full overflow-hidden">
          {/* Background zones */}
          <View className="absolute inset-0 flex-row">
            <View className="flex-1 bg-red-200/50" style={{ flex: 3 }} />
            <View className="flex-1 bg-orange-200/50" style={{ flex: 12 }} />
            <View className="flex-1 bg-green-200/50" style={{ flex: 70 }} />
            <View className="flex-1 bg-orange-200/50" style={{ flex: 12 }} />
            <View className="flex-1 bg-red-200/50" style={{ flex: 3 }} />
          </View>

          {/* Marker */}
          <View
            className="absolute top-0 bottom-0 w-1 bg-activity-growth dark:bg-activity-growth-dark rounded-full"
            style={{
              left: `${Math.min(Math.max(percentile, 0), 100)}%`,
              marginLeft: -2,
            }}
          />
        </View>

        {/* Scale labels */}
        <View className="flex-row justify-between mt-1">
          <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary">
            3rd
          </Text>
          <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary">
            50th
          </Text>
          <Text className="text-xs text-content-tertiary dark:text-content-dark-tertiary">
            97th
          </Text>
        </View>
      </View>
    </View>
  );
}

export default PercentileDisplay;
