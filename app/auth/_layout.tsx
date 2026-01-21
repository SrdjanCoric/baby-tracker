import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        gestureEnabled: true,
      }}
    >
      <Stack.Screen
        name="sign-in"
        options={{
          gestureEnabled: true,
          gestureDirection: "vertical",
        }}
      />
      <Stack.Screen
        name="sign-up"
        options={{
          gestureEnabled: true,
        }}
      />
    </Stack>
  );
}
