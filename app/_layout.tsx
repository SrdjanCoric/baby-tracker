import "../global.css";
import "../src/i18n";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { BabyProvider, FeedingProvider, SleepProvider, DiaperProvider, PumpingProvider, GrowthProvider, TummyTimeProvider } from "@/contexts";

export default function RootLayout() {
  return (
    <BabyProvider>
      <FeedingProvider>
        <SleepProvider>
          <DiaperProvider>
            <PumpingProvider>
              <GrowthProvider>
                <TummyTimeProvider>
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
                    <Stack.Screen
                      name="pumping"
                      options={{
                        presentation: "modal",
                        animation: "slide_from_bottom",
                      }}
                    />
                    <Stack.Screen
                      name="growth"
                      options={{
                        presentation: "modal",
                        animation: "slide_from_bottom",
                      }}
                    />
                    <Stack.Screen
                      name="tummyTime"
                      options={{
                        presentation: "modal",
                        animation: "slide_from_bottom",
                      }}
                    />
                    <Stack.Screen
                      name="edit"
                      options={{
                        presentation: "modal",
                        animation: "slide_from_bottom",
                        gestureEnabled: true,
                        gestureDirection: "vertical",
                      }}
                    />
                  </Stack>
                  <StatusBar style="auto" />
                </TummyTimeProvider>
              </GrowthProvider>
            </PumpingProvider>
          </DiaperProvider>
        </SleepProvider>
      </FeedingProvider>
    </BabyProvider>
  );
}
