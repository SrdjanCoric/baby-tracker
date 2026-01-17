import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

type TabIconProps = {
  name: string;
  focused: boolean;
};

function TabIcon({ name, focused }: TabIconProps) {
  const iconMap: Record<string, string> = {
    timeline: "clock",
    log: "plus",
    statistics: "bar-chart",
    settings: "settings",
  };

  const iconSymbols: Record<string, string> = {
    clock: "\u{23F1}",
    plus: "\u{2795}",
    "bar-chart": "\u{1F4CA}",
    settings: "\u{2699}",
  };

  return (
    <View className="items-center justify-center">
      <Text
        className={`text-2xl ${focused ? "opacity-100" : "opacity-60"}`}
        style={{ color: focused ? "#0d9488" : "#6b7280" }}
      >
        {iconSymbols[iconMap[name]] || "\u{2022}"}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#0d9488",
        tabBarInactiveTintColor: "#6b7280",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e5e7eb",
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: 8,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
        headerStyle: {
          backgroundColor: "#ffffff",
        },
        headerTintColor: "#0f172a",
        headerTitleStyle: {
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("navigation.timeline"),
          tabBarIcon: ({ focused }) => (
            <TabIcon name="timeline" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: t("navigation.log"),
          tabBarIcon: ({ focused }) => <TabIcon name="log" focused={focused} />,
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
        name="settings"
        options={{
          title: t("navigation.settings"),
          tabBarIcon: ({ focused }) => (
            <TabIcon name="settings" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
