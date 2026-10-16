import { useCallback, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { calculateActiveDurationSeconds } from "@/utils/timer-duration";
import { formatDate, formatDuration, formatTime } from "@/utils/time";
import type { TimeFormat } from "@/contexts/time-format-context";

export interface DateTimeBounds {
  minimumDate?: Date;
  maximumDate: Date;
}

type DateTimeBoundsSource = DateTimeBounds | (() => DateTimeBounds);

interface DurationInput {
  minutes: string;
  onMinutesChange(text: string): void;
  unitLabel: string;
  endSummary: string;
}

interface SharedProps {
  startTime: Date;
  onStartTimeChange(value: Date): void;
  startBounds: DateTimeBoundsSource;
  timeFormat: TimeFormat;
  startLabel: string;
  durationLabel: string;
  doneLabel: string;
  selectDateLabel: string;
  selectTimeLabel: string;
  accentColor: string;
  mutedBackgroundColor: string;
  textColor: string;
  startError?: string;
  durationError?: string;
}

interface EndPickerProps extends SharedProps {
  endTime: Date;
  // Sleep passes no pause; its pauses count toward its duration.
  pause?: { seconds: number; label: string };
  onEndTimeChange(value: Date): void;
  endBounds: DateTimeBoundsSource;
  endLabel: string;
  endError?: string;
  durationInput?: undefined;
}

// Breast feeds and pumping edit Duration instead of End; End is derived and shown as a summary line.
interface DurationInputProps extends SharedProps {
  durationInput: DurationInput;
}

type StartEndTimeSectionProps = EndPickerProps | DurationInputProps;

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

export function StartEndTimeSection(props: StartEndTimeSectionProps) {
  const {
    startTime,
    onStartTimeChange,
    startBounds,
    timeFormat,
    startLabel,
    durationLabel,
    doneLabel,
    selectDateLabel,
    selectTimeLabel,
    accentColor,
    mutedBackgroundColor,
    textColor,
    startError,
    durationError,
  } = props;
  const endPicker = props.durationInput ? null : props;
  const endTime = endPicker?.endTime;
  const endBounds = endPicker?.endBounds;
  const onEndTimeChange = endPicker?.onEndTimeChange;
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
      if (!source) return null;
      return typeof source === "function" ? source() : source;
    },
    [startBounds, endBounds]
  );
  const update = useCallback(
    (target: PickerTarget, value: Date) => {
      if (target === "start") onStartTimeChange(value);
      else onEndTimeChange?.(value);
    },
    [onStartTimeChange, onEndTimeChange]
  );

  const openPicker = useCallback(
    (target: PickerTarget, mode: AndroidPickerMode) => {
      const bounds = boundsFor(target);
      if (!bounds) return;
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
      const bounds = boundsFor(androidPicker.target);
      if (!current || !bounds) return;
      const next = new Date(current);
      if (androidPicker.mode === "date") {
        next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      } else {
        next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      }
      update(androidPicker.target, clampToBounds(next, bounds));
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
      {error ? (
        <Text className="text-red-500 text-sm mt-2">{error}</Text>
      ) : null}
    </View>
  );

  const pause = endPicker?.pause;
  const durationSeconds = endPicker
    ? calculateActiveDurationSeconds(startTime, endPicker.endTime, pause?.seconds ?? 0)
    : 0;
  const shownPause = pause && pause.seconds > 0 ? pause : null;
  const iosBounds = iosTarget ? boundsFor(iosTarget) : null;
  const iosValue = iosTarget ? valueFor(iosTarget) : undefined;
  const androidBounds = androidPicker ? boundsFor(androidPicker.target) : null;
  const androidValue = androidPicker ? valueFor(androidPicker.target) : undefined;

  return (
    <>
      {renderTimeRow("start", startLabel, startTime, startError)}
      {endPicker
        ? renderTimeRow("end", endPicker.endLabel, endPicker.endTime, endPicker.endError)
        : null}

      {iosTarget && iosBounds && iosValue ? (
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
            value={clampToBounds(iosValue, iosBounds)}
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

      {androidPicker && androidBounds && androidValue ? (
        <DateTimePicker
          value={clampToBounds(androidValue, androidBounds)}
          mode={androidPicker.mode}
          display="default"
          minimumDate={androidBounds.minimumDate}
          maximumDate={androidBounds.maximumDate}
          onChange={handleAndroidChange}
        />
      ) : null}

      {props.durationInput ? (
        <>
          <View
            className={`${props.durationInput.endSummary ? "mb-2" : "mb-6"} flex-row items-center justify-between gap-3`}
          >
            <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary">
              {durationLabel}
            </Text>
            <View
              className="w-28 flex-row items-center justify-end gap-1.5 rounded-card-lg px-4 py-3"
              style={{ backgroundColor: mutedBackgroundColor }}
            >
              <TextInput
                testID="duration-minutes-input"
                value={props.durationInput.minutes}
                onChangeText={(text) =>
                  props.durationInput?.onMinutesChange(text.replace(/\D/g, ""))
                }
                keyboardType="number-pad"
                maxLength={3}
                accessibilityLabel={durationLabel}
                className="flex-1 text-right text-lg font-semibold p-0"
                style={{ color: textColor }}
              />
              <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
                {props.durationInput.unitLabel}
              </Text>
            </View>
          </View>
          {props.durationInput.endSummary ? (
            <Text className="mb-6 px-4 text-sm text-content-secondary dark:text-content-dark-secondary">
              {props.durationInput.endSummary}
            </Text>
          ) : null}
        </>
      ) : (
        <>
          <View
            className={`${shownPause ? "mb-2" : "mb-6"} flex-row items-center justify-between rounded-card-lg border border-dashed px-4 py-3`}
            style={{
              backgroundColor: mutedBackgroundColor,
              borderColor: accentColor,
            }}
            accessibilityLabel={`${durationLabel}: ${formatDuration(durationSeconds, "short")}`}
          >
            <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
              {durationLabel}
            </Text>
            <Text className="text-lg font-semibold" style={{ color: textColor }}>
              {formatDuration(durationSeconds, "short")}
            </Text>
          </View>
          {shownPause ? (
            <View
              testID="paused-line"
              className="mb-6 flex-row justify-between px-4"
              accessible
              accessibilityLabel={`${shownPause.label}: ${formatDuration(shownPause.seconds, "short")}`}
            >
              <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
                {shownPause.label}
              </Text>
              <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
                {formatDuration(shownPause.seconds, "short")}
              </Text>
            </View>
          ) : null}
        </>
      )}
      {durationError ? (
        <Text className="text-red-500 text-sm -mt-4 mb-6">{durationError}</Text>
      ) : null}
    </>
  );
}
