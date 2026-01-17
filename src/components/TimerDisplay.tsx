import { Pressable, Text, View } from "react-native";
import { forwardRef } from "react";

type TimerActivityType = "feeding" | "sleep" | "pumping" | "tummyTime";
type BreastSide = "left" | "right" | "both";

interface TimerDisplayProps {
  activity: TimerActivityType;
  elapsedTime: string;
  side?: BreastSide;
  onSideChange?: (side: BreastSide) => void;
  onStop: () => void;
  label?: string;
  testID?: string;
}

const activityColors: Record<TimerActivityType, { primary: string; muted: string }> = {
  feeding: { primary: "#88B04B", muted: "#E8F0E0" },
  sleep: { primary: "#6B5B95", muted: "#E8E4F0" },
  pumping: { primary: "#7B9BC9", muted: "#E8EDF5" },
  tummyTime: { primary: "#E67E22", muted: "#FEF3E2" },
};

const activityIcons: Record<TimerActivityType, string> = {
  feeding: "🤱",
  sleep: "😴",
  pumping: "🫙",
  tummyTime: "💪",
};

const TimerDisplay = forwardRef<View, TimerDisplayProps>(
  (
    {
      activity,
      elapsedTime,
      side,
      onSideChange,
      onStop,
      label,
      testID,
    },
    ref
  ) => {
    const colors = activityColors[activity];
    const icon = activityIcons[activity];
    const showSideSelector = activity === "feeding" || activity === "pumping";

    return (
      <View
        ref={ref}
        testID={testID}
        className="items-center justify-center py-8 px-6"
      >
        {/* Activity icon and label */}
        <View className="flex-row items-center mb-4">
          <Text className="text-4xl mr-3">{icon}</Text>
          {label && (
            <Text
              className="text-lg font-semibold"
              style={{ color: colors.primary }}
            >
              {label}
            </Text>
          )}
        </View>

        {/* Side selector for breastfeeding/pumping */}
        {showSideSelector && onSideChange && (
          <View className="flex-row mb-6 rounded-pill p-1" style={{ backgroundColor: colors.muted }}>
            <SideButton
              label="L"
              fullLabel="Left"
              isSelected={side === "left"}
              onPress={() => onSideChange("left")}
              color={colors.primary}
            />
            <SideButton
              label="B"
              fullLabel="Both"
              isSelected={side === "both"}
              onPress={() => onSideChange("both")}
              color={colors.primary}
            />
            <SideButton
              label="R"
              fullLabel="Right"
              isSelected={side === "right"}
              onPress={() => onSideChange("right")}
              color={colors.primary}
            />
          </View>
        )}

        {/* Timer display - large and prominent */}
        <View
          className="px-10 py-6 rounded-card-lg mb-8"
          style={{ backgroundColor: colors.muted }}
        >
          <Text
            className="text-timer-xl text-center font-bold tracking-tight"
            style={{ color: colors.primary }}
            accessibilityLabel={`Timer: ${elapsedTime}`}
          >
            {elapsedTime}
          </Text>
        </View>

        {/* Pulsing indicator */}
        <View className="flex-row items-center mb-8">
          <View
            className="w-3 h-3 rounded-full mr-2"
            style={{ backgroundColor: colors.primary }}
          />
          <Text className="text-base text-content-secondary dark:text-content-dark-secondary">
            Timer running
          </Text>
        </View>

        {/* Stop button - large and prominent */}
        <Pressable
          onPress={onStop}
          className="w-touch-xl h-touch-xl rounded-full items-center justify-center active:scale-95"
          style={{ backgroundColor: colors.primary }}
          accessibilityRole="button"
          accessibilityLabel="Stop timer"
        >
          <Text className="text-3xl text-white">⏹</Text>
        </Pressable>

        <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-3">
          Tap to stop
        </Text>
      </View>
    );
  }
);

// Side selector button component
interface SideButtonProps {
  label: string;
  fullLabel: string;
  isSelected: boolean;
  onPress: () => void;
  color: string;
}

function SideButton({ label, fullLabel, isSelected, onPress, color }: SideButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`
        min-w-[64px] min-h-[48px] rounded-pill items-center justify-center px-4
        active:scale-95
      `}
      style={isSelected ? { backgroundColor: color } : undefined}
      accessibilityRole="button"
      accessibilityLabel={fullLabel}
      accessibilityState={{ selected: isSelected }}
    >
      <Text
        className={`text-base font-semibold ${isSelected ? "text-white" : ""}`}
        style={!isSelected ? { color } : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
}

TimerDisplay.displayName = "TimerDisplay";

export { TimerDisplay, type TimerDisplayProps, type TimerActivityType, type BreastSide };
