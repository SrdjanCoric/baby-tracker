/**
 * OnboardingIllustration - Visual illustrations for onboarding screens
 * Uses emoji-based illustrations that work in both light and dark mode
 */

import React from "react";
import { View, Text } from "react-native";

export type IllustrationType = "baby-welcome" | "activity-icons" | "phones-sync" | "baby-profile";

const PRIMARY_COLOR = "#6B9E6E";
const PRIMARY_COLOR_MUTED = "#E8F5E9";

interface OnboardingIllustrationProps {
  type: IllustrationType;
}

export function OnboardingIllustration({ type }: OnboardingIllustrationProps) {
  switch (type) {
    case "baby-welcome":
      return <WelcomeIllustration />;
    case "activity-icons":
      return <ActivityIconsIllustration />;
    case "phones-sync":
      return <SyncIllustration />;
    case "baby-profile":
      return <BabyProfileIllustration />;
    default:
      return <WelcomeIllustration />;
  }
}

function WelcomeIllustration() {
  return (
    <View
      className="w-40 h-40 rounded-full items-center justify-center"
      style={{ backgroundColor: PRIMARY_COLOR_MUTED }}
    >
      <Text className="text-7xl">👶</Text>
    </View>
  );
}

function ActivityIconsIllustration() {
  const icons = ["🍼", "😴", "🚼", "📏"];

  return (
    <View className="flex-row flex-wrap justify-center" style={{ width: 160 }}>
      {icons.map((icon, index) => (
        <View
          key={index}
          className="w-16 h-16 m-1 rounded-xl items-center justify-center"
          style={{ backgroundColor: PRIMARY_COLOR_MUTED }}
        >
          <Text className="text-3xl">{icon}</Text>
        </View>
      ))}
    </View>
  );
}

function SyncIllustration() {
  return (
    <View className="flex-row items-center">
      <View
        className="w-20 h-32 rounded-xl items-center justify-center"
        style={{ backgroundColor: PRIMARY_COLOR_MUTED }}
      >
        <Text className="text-4xl">📱</Text>
      </View>
      <View className="mx-4">
        <Text className="text-3xl" style={{ color: PRIMARY_COLOR }}>⇄</Text>
      </View>
      <View
        className="w-20 h-32 rounded-xl items-center justify-center"
        style={{ backgroundColor: PRIMARY_COLOR_MUTED }}
      >
        <Text className="text-4xl">📱</Text>
      </View>
    </View>
  );
}

function BabyProfileIllustration() {
  return (
    <View
      className="w-32 h-32 rounded-full items-center justify-center"
      style={{ backgroundColor: PRIMARY_COLOR_MUTED }}
    >
      <Text className="text-5xl">👼</Text>
      <View
        className="absolute bottom-0 right-0 w-10 h-10 rounded-full items-center justify-center"
        style={{ backgroundColor: PRIMARY_COLOR }}
      >
        <Text className="text-xl text-white">+</Text>
      </View>
    </View>
  );
}
