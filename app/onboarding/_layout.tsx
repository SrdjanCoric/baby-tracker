import { Stack } from "expo-router";
import { OnboardingProvider } from "@/contexts";

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="features" />
        <Stack.Screen name="sync" />
        <Stack.Screen name="baby" />
        <Stack.Screen name="owner" />
      </Stack>
    </OnboardingProvider>
  );
}
