import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View, useColorScheme } from "react-native";

type TabIconProps = {
  name: string;
  focused: boolean;
  isDark: boolean;
};

// Design tokens - warm color palette
const COLORS = {
  light: {
    active: "#6B9E6E",
    inactive: "#6B665E",
    background: "#FFFFFF",
    border: "#E8E5E0",
    headerBg: "#FAFAF8",
    headerText: "#2D2A26",
  },
  dark: {
    active: "#8FC091",
    inactive: "#B5B0A8",
    background: "#1A1918",
    border: "#3D3935",
    headerBg: "#1A1918",
    headerText: "#FAF9F7",
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
