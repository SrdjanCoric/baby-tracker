import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View, useColorScheme } from "react-native";

type TabIconProps = {
  name: string;
  focused: boolean;
  isDark: boolean;
};

// Activity colors from design system
const COLORS = {
  light: {
    active: "#2E7D32",
    inactive: "#6B6B6B",
    background: "#FFFFFF",
    border: "#E5E7EB",
    headerBg: "#FAFAFA",
    headerText: "#1A1A1A",
  },
  dark: {
    active: "#4CAF50",
    inactive: "#9CA3AF",
    background: "#1A1A1A",
    border: "#2D2D2D",
    headerBg: "#1A1A1A",
    headerText: "#FFFFFF",
  },
};

function TabIcon({ name, focused, isDark }: TabIconProps) {
  const iconSymbols: Record<string, string> = {
    home: "🏠",
    timeline: "📋",
    statistics: "📊",
  };

  const colors = isDark ? COLORS.dark : COLORS.light;

  return (
    <View className="items-center justify-center">
      <Text
        className={`text-2xl ${focused ? "opacity-100" : "opacity-60"}`}
        style={{ color: focused ? colors.active : colors.inactive }}
      >
        {iconSymbols[name] || "\u{2022}"}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // Get colors based on current color scheme
  const activeColor = isDark ? COLORS.dark.active : COLORS.light.active;
  const inactiveColor = isDark ? COLORS.dark.inactive : COLORS.light.inactive;
  const backgroundColor = isDark ? COLORS.dark.background : COLORS.light.background;
  const borderColor = isDark ? COLORS.dark.border : COLORS.light.border;
  const headerBgColor = isDark ? COLORS.dark.headerBg : COLORS.light.headerBg;
  const headerTextColor = isDark ? COLORS.dark.headerText : COLORS.light.headerText;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          backgroundColor: backgroundColor,
          borderTopColor: borderColor,
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
          backgroundColor: headerBgColor,
        },
        headerShadowVisible: false,
        headerTintColor: headerTextColor,
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
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} isDark={isDark} />,
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          title: t("navigation.timeline"),
          tabBarIcon: ({ focused }) => (
            <TabIcon name="timeline" focused={focused} isDark={isDark} />
          ),
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: t("navigation.statistics"),
          tabBarIcon: ({ focused }) => (
            <TabIcon name="statistics" focused={focused} isDark={isDark} />
          ),
        }}
      />
      {/* Hide unused screens */}
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
