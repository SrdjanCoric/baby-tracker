import { Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { SleepPatternColors } from "./useSleepPatternColors";

export function DateNavigator({
  label,
  onPrev,
  onNext,
  colors,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  colors: SleepPatternColors;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 8,
      }}
    >
      <Pressable onPress={onPrev} hitSlop={12}>
        <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
      </Pressable>
      <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textPrimary }}>
        {label}
      </Text>
      <Pressable onPress={onNext} hitSlop={12}>
        <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}
