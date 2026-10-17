import { Text, View } from "react-native";
import { SEMANTIC } from "@/constants/colors";
import { CursorAtEndTextInput } from "./CursorAtEndTextInput";

type Side = "left" | "right";

interface BreastSideMinutesFieldsProps {
  label: string;
  leftLabel: string;
  rightLabel: string;
  unitLabel: string;
  left: string;
  right: string;
  onLeftChange(text: string): void;
  onRightChange(text: string): void;
  leftError?: string;
  rightError?: string;
  mutedBackgroundColor: string;
  textColor: string;
}

export function BreastSideMinutesFields({
  label,
  leftLabel,
  rightLabel,
  unitLabel,
  left,
  right,
  onLeftChange,
  onRightChange,
  leftError,
  rightError,
  mutedBackgroundColor,
  textColor,
}: BreastSideMinutesFieldsProps) {
  const fields: Record<Side, { label: string; value: string; onChange(text: string): void; error?: string }> = {
    left: { label: leftLabel, value: left, onChange: onLeftChange, error: leftError },
    right: { label: rightLabel, value: right, onChange: onRightChange, error: rightError },
  };

  return (
    <View className="mb-6">
      <Text className="text-base font-medium text-content-primary dark:text-content-dark-primary mb-3">
        {label}
      </Text>
      <View className="flex-row gap-3">
        {(["left", "right"] as const).map((side) => {
          const field = fields[side];
          return (
            <View
              key={side}
              testID={`side-minutes-${side}`}
              className="flex-1 flex-row items-center justify-between rounded-card-lg px-4 py-3"
              style={{
                backgroundColor: mutedBackgroundColor,
                borderWidth: 1.5,
                borderColor: field.error ? SEMANTIC.error.light : "transparent",
              }}
            >
              <Text className="text-base" style={{ color: textColor }}>
                {field.label}
              </Text>
              <CursorAtEndTextInput
                testID={`side-minutes-${side}-input`}
                value={field.value}
                onChangeText={(text) => field.onChange(text.replace(/\D/g, ""))}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="0"
                placeholderTextColor="#999"
                accessibilityLabel={field.label}
                className="flex-1 text-right font-semibold p-0"
                // A line height taller than the font sinks the digits on iOS, so set only the size.
                style={{ color: textColor, fontSize: 16 }}
              />
              <Text className="ml-1.5 text-sm text-content-secondary dark:text-content-dark-secondary">
                {unitLabel}
              </Text>
            </View>
          );
        })}
      </View>
      {[leftError, rightError].filter(Boolean).map((error) => (
        <Text key={error} className="text-red-500 text-sm mt-2">
          {error}
        </Text>
      ))}
    </View>
  );
}
