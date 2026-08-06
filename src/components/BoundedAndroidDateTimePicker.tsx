import DatePicker from "react-native-date-picker";
import type { TimeFormat } from "@/contexts/time-format-context";
import type { TimerStartBounds } from "@/utils/timer-start-bounds";

interface BoundedAndroidDateTimePickerProps {
  value: Date;
  bounds: TimerStartBounds;
  timeFormat: TimeFormat;
  onChange(value: Date): void;
}

export function BoundedAndroidDateTimePicker({
  value,
  bounds,
  timeFormat,
  onChange,
}: BoundedAndroidDateTimePickerProps) {
  return (
    <DatePicker
      testID="bounded-android-datetime-picker"
      date={value}
      mode="datetime"
      minimumDate={bounds.minimumDate}
      maximumDate={bounds.maximumDate}
      locale={timeFormat === "24h" ? "en_GB" : "en_US"}
      is24hourSource="locale"
      onDateChange={onChange}
    />
  );
}
