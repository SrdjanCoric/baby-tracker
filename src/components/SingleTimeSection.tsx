import { useCallback, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { formatDate, formatTime, type TimeFormat } from "@/utils/time";

interface SingleTimeSectionProps {
  value: Date;
  onChange(value: Date): void;
  timeFormat: TimeFormat;
  label: string;
  doneLabel: string;
  selectDateLabel: string;
  selectTimeLabel: string;
  accentColor: string;
  mutedBackgroundColor: string;
  textColor: string;
  includeFieldLabelInAccessibilityLabel?: boolean;
  error?: string;
}

export function SingleTimeSection({
  value,
  onChange,
  timeFormat,
  label,
  doneLabel,
  selectDateLabel,
  selectTimeLabel,
  accentColor,
  mutedBackgroundColor,
  textColor,
  includeFieldLabelInAccessibilityLabel = false,
  error,
}: SingleTimeSectionProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const [androidMode, setAndroidMode] = useState<"date" | "time" | null>(null);

  const handleAndroidChange = useCallback(
    (event: DateTimePickerEvent, selected?: Date) => {
      const mode = androidMode;
      setAndroidMode(null);
      if (!mode || event.type === "dismissed" || !selected) return;
      const next = new Date(value);
      if (mode === "date") {
        next.setFullYear(
          selected.getFullYear(),
          selected.getMonth(),
          selected.getDate()
        );
      } else {
        next.setHours(selected.getHours());
        next.setMinutes(selected.getMinutes());
      }
      onChange(next);
    },
    [androidMode, onChange, value]
  );

  const accessibilityLabel = (controlLabel: string) =>
    includeFieldLabelInAccessibilityLabel
      ? `${label} ${controlLabel}`
      : controlLabel;

  return (
    <View className="mb-6">
      <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary mb-3">
        {label}
      </Text>
      <View className="flex-row gap-3">
        <Pressable
          onPress={() =>
            Platform.OS === "ios" ? setIosOpen(true) : setAndroidMode("date")
          }
          className="flex-1 flex-row items-center justify-between rounded-card-lg px-4 py-3"
          style={{ backgroundColor: mutedBackgroundColor }}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel(selectDateLabel)}
        >
          <Text className="text-base" style={{ color: textColor }}>
            {formatDate(value)}
          </Text>
          <Text style={{ color: accentColor }}>📅</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            Platform.OS === "ios" ? setIosOpen(true) : setAndroidMode("time")
          }
          className="flex-1 flex-row items-center justify-between rounded-card-lg px-4 py-3"
          style={{ backgroundColor: mutedBackgroundColor }}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel(selectTimeLabel)}
        >
          <Text className="text-base" style={{ color: textColor }}>
            {formatTime(value, timeFormat)}
          </Text>
          <Text style={{ color: accentColor }}>🕐</Text>
        </Pressable>
      </View>
      {error ? <Text className="text-red-500 text-sm mt-2">{error}</Text> : null}

      {iosOpen ? (
        <View>
          <View className="flex-row justify-end px-2">
            <Pressable
              onPress={() => setIosOpen(false)}
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
            value={value}
            mode="datetime"
            display="spinner"
            maximumDate={new Date()}
            onChange={(_event, selected) => {
              if (selected) onChange(selected);
            }}
          />
        </View>
      ) : null}
      {androidMode ? (
        <DateTimePicker
          value={value}
          mode={androidMode}
          display="default"
          maximumDate={new Date()}
          onChange={handleAndroidChange}
        />
      ) : null}
    </View>
  );
}
