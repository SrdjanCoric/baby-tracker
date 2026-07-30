import React from "react";
import { View, Text } from "react-native";
import { useColorScheme } from "nativewind";
import { ACTION, SURFACE } from "@/constants/colors";

export type IllustrationType = "baby-welcome" | "activity-icons" | "phones-sync" | "baby-profile";

interface OnboardingIllustrationProps {
  type: IllustrationType;
}

interface IllustrationColors {
  primary: string;
  muted: string;
}

export function OnboardingIllustration({ type }: OnboardingIllustrationProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = {
    primary: isDark ? ACTION.dark.primary : ACTION.light.primary,
    muted: isDark ? SURFACE.dark.card : SURFACE.light.muted,
  };

  switch (type) {
    case "baby-welcome":
      return <WelcomeIllustration colors={colors} />;
    case "activity-icons":
      return <ActivityIconsIllustration colors={colors} />;
    case "phones-sync":
      return <SyncIllustration colors={colors} />;
    case "baby-profile":
      return <BabyProfileIllustration colors={colors} />;
  }
}

function WelcomeIllustration({ colors }: { colors: IllustrationColors }) {
  return (
    <View
      className="w-40 h-40 rounded-full items-center justify-center"
      style={{ backgroundColor: colors.muted }}
    >
      <Text className="text-7xl">👶</Text>
    </View>
  );
}

function ActivityIconsIllustration({ colors }: { colors: IllustrationColors }) {
  const icons = ["🍼", "😴", "🚼", "📏"];

  return (
    <View className="flex-row flex-wrap justify-center" style={{ width: 160 }}>
      {icons.map(icon => (
        <View
          key={icon}
          className="w-16 h-16 m-1 rounded-xl items-center justify-center"
          style={{ backgroundColor: colors.muted }}
        >
          <Text className="text-3xl">{icon}</Text>
        </View>
      ))}
    </View>
  );
}

function SyncIllustration({ colors }: { colors: IllustrationColors }) {
  return (
    <View className="flex-row items-center">
      <View
        className="w-20 h-32 rounded-xl items-center justify-center"
        style={{ backgroundColor: colors.muted }}
      >
        <Text className="text-4xl">📱</Text>
      </View>
      <View className="mx-4">
        <Text className="text-3xl" style={{ color: colors.primary }}>⇄</Text>
      </View>
      <View
        className="w-20 h-32 rounded-xl items-center justify-center"
        style={{ backgroundColor: colors.muted }}
      >
        <Text className="text-4xl">📱</Text>
      </View>
    </View>
  );
}

function BabyProfileIllustration({ colors }: { colors: IllustrationColors }) {
  return (
    <View
      className="w-32 h-32 rounded-full items-center justify-center"
      style={{ backgroundColor: colors.muted }}
    >
      <Text className="text-5xl">👼</Text>
      <View
        className="absolute bottom-0 right-0 w-10 h-10 rounded-full items-center justify-center"
        style={{ backgroundColor: colors.primary }}
      >
        <Text className="text-xl text-white">+</Text>
      </View>
    </View>
  );
}
