import { useColorScheme } from "nativewind";
import { SURFACE, TEXT, BORDER, ACTION, ACTIVITY } from "@/constants/colors";

export interface SleepPatternColors {
  bgColor: string;
  cardBg: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  borderSubtle: string;
  gridLine: string;
  accentColor: string;
  nightColor: string;
  napColor: string;
  isDark: boolean;
}

export function useSleepPatternColors(): SleepPatternColors {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return {
    bgColor: isDark ? SURFACE.dark.background : SURFACE.light.background,
    cardBg: isDark ? SURFACE.dark.card : SURFACE.light.card,
    textPrimary: isDark ? TEXT.dark.primary : TEXT.light.primary,
    textSecondary: isDark ? TEXT.dark.secondary : TEXT.light.secondary,
    textTertiary: isDark ? TEXT.dark.tertiary : TEXT.light.tertiary,
    borderSubtle: isDark ? BORDER.dark.subtle : BORDER.light.subtle,
    gridLine: isDark ? "#4A464F" : "#D5D1CC",
    accentColor: isDark ? ACTION.dark.primary : ACTION.light.primary,
    nightColor: isDark ? ACTIVITY.sleep.buttonDark : ACTIVITY.sleep.button,
    napColor: isDark ? ACTIVITY.sleep.accentDark : ACTIVITY.sleep.accent,
    isDark,
  };
}
