import "../global.css";
import "../src/i18n";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { BabyProvider, FeedingProvider, SleepProvider } from "@/contexts";

export default function RootLayout() {
  return (
    <BabyProvider>
      <FeedingProvider>
        <SleepProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="baby"
              options={{
                presentation: "modal",
                animation: "slide_from_bottom",
              }}
            />
            <Stack.Screen
              name="feeding"
              options={{
                presentation: "modal",
                animation: "slide_from_bottom",
              }}
            />
            <Stack.Screen
              name="sleep"
              options={{
                presentation: "modal",
                animation: "slide_from_bottom",
              }}
            />
          </Stack>
          <StatusBar style="auto" />
        </SleepProvider>
      </FeedingProvider>
    </BabyProvider>
  );
}
