import { Stack } from "expo-router";

export default function SleepLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: "modal",
        animation: "slide_from_bottom",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="manual" />
    </Stack>
  );
}
