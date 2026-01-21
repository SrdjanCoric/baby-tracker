import { Stack } from "expo-router";

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="theme" />
      <Stack.Screen name="units" />
      <Stack.Screen name="about" />
    </Stack>
  );
}
