import { useTranslation } from "react-i18next";
import { Text, View, Pressable } from "react-native";
import { SURFACE } from "@/constants/colors";
import type { SleepPatternColors } from "./useSleepPatternColors";

export type TabView = "day" | "week" | "summary";

export function PillTabs({
  activeTab,
  onTabChange,
  colors,
}: {
  activeTab: TabView;
  onTabChange: (tab: TabView) => void;
  colors: SleepPatternColors;
}) {
  const { t } = useTranslation();
  const tabs: { key: TabView; label: string }[] = [
    { key: "day", label: t("sleepPatterns.day") },
    { key: "week", label: t("sleepPatterns.week") },
    { key: "summary", label: t("sleepPatterns.summary") },
  ];

  const pillBg = colors.isDark ? SURFACE.dark.secondary : SURFACE.light.secondary;

  return (
    <View
      style={{
        flexDirection: "row",
        marginHorizontal: 16,
        marginBottom: 12,
        backgroundColor: pillBg,
        borderRadius: 10,
        padding: 3,
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: isActive ? colors.cardBg : "transparent",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: isActive ? "600" : "500",
                color: isActive ? colors.accentColor : colors.textPrimary,
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
