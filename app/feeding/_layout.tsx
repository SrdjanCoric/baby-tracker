import { Stack } from "expo-router";
import { useTheme } from "@/contexts";
import { SURFACE } from "@/constants/colors";

export default function FeedingLayout() {
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
      <Stack.Screen name="bottle" />
      <Stack.Screen name="solids" />
      <Stack.Screen name="manual" />
    </Stack>
  );
}
