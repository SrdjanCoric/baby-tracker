import { useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import DatePicker from "react-native-date-picker";
import type { TimeFormat } from "@/contexts/time-format-context";
import type { TimerStartBounds } from "@/utils/timer-start-bounds";

function isForegroundState(state: AppStateStatus): boolean {
  return state !== "background" && state !== "inactive";
}

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
  // react-native-date-picker animates a value change by posting one main-thread
  // runnable per scroll step, 100ms apart (AndroidNative.smoothScrollToValue). A
  // large delta queues hundreds of them, each one running setText -> an input
  // filter -> another View.post. If the app is backgrounded while that chain is
  // still draining, the main thread stays saturated and Android records a
  // background ANR. Unmounting the spinner when the app leaves the foreground
  // drops the queued work with the view.
  // Only an explicit background/inactive state hides the spinner. AppState.currentState
  // can be "unknown" before the first transition, and defaulting that to hidden would
  // leave the picker invisible on screens that mount it directly.
  const [isForeground, setIsForeground] = useState(() =>
    isForegroundState(AppState.currentState)
  );

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        setIsForeground(isForegroundState(nextState));
      }
    );

    return () => subscription.remove();
  }, []);

  if (!isForeground) return null;

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
