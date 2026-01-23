import { Pressable, Text, View } from "react-native";
import { forwardRef } from "react";
import { ACTIVITY_CONFIG } from "@/constants/activities";

type QuickActionType =
  | "breastfeed-left"
  | "breastfeed-right"
  | "bottle"
  | "solid-food"
  | "sleep"
  | "diaper-wet"
  | "diaper-dirty"
  | "diaper-both"
  | "pumping"
  | "tummy-time";

interface QuickActionButtonProps {
  type: QuickActionType;
  label: string;
  sublabel?: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

const actionConfig: Record<
  QuickActionType,
  { icon: string; color: string; bgColor: string }
> = {
  "breastfeed-left": {
    icon: "🤱",
    color: ACTIVITY_CONFIG.feeding.accentColor,
    bgColor: ACTIVITY_CONFIG.feeding.mutedBg,
  },
  "breastfeed-right": {
    icon: "🤱",
    color: ACTIVITY_CONFIG.feeding.accentColor,
    bgColor: ACTIVITY_CONFIG.feeding.mutedBg,
  },
  bottle: {
    icon: "🍼",
    color: ACTIVITY_CONFIG.feeding.accentColor,
    bgColor: ACTIVITY_CONFIG.feeding.mutedBg,
  },
  "solid-food": {
    icon: "🍎",
    color: ACTIVITY_CONFIG.feeding.accentColor,
    bgColor: ACTIVITY_CONFIG.feeding.mutedBg,
  },
  sleep: {
    icon: "😴",
    color: ACTIVITY_CONFIG.sleep.accentColor,
    bgColor: ACTIVITY_CONFIG.sleep.mutedBg,
  },
  "diaper-wet": {
    icon: "💧",
    color: ACTIVITY_CONFIG.pumping.accentColor,
    bgColor: ACTIVITY_CONFIG.pumping.mutedBg,
  },
  "diaper-dirty": {
    icon: "💩",
    color: ACTIVITY_CONFIG.diaper.accentColor,
    bgColor: ACTIVITY_CONFIG.diaper.mutedBg,
  },
  "diaper-both": {
    icon: "🚼",
    color: ACTIVITY_CONFIG.diaper.accentColor,
    bgColor: ACTIVITY_CONFIG.diaper.mutedBg,
  },
  pumping: {
    icon: "🫙",
    color: ACTIVITY_CONFIG.pumping.accentColor,
    bgColor: ACTIVITY_CONFIG.pumping.mutedBg,
  },
  "tummy-time": {
    icon: "💪",
    color: ACTIVITY_CONFIG.tummyTime.accentColor,
    bgColor: ACTIVITY_CONFIG.tummyTime.mutedBg,
  },
};

const QuickActionButton = forwardRef<View, QuickActionButtonProps>(
  ({ type, label, sublabel, onPress, disabled = false, testID }, ref) => {
    const config = actionConfig[type];

    return (
      <Pressable
        ref={ref}
        onPress={onPress}
        disabled={disabled}
        testID={testID}
        className={`
          min-h-touch-lg rounded-card p-4
          items-center justify-center
          active:scale-[0.97] active:opacity-90
          ${disabled ? "opacity-50" : ""}
        `}
        style={{ backgroundColor: config.bgColor }}
        accessibilityRole="button"
        accessibilityLabel={`${label}${sublabel ? `, ${sublabel}` : ""}`}
        accessibilityState={{ disabled }}
      >
        {/* Icon */}
        <View
          className="w-14 h-14 rounded-full items-center justify-center mb-3"
          style={{ backgroundColor: config.color }}
        >
          <Text className="text-2xl">{config.icon}</Text>
        </View>

        {/* Label */}
        <Text
          className="text-base font-semibold text-center"
          style={{ color: config.color }}
        >
          {label}
        </Text>

        {/* Sublabel */}
        {sublabel && (
          <Text
            className="text-sm text-center mt-1 opacity-70"
            style={{ color: config.color }}
          >
            {sublabel}
          </Text>
        )}
      </Pressable>
    );
  }
);

QuickActionButton.displayName = "QuickActionButton";

// Compound component for side-by-side breast buttons
interface BreastfeedingButtonsProps {
  onLeftPress: () => void;
  onRightPress: () => void;
  lastSide?: "left" | "right";
  testID?: string;
}

function BreastfeedingButtons({
  onLeftPress,
  onRightPress,
  lastSide,
  testID,
}: BreastfeedingButtonsProps) {
  const suggestedSide = lastSide === "left" ? "right" : "left";

  return (
    <View testID={testID} className="flex-row gap-3">
      <View className="flex-1">
        <QuickActionButton
          type="breastfeed-left"
          label="Left"
          sublabel={suggestedSide === "left" ? "Suggested" : undefined}
          onPress={onLeftPress}
        />
      </View>
      <View className="flex-1">
        <QuickActionButton
          type="breastfeed-right"
          label="Right"
          sublabel={suggestedSide === "right" ? "Suggested" : undefined}
          onPress={onRightPress}
        />
      </View>
    </View>
  );
}

// Compound component for diaper type buttons
interface DiaperButtonsProps {
  onWetPress: () => void;
  onDirtyPress: () => void;
  onBothPress: () => void;
  testID?: string;
}

function DiaperButtons({
  onWetPress,
  onDirtyPress,
  onBothPress,
  testID,
}: DiaperButtonsProps) {
  return (
    <View testID={testID} className="flex-row gap-3">
      <View className="flex-1">
        <QuickActionButton
          type="diaper-wet"
          label="Wet"
          onPress={onWetPress}
        />
      </View>
      <View className="flex-1">
        <QuickActionButton
          type="diaper-dirty"
          label="Dirty"
          onPress={onDirtyPress}
        />
      </View>
      <View className="flex-1">
        <QuickActionButton
          type="diaper-both"
          label="Both"
          onPress={onBothPress}
        />
      </View>
    </View>
  );
}

export {
  QuickActionButton,
  BreastfeedingButtons,
  DiaperButtons,
  type QuickActionButtonProps,
  type QuickActionType,
  type BreastfeedingButtonsProps,
  type DiaperButtonsProps,
};
