import { useCallback, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { formatDate, formatDuration, formatTime } from "@/utils/time";
import type { TimeFormat } from "@/contexts/time-format-context";

export interface DateTimeBounds {
  minimumDate?: Date;
  maximumDate: Date;
}

type DateTimeBoundsSource = DateTimeBounds | (() => DateTimeBounds);

interface StartEndTimeSectionProps {
  startTime: Date;
  endTime: Date;
  onStartTimeChange(value: Date): void;
  onEndTimeChange(value: Date): void;
  startBounds: DateTimeBoundsSource;
  endBounds: DateTimeBoundsSource;
  timeFormat: TimeFormat;
  startLabel: string;
  endLabel: string;
  durationLabel: string;
  doneLabel: string;
  selectDateLabel: string;
  selectTimeLabel: string;
  accentColor: string;
  mutedBackgroundColor: string;
  textColor: string;
  startError?: string;
  endError?: string;
  durationError?: string;
}

type PickerTarget = "start" | "end";
type AndroidPickerMode = "date" | "time";

function clampToBounds(value: Date, bounds: DateTimeBounds): Date {
  if (bounds.minimumDate && value < bounds.minimumDate) {
    return bounds.minimumDate;
  }
  if (value > bounds.maximumDate) {
    return bounds.maximumDate;
  }
  return value;
}

export function StartEndTimeSection({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  startBounds,
  endBounds,
  timeFormat,
  startLabel,
  endLabel,
  durationLabel,
  doneLabel,
  selectDateLabel,
  selectTimeLabel,
  accentColor,
  mutedBackgroundColor,
  textColor,
  startError,
  endError,
  durationError,
}: StartEndTimeSectionProps) {
  const [iosTarget, setIosTarget] = useState<PickerTarget | null>(null);
  const [androidPicker, setAndroidPicker] = useState<{
    target: PickerTarget;
    mode: AndroidPickerMode;
  } | null>(null);

  const valueFor = useCallback(
    (target: PickerTarget) => (target === "start" ? startTime : endTime),
    [startTime, endTime]
  );
  const boundsFor = useCallback(
    (target: PickerTarget) => {
      const source = target === "start" ? startBounds : endBounds;
      return typeof source === "function" ? source() : source;
    },
    [startBounds, endBounds]
  );
  const update = useCallback(
    (target: PickerTarget, value: Date) => {
      if (target === "start") onStartTimeChange(value);
      else onEndTimeChange(value);
    },
    [onStartTimeChange, onEndTimeChange]
  );

  const openPicker = useCallback(
    (target: PickerTarget, mode: AndroidPickerMode) => {
      const bounds = boundsFor(target);
      if (bounds.minimumDate && bounds.minimumDate > bounds.maximumDate) return;
      if (Platform.OS === "ios") setIosTarget(target);
      else setAndroidPicker({ target, mode });
    },
    [boundsFor]
  );

  const handleAndroidChange = useCallback(
    (event: DateTimePickerEvent, selected?: Date) => {
      if (!androidPicker) return;
      setAndroidPicker(null);
      if (event.type === "dismissed" || !selected) return;

      const current = valueFor(androidPicker.target);
      const next = new Date(current);
      if (androidPicker.mode === "date") {
        next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      } else {
        next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      }
      update(androidPicker.target, clampToBounds(next, boundsFor(androidPicker.target)));
    },
    [androidPicker, boundsFor, update, valueFor]
  );

  const renderTimeRow = (
    target: PickerTarget,
    label: string,
    value: Date,
    error?: string
  ) => (
    <View className="mb-6">
      <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
        {label}
      </Text>
      <View className="flex-row gap-3">
        <Pressable
          onPress={() => openPicker(target, "date")}
          className="flex-1 flex-row items-center justify-between rounded-card-lg px-4 py-3"
          style={{ backgroundColor: mutedBackgroundColor }}
          accessibilityRole="button"
          accessibilityLabel={`${label} ${selectDateLabel}`}
        >
          <Text className="text-base" style={{ color: textColor }}>
            {formatDate(value)}
          </Text>
          <Text style={{ color: accentColor }}>📅</Text>
        </Pressable>
        <Pressable
          onPress={() => openPicker(target, "time")}
          className="flex-1 flex-row items-center justify-between rounded-card-lg px-4 py-3"
          style={{ backgroundColor: mutedBackgroundColor }}
          accessibilityRole="button"
          accessibilityLabel={`${label} ${selectTimeLabel}`}
        >
          <Text className="text-base" style={{ color: textColor }}>
            {formatTime(value, timeFormat)}
          </Text>
          <Text style={{ color: accentColor }}>🕐</Text>
        </Pressable>
      </View>
      {error ? <Text className="text-red-500 text-sm mt-2">{error}</Text> : null}
    </View>
  );

  const durationSeconds = Math.max(
    0,
    Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
  );
  const iosBounds = iosTarget ? boundsFor(iosTarget) : null;
  const androidBounds = androidPicker ? boundsFor(androidPicker.target) : null;

  return (
    <>
      {renderTimeRow("start", startLabel, startTime, startError)}
      {renderTimeRow("end", endLabel, endTime, endError)}

      {iosTarget && iosBounds ? (
        <View className="mb-6">
          <View className="flex-row justify-end px-2">
            <Pressable
              onPress={() => setIosTarget(null)}
              className="py-1 px-3"
              accessibilityRole="button"
              accessibilityLabel={doneLabel}
            >
              <Text className="text-sm font-semibold" style={{ color: accentColor }}>
                {doneLabel}
              </Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={clampToBounds(valueFor(iosTarget), iosBounds)}
            mode="datetime"
            display="spinner"
            minimumDate={iosBounds.minimumDate}
            maximumDate={iosBounds.maximumDate}
            onChange={(_event, value) => {
              if (value) update(iosTarget, value);
            }}
          />
        </View>
      ) : null}

      {androidPicker && androidBounds ? (
        <DateTimePicker
          value={clampToBounds(valueFor(androidPicker.target), androidBounds)}
          mode={androidPicker.mode}
          display="default"
          minimumDate={androidBounds.minimumDate}
          maximumDate={androidBounds.maximumDate}
          onChange={handleAndroidChange}
        />
      ) : null}

      <View
        className="mb-6 flex-row items-center justify-between rounded-card-lg border border-dashed px-4 py-3"
        style={{ backgroundColor: mutedBackgroundColor, borderColor: accentColor }}
        accessibilityLabel={`${durationLabel}: ${formatDuration(durationSeconds, "short")}`}
      >
        <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
          {durationLabel}
        </Text>
        <Text className="text-lg font-semibold" style={{ color: textColor }}>
          {formatDuration(durationSeconds, "short")}
        </Text>
      </View>
      {durationError ? (
        <Text className="text-red-500 text-sm -mt-4 mb-6">{durationError}</Text>
      ) : null}
    </>
  );
}
