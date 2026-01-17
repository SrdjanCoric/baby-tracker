import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

type TabIconProps = {
  name: string;
  focused: boolean;
};

// Activity colors from design system
const ACTIVE_COLOR = "#2E7D32"; // Primary action green
const INACTIVE_COLOR = "#6B6B6B"; // Secondary text

function TabIcon({ name, focused }: TabIconProps) {
  const iconSymbols: Record<string, string> = {
    home: "🏠",
    timeline: "📋",
    statistics: "📊",
    profile: "👤",
  };

  return (
    <View className="items-center justify-center">
      <Text
        className={`text-2xl ${focused ? "opacity-100" : "opacity-60"}`}
        style={{ color: focused ? ACTIVE_COLOR : INACTIVE_COLOR }}
      >
        {iconSymbols[name] || "\u{2022}"}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E5E7EB",
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: 8,
          height: 70,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
        headerStyle: {
          backgroundColor: "#FAFAFA",
        },
        headerShadowVisible: false,
        headerTintColor: "#1A1A1A",
        headerTitleStyle: {
          fontWeight: "600",
          fontSize: 18,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("navigation.home"),
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          title: t("navigation.timeline"),
          tabBarIcon: ({ focused }) => (
            <TabIcon name="timeline" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: t("navigation.statistics"),
          tabBarIcon: ({ focused }) => (
            <TabIcon name="statistics" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("navigation.profile"),
          tabBarIcon: ({ focused }) => (
            <TabIcon name="profile" focused={focused} />
          ),
        }}
      />
      {/* Hide the old screens */}
      <Tabs.Screen
        name="log"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
