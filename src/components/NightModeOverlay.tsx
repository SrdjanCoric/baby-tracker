import { View } from "react-native";
import { useTheme } from "@/contexts/theme-context";

export function NightModeOverlay() {
  const { isNight } = useTheme();

  if (!isNight) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      className="absolute inset-0 bg-night-bg/40"
      accessibilityElementsHidden
    />
  );
}
