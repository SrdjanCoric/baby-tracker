import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View, useColorScheme, Platform, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SURFACE, TEXT, ACTION, BORDER } from "@/constants/colors";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";

type TabIconProps = {
  name: string;
  focused: boolean;
  isDark: boolean;
};

function TabButton({ testID, onPress, onLongPress, style, children }: BottomTabBarButtonProps & { testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={style}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

function TabIcon({ name, focused, isDark }: TabIconProps) {
  const iconSymbols: Record<string, string> = {
    home: "🏠",
    timeline: "📋",
    statistics: "📊",
    "sleep-patterns": "🌙",
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

  // Calculate bottom padding based on safe area insets
  const bottomPadding = Platform.OS === "android" ? insets.bottom : 14;
  const tabBarHeight = 54 + bottomPadding;
  // On Android, add margin to lift the tab bar above the gesture indicator area
  const androidBottomMargin = Platform.OS === "android" ? 6 : 0;

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
          marginBottom: androidBottomMargin,
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
          tabBarButton: (props) => <TabButton {...props} testID="home-tab" />,
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          title: t("navigation.timeline"),
          tabBarIcon: ({ focused }) => (
            <TabIcon name="timeline" focused={focused} isDark={isDark} />
          ),
          tabBarButton: (props) => <TabButton {...props} testID="timeline-tab" />,
        }}
      />
      <Tabs.Screen
        name="sleep-patterns"
        options={{
          title: t("navigation.sleepPatterns"),
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon name="sleep-patterns" focused={focused} isDark={isDark} />
          ),
          tabBarButton: (props) => <TabButton {...props} testID="sleep-tab" />,
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: t("navigation.statistics"),
          tabBarIcon: ({ focused }) => (
            <TabIcon name="statistics" focused={focused} isDark={isDark} />
          ),
          tabBarButton: (props) => <TabButton {...props} testID="stats-tab" />,
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
