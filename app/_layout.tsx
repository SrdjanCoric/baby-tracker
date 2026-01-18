import "../global.css";
import "../src/i18n";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { BabyProvider, FeedingProvider, SleepProvider, DiaperProvider } from "@/contexts";

export default function RootLayout() {
  return (
    <BabyProvider>
      <FeedingProvider>
        <SleepProvider>
          <DiaperProvider>
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
              <Stack.Screen
                name="diaper"
                options={{
                  presentation: "modal",
                  animation: "slide_from_bottom",
                }}
              />
            </Stack>
            <StatusBar style="auto" />
          </DiaperProvider>
        </SleepProvider>
      </FeedingProvider>
    </BabyProvider>
  );
}
