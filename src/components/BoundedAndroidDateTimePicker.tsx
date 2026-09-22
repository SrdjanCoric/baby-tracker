import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import DatePicker from "react-native-date-picker";
import type { TimeFormat } from "@/contexts/time-format-context";
import type { TimerStartBounds } from "@/utils/timer-start-bounds";

function isForegroundState(state: AppStateStatus): boolean {
  return state !== "background" && state !== "inactive";
}

// The native datetime wheels advance at minute resolution; allow one step to animate.
const MAX_ANIMATED_DATE_DELTA_MS = 60 * 1000;

interface PickerSnapshot {
  value: number;
  minimumDate: number;
  maximumDate: number;
}

function hasLargeProgrammaticChange(
  previous: PickerSnapshot,
  next: PickerSnapshot
): boolean {
  return [
    Math.abs(next.value - previous.value),
    Math.abs(next.minimumDate - previous.minimumDate),
    Math.abs(next.maximumDate - previous.maximumDate),
  ].some(delta => delta > MAX_ANIMATED_DATE_DELTA_MS);
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
  const previousPickerSnapshot = useRef<PickerSnapshot | undefined>(undefined);
  const [pickerInstance, setPickerInstance] = useState(0);
  const userChangePending = useRef(false);
  const valueTime = value.getTime();
  const minimumDateTime = bounds.minimumDate.getTime();
  const maximumDateTime = bounds.maximumDate.getTime();
  const pickerSnapshot: PickerSnapshot = {
    value: valueTime,
    minimumDate: minimumDateTime,
    maximumDate: maximumDateTime,
  };

  const isUserChange = userChangePending.current;
  const isLargeProgrammaticChange = Boolean(
    !isUserChange &&
      previousPickerSnapshot.current &&
      hasLargeProgrammaticChange(previousPickerSnapshot.current, pickerSnapshot)
  );

  useLayoutEffect(() => {
    if (isLargeProgrammaticChange) {
      setPickerInstance(instance => instance + 1);
    }
    previousPickerSnapshot.current = {
      value: valueTime,
      minimumDate: minimumDateTime,
      maximumDate: maximumDateTime,
    };
    userChangePending.current = false;
  }, [
    isLargeProgrammaticChange,
    maximumDateTime,
    minimumDateTime,
    valueTime,
  ]);

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
      key={pickerInstance + (isLargeProgrammaticChange ? 1 : 0)}
      testID="bounded-android-datetime-picker"
      date={value}
      mode="datetime"
      minimumDate={bounds.minimumDate}
      maximumDate={bounds.maximumDate}
      locale={timeFormat === "24h" ? "en_GB" : "en_US"}
      is24hourSource="locale"
      onDateChange={(nextValue: Date) => {
        userChangePending.current = true;
        onChange(nextValue);
      }}
    />
  );
}
