import { useCallback, useState } from "react";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Platform, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TimeFormat } from "@/contexts/time-format-context";
import { formatTime } from "@/utils/time";
import {
  normalizeTimerStartSelection,
  type TimerStartBounds,
} from "@/utils/timer-start-bounds";

interface RunningTimerStartEditorProps {
  startLabel: string;
  startedAt: Date;
  starterName: string;
  canEdit: boolean;
  bounds: TimerStartBounds;
  timeFormat: TimeFormat;
  accentColor: string;
  mutedBackgroundColor: string;
  onEdit(startedAt: Date): void | Promise<void>;
}

export function RunningTimerStartEditor({
  startLabel,
  startedAt,
  starterName,
  canEdit,
  bounds,
  timeFormat,
  accentColor,
  mutedBackgroundColor,
  onEdit,
}: RunningTimerStartEditorProps) {
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);
  const label = `${startLabel}: ${formatTime(startedAt, timeFormat)} · ${starterName}`;
  const handleChange = useCallback(
    (_event: DateTimePickerEvent, selectedTime?: Date) => {
      if (Platform.OS === "android") setShowPicker(false);
      if (!selectedTime) return;
      const now = new Date();
      void onEdit(
        normalizeTimerStartSelection(
          selectedTime,
          bounds,
          now,
          Platform.OS
        )
      );
    },
    [bounds, onEdit]
  );

  const content = (
    <Text className="text-sm font-medium" style={{ color: accentColor }}>
      {label}
    </Text>
  );

  return (
    <>
      {canEdit ? (
        <Pressable
          onPress={() => setShowPicker(true)}
          className="mb-5 py-3 px-5 rounded-full"
          style={{ backgroundColor: mutedBackgroundColor }}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          {content}
        </Pressable>
      ) : (
        <View
          className="mb-5 py-3 px-5 rounded-full"
          style={{ backgroundColor: mutedBackgroundColor }}
          accessibilityLabel={label}
        >
          {content}
        </View>
      )}

      {showPicker && (
        <View className="absolute bottom-0 left-0 right-0 z-10 bg-surface dark:bg-surface-dark">
          {Platform.OS === "ios" && (
            <View className="flex-row justify-end px-4 py-2 border-t border-border dark:border-border-dark">
              <Pressable
                onPress={() => setShowPicker(false)}
                className="py-2 px-4"
                accessibilityRole="button"
                accessibilityLabel={t("common.done")}
              >
                <Text className="font-semibold" style={{ color: accentColor }}>
                  {t("common.done")}
                </Text>
              </Pressable>
            </View>
          )}
          <DateTimePicker
            value={startedAt}
            mode={Platform.OS === "ios" ? "datetime" : "time"}
            display="spinner"
            onChange={handleChange}
            is24Hour={Platform.OS === "android" ? timeFormat === "24h" : undefined}
            minimumDate={bounds.minimumDate}
            maximumDate={bounds.maximumDate}
          />
        </View>
      )}
    </>
  );
}
