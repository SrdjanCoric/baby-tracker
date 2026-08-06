import { useCallback, useState } from "react";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TimeFormat } from "@/contexts/time-format-context";
import { BoundedAndroidDateTimePicker } from "@/components/BoundedAndroidDateTimePicker";
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
  getBounds(): TimerStartBounds;
  timeFormat: TimeFormat;
  accentColor: string;
  mutedBackgroundColor: string;
  onEdit(startedAt: Date): void | Promise<void>;
}

function hasSelectableRange(bounds: TimerStartBounds): boolean {
  return bounds.minimumDate.getTime() <= bounds.maximumDate.getTime();
}

export function RunningTimerStartEditor({
  startLabel,
  startedAt,
  starterName,
  canEdit,
  getBounds,
  timeFormat,
  accentColor,
  mutedBackgroundColor,
  onEdit,
}: RunningTimerStartEditorProps) {
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);
  const [pickerBounds, setPickerBounds] = useState<TimerStartBounds>(() =>
    getBounds()
  );
  const [draftStartedAt, setDraftStartedAt] = useState(startedAt);
  const label = `${startLabel}: ${formatTime(startedAt, timeFormat)} · ${starterName}`;
  const handleOpen = useCallback(() => {
    const currentBounds = getBounds();
    setPickerBounds(currentBounds);
    setDraftStartedAt(startedAt);
    setShowPicker(hasSelectableRange(currentBounds));
  }, [getBounds, startedAt]);
  const commitEdit = useCallback(
    async (nextStartedAt: Date) => {
      try {
        await onEdit(nextStartedAt);
        setShowPicker(false);
      } catch {
        Alert.alert(t("common.error"), t("errors.generic"));
      }
    },
    [onEdit, t]
  );
  const handleChange = useCallback(
    (_event: DateTimePickerEvent, selectedTime?: Date) => {
      if (!selectedTime) return;
      const currentBounds = getBounds();
      setPickerBounds(currentBounds);
      const normalized = normalizeTimerStartSelection(
        selectedTime,
        currentBounds
      );

      setDraftStartedAt(normalized);
    },
    [getBounds]
  );
  const handleDone = useCallback(async () => {
    const currentBounds = getBounds();
    if (!hasSelectableRange(currentBounds)) {
      setPickerBounds(currentBounds);
      setShowPicker(false);
      Alert.alert(t("common.error"), t("errors.generic"));
      return;
    }
    const revalidatedStart = normalizeTimerStartSelection(
      draftStartedAt,
      currentBounds
    );
    setPickerBounds(currentBounds);
    setDraftStartedAt(revalidatedStart);
    await commitEdit(revalidatedStart);
  }, [commitEdit, draftStartedAt, getBounds, t]);

  const content = (
    <Text className="text-sm font-medium" style={{ color: accentColor }}>
      {label}
    </Text>
  );

  return (
    <>
      {canEdit ? (
        <Pressable
          testID="running-timer-start-editor"
          onPress={handleOpen}
          className="mb-5 py-3 px-5 rounded-full"
          style={{ backgroundColor: mutedBackgroundColor }}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          {content}
        </Pressable>
      ) : (
        <View
          testID="running-timer-start-editor"
          className="mb-5 py-3 px-5 rounded-full"
          style={{ backgroundColor: mutedBackgroundColor }}
          accessibilityLabel={label}
        >
          {content}
        </View>
      )}

      {showPicker && (
        <View className="absolute bottom-0 left-0 right-0 z-10 bg-surface dark:bg-surface-dark">
          <View className="flex-row justify-end px-4 py-2 border-t border-border dark:border-border-dark">
            <Pressable
              onPress={() => void handleDone()}
              className="py-2 px-4"
              accessibilityRole="button"
              accessibilityLabel={t("common.done")}
            >
              <Text className="font-semibold" style={{ color: accentColor }}>
                {t("common.done")}
              </Text>
            </Pressable>
          </View>
          {Platform.OS === "android" ? (
            <BoundedAndroidDateTimePicker
              value={draftStartedAt}
              bounds={pickerBounds}
              timeFormat={timeFormat}
              onChange={setDraftStartedAt}
            />
          ) : (
            <DateTimePicker
              value={draftStartedAt}
              mode="datetime"
              display="spinner"
              onChange={handleChange}
              minimumDate={pickerBounds.minimumDate}
              maximumDate={pickerBounds.maximumDate}
            />
          )}
        </View>
      )}
    </>
  );
}
