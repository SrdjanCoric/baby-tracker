import { Stack } from "expo-router";

export default function EditLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: "modal",
        animation: "slide_from_bottom",
        gestureEnabled: true,
        gestureDirection: "vertical",
      }}
    >
      <Stack.Screen name="feeding" />
      <Stack.Screen name="sleep" />
      <Stack.Screen name="diaper" />
      <Stack.Screen name="pumping" />
      <Stack.Screen name="growth" />
      <Stack.Screen name="tummyTime" />
    </Stack>
  );
}
