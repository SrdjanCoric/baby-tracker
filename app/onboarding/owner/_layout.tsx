import { Stack } from "expo-router";

export default function NewOwnerOnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="account" />
      <Stack.Screen name="join" />
      <Stack.Screen name="baby" />
      <Stack.Screen name="invitation" />
      <Stack.Screen name="activity" />
      <Stack.Screen name="saved" />
    </Stack>
  );
}
