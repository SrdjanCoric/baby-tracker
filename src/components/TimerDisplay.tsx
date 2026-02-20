import { Pressable, Text, View } from "react-native";
import { forwardRef } from "react";
import { ACTIVITY_CONFIG, type TimerActivityType, type BreastSide } from "@/constants/activities";
import { useAppTranslation } from "@/hooks/useAppTranslation";

interface TimerDisplayProps {
  activity: TimerActivityType;
  elapsedTime: string;
  side?: BreastSide;
  onSideChange?: (side: BreastSide) => void;
  onStop: () => void;
  label?: string;
  testID?: string;
}

function getActivityColors(activity: TimerActivityType) {
  const config = ACTIVITY_CONFIG[activity];
  return { primary: config.accentColor, muted: config.mutedBg };
}

function getActivityIcon(activity: TimerActivityType) {
  return ACTIVITY_CONFIG[activity].icon;
}

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
    const { t } = useAppTranslation();
    const colors = getActivityColors(activity);
    const icon = getActivityIcon(activity);
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
              label={t("feeding.leftShort")}
              fullLabel={t("feeding.left")}
              isSelected={side === "left"}
              onPress={() => onSideChange("left")}
              color={colors.primary}
            />
            <SideButton
              label="B"
              fullLabel={t("feeding.both")}
              isSelected={side === "both"}
              onPress={() => onSideChange("both")}
              color={colors.primary}
            />
            <SideButton
              label={t("feeding.rightShort")}
              fullLabel={t("feeding.right")}
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
            {t("common.timerRunning")}
          </Text>
        </View>

        {/* Stop button - large and prominent */}
        <Pressable
          onPress={onStop}
          className="w-touch-xl h-touch-xl rounded-full items-center justify-center active:scale-95"
          style={{ backgroundColor: colors.primary }}
          accessibilityRole="button"
          accessibilityLabel={t("common.stopTimer")}
        >
          <Text className="text-3xl text-white">⏹</Text>
        </Pressable>

        <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-3">
          {t("common.tapToStop")}
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

export { TimerDisplay, type TimerDisplayProps };
export type { TimerActivityType, BreastSide } from "@/constants/activities";
