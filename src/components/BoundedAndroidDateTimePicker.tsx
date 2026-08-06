import DatePicker from "react-native-date-picker";
import type { TimerStartBounds } from "@/utils/timer-start-bounds";

interface BoundedAndroidDateTimePickerProps {
  value: Date;
  bounds: TimerStartBounds;
  onChange(value: Date): void;
}

export function BoundedAndroidDateTimePicker({
  value,
  bounds,
  onChange,
}: BoundedAndroidDateTimePickerProps) {
  return (
    <DatePicker
      testID="bounded-android-datetime-picker"
      date={value}
      mode="datetime"
      minimumDate={bounds.minimumDate}
      maximumDate={bounds.maximumDate}
      onDateChange={onChange}
    />
  );
}
