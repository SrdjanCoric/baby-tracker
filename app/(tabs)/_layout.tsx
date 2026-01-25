import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View, useColorScheme, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SURFACE, TEXT, ACTION, BORDER } from "@/constants/colors";

type TabIconProps = {
  name: string;
  focused: boolean;
  isDark: boolean;
};

function TabIcon({ name, focused, isDark }: TabIconProps) {
  const iconSymbols: Record<string, string> = {
    home: "🏠",
    timeline: "📋",
    statistics: "📊",
  };

  const activeColor = isDark ? ACTION.dark.primary : ACTION.light.primary;
  const inactiveColor = isDark ? TEXT.dark.secondary : TEXT.light.secondary;

  return (
    <View className="items-center justify-center">
      <Text
        className={`text-2xl ${focused ? "opacity-100" : "opacity-60"}`}
        style={{ color: focused ? activeColor : inactiveColor }}
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
  const insets = useSafeAreaInsets();

  const activeColor = isDark ? ACTION.dark.primary : ACTION.light.primary;
  const inactiveColor = isDark ? TEXT.dark.secondary : TEXT.light.secondary;
  const backgroundColor = isDark ? SURFACE.dark.background : SURFACE.light.card;
  const borderColor = isDark ? BORDER.dark.default : BORDER.light.default;
  const headerBgColor = isDark ? SURFACE.dark.background : SURFACE.light.background;
  const headerTextColor = isDark ? TEXT.dark.primary : TEXT.light.primary;

  // On Android in Expo Go, we need to account for the navigation bar
  const bottomPadding = Platform.OS === "android" ? Math.max(8, insets.bottom) : 14;
  const tabBarHeight = 54 + bottomPadding;

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
          paddingBottom: bottomPadding,
          height: tabBarHeight,
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
