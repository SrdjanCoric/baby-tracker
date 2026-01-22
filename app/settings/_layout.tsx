import { Stack } from "expo-router";

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="theme" />
      <Stack.Screen name="units" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="export" />
      <Stack.Screen name="about" />
      <Stack.Screen name="household" />
      <Stack.Screen name="caregivers" />
      <Stack.Screen name="join-household" />
      <Stack.Screen name="delete-account" />
    </Stack>
  );
}
