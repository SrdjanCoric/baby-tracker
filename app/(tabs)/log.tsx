import { useTranslation } from "react-i18next";
import { Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type QuickActionProps = {
  icon: string;
  label: string;
  color: string;
  onPress?: () => void;
};

function QuickAction({ icon, label, color, onPress }: QuickActionProps) {
  return (
    <Pressable
      onPress={onPress}
      className="items-center justify-center w-[30%] aspect-square rounded-2xl mb-4"
      style={{ backgroundColor: color }}
    >
      <Text className="text-3xl mb-1">{icon}</Text>
      <Text className="text-white text-xs font-medium text-center px-1">
        {label}
      </Text>
    </Pressable>
  );
}

export default function LogScreen() {
  const { t } = useTranslation();

  const actions = [
    {
      icon: "\u{1F931}",
      label: t("feeding.breast"),
      color: "#f472b6",
    },
    {
      icon: "\u{1F37C}",
      label: t("feeding.bottle"),
      color: "#60a5fa",
    },
    {
      icon: "\u{1F34E}",
      label: t("feeding.solid"),
      color: "#4ade80",
    },
    {
      icon: "\u{1F634}",
      label: t("sleep.title"),
      color: "#a78bfa",
    },
    {
      icon: "\u{1F6BC}",
      label: t("diaper.title"),
      color: "#fbbf24",
    },
    {
      icon: "\u{1FAD9}",
      label: t("pumping.title"),
      color: "#fb7185",
    },
    {
      icon: "\u{1F4CF}",
      label: t("growth.title"),
      color: "#34d399",
    },
    {
      icon: "\u{1F41B}",
      label: t("tummyTime.title"),
      color: "#f97316",
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
      <View className="flex-1 px-4 pt-4">
        <View className="flex-row flex-wrap justify-between">
          {actions.map((action, index) => (
            <QuickAction
              key={index}
              icon={action.icon}
              label={action.label}
              color={action.color}
            />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
