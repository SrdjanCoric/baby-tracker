import { View, Pressable, Text } from "react-native";
import { useColorScheme } from "nativewind";
import { SURFACE, TEXT } from "@/constants/colors";

interface SegmentedTabsProps {
  tabs: { key: string; label: string }[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  accentColor: string;
}

export function SegmentedTabs({ tabs, activeTab, onTabChange, accentColor }: SegmentedTabsProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const containerBg = isDark ? SURFACE.dark.secondary : SURFACE.light.secondary;
  const activeBg = isDark ? SURFACE.dark.card : SURFACE.light.card;
  const inactiveText = isDark ? TEXT.dark.secondary : TEXT.light.secondary;

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: containerBg,
        borderRadius: 10,
        padding: 3,
        marginHorizontal: 16,
        marginBottom: 10,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 8,
              alignItems: "center",
              backgroundColor: isActive ? activeBg : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: isActive ? "600" : "500",
                color: isActive ? accentColor : inactiveText,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
