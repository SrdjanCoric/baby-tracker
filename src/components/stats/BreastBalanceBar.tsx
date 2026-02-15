import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";

interface BreastBalanceBarProps {
  leftPercent: number;
  rightPercent: number;
}

const LEFT_COLOR_LIGHT = "#8CB369";
const LEFT_COLOR_DARK = "#A5C88A";
const RIGHT_COLOR_LIGHT = "#D4A574";
const RIGHT_COLOR_DARK = "#E0B990";

export function BreastBalanceBar({ leftPercent, rightPercent }: BreastBalanceBarProps) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const leftColor = isDark ? LEFT_COLOR_DARK : LEFT_COLOR_LIGHT;
  const rightColor = isDark ? RIGHT_COLOR_DARK : RIGHT_COLOR_LIGHT;

  return (
    <View>
      <View className="flex-row h-2 rounded-full overflow-hidden">
        <View
          style={{
            width: `${leftPercent}%`,
            backgroundColor: leftColor,
          }}
        />
        <View
          style={{
            width: `${rightPercent}%`,
            backgroundColor: rightColor,
          }}
        />
      </View>
      <View className="flex-row justify-between mt-1">
        <Text className="text-xs text-content-secondary dark:text-content-dark-secondary">
          {t("statistics.leftSide" as never)} {leftPercent}%
        </Text>
        <Text className="text-xs text-content-secondary dark:text-content-dark-secondary">
          {t("statistics.rightSide" as never)} {rightPercent}%
        </Text>
      </View>
    </View>
  );
}
