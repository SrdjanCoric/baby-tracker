import { Platform } from "react-native";
import { Stack } from "expo-router";
import { useTheme } from "@/contexts";
import { SURFACE } from "@/constants/colors";

export default function HealthLayout() {
  const { isDark } = useTheme();
  const bgColor = isDark ? SURFACE.dark.background : SURFACE.light.background;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: bgColor },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="manual"
        options={
          Platform.OS === "ios"
            ? { presentation: "modal", animation: "slide_from_bottom" }
            : { animation: "slide_from_right" }
        }
      />
    </Stack>
  );
}
