import { ScrollView, Pressable, Text, View } from "react-native";
import { useColorScheme } from "nativewind";
import { SURFACE, TEXT, ACTION } from "@/constants/colors";

export type StatsCategory = "sleep" | "feeding" | "diapers" | "growth" | "pumping" | "tummyTime";

const CATEGORY_ICONS: Record<StatsCategory, string> = {
  sleep: "\uD83C\uDF19",
  feeding: "\uD83C\uDF7C",
  diapers: "\uD83D\uDCA7",
  growth: "\uD83D\uDCC8",
  pumping: "\uD83E\uDD31",
  tummyTime: "\uD83D\uDCAA",
};

interface CategoryTabsProps {
  categories: { key: StatsCategory; label: string }[];
  activeCategory: StatsCategory;
  onCategoryChange: (category: StatsCategory) => void;
}

export function CategoryTabs({ categories, activeCategory, onCategoryChange }: CategoryTabsProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const activeBg = isDark ? ACTION.dark.primary : ACTION.light.primary;
  const inactiveBg = isDark ? SURFACE.dark.secondary : SURFACE.light.secondary;
  const inactiveText = isDark ? TEXT.dark.secondary : TEXT.light.secondary;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
      style={{ flexGrow: 0 }}
    >
      {categories.map((cat) => {
        const isActive = cat.key === activeCategory;
        return (
          <Pressable
            key={cat.key}
            onPress={() => onCategoryChange(cat.key)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 20,
              backgroundColor: isActive ? activeBg : inactiveBg,
            }}
          >
            <Text style={{ fontSize: 13, marginRight: 5 }}>
              {CATEGORY_ICONS[cat.key]}
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: isActive ? "600" : "500",
                color: isActive ? "#FFFFFF" : inactiveText,
              }}
            >
              {cat.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
