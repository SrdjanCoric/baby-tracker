import { Stack } from "expo-router";

export default function FeedingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: "modal",
        animation: "slide_from_bottom",
      }}
    >
      <Stack.Screen name="breastfeed" />
      <Stack.Screen name="bottle" />
    </Stack>
  );
}
