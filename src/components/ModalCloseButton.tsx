import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";
import { exitModal } from "@/navigation";

type ModalCloseButtonProps = {
  accessibilityLabel: string;
  testID?: string;
};

export function ModalCloseButton({ accessibilityLabel, testID }: ModalCloseButtonProps) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => exitModal(router)}
      className="w-touch h-touch items-center justify-center rounded-full active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Text className="text-xl text-content-secondary dark:text-content-dark-secondary">×</Text>
    </Pressable>
  );
}
