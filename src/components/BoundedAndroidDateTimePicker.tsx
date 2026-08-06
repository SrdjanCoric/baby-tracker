import { Pressable, Text, View } from "react-native";
import type { TimeFormat } from "@/contexts/time-format-context";
import { formatTime } from "@/utils/time";
import type { TimerStartBounds } from "@/utils/timer-start-bounds";

interface BoundedAndroidDateTimePickerProps {
  value: Date;
  bounds: TimerStartBounds;
  timeFormat: TimeFormat;
  accentColor: string;
  onChange(value: Date): void;
}

const ADJUSTMENTS = [
  { minutes: -60, label: "−1h", testID: "timer-start-decrease-hour" },
  { minutes: -1, label: "−1m", testID: "timer-start-decrease-minute" },
  { minutes: 1, label: "+1m", testID: "timer-start-increase-minute" },
  { minutes: 60, label: "+1h", testID: "timer-start-increase-hour" },
] as const;

export function BoundedAndroidDateTimePicker({
  value,
  bounds,
  timeFormat,
  accentColor,
  onChange,
}: BoundedAndroidDateTimePickerProps) {
  const valueTime = value.getTime();
  const minimumTime = bounds.minimumDate.getTime();
  const maximumTime = bounds.maximumDate.getTime();

  return (
    <View testID="bounded-android-datetime-picker" className="px-4 pb-4">
      <Text
        testID="timer-start-android-value"
        className="text-center text-lg font-semibold py-3"
        style={{ color: accentColor }}
      >
        {`${value.toLocaleDateString()} · ${formatTime(value, timeFormat)}`}
      </Text>
      <View className="flex-row justify-center gap-2">
        {ADJUSTMENTS.map(adjustment => {
          const nextTime = valueTime + adjustment.minutes * 60_000;
          const disabled = nextTime < minimumTime || nextTime > maximumTime;
          return (
            <Pressable
              key={adjustment.testID}
              testID={adjustment.testID}
              accessibilityRole="button"
              accessibilityLabel={adjustment.label}
              disabled={disabled}
              onPress={() => onChange(new Date(nextTime))}
              className="min-w-14 py-3 px-3 rounded-lg border items-center"
              style={{ borderColor: accentColor, opacity: disabled ? 0.35 : 1 }}
            >
              <Text style={{ color: accentColor }}>{adjustment.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
