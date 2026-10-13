import { useCallback, type RefObject } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { exitModal } from "@/navigation";
import { formatDuration } from "@/utils/time";

interface ConfirmDiscardTimerOptions {
  canDiscard: boolean;
  titleKey: `${"sleep" | "feeding" | "pumping" | "tummyTime"}.discardTimerTitle`;
  elapsedSeconds: number;
  discard: () => Promise<boolean>;
  beforeDiscard?: () => void;
  router: Parameters<typeof exitModal>[0];
  isStoppingRef: RefObject<boolean>;
  screenName: string;
}

export function useConfirmDiscardTimer({
  canDiscard,
  titleKey,
  elapsedSeconds,
  discard,
  beforeDiscard,
  router,
  isStoppingRef,
  screenName,
}: ConfirmDiscardTimerOptions) {
  const { t } = useTranslation();
  return useCallback(() => {
    if (!canDiscard) return;
    Alert.alert(
      t(titleKey),
      t("common.discardTimerBody", { elapsed: formatDuration(elapsedSeconds) }),
      [
        { text: t("common.keepTiming"), style: "cancel", isPreferred: true },
        {
          text: t("common.discard"),
          style: "destructive",
          onPress: async () => {
            if (isStoppingRef.current) return;
            isStoppingRef.current = true;
            try {
              beforeDiscard?.();
              if (await discard()) exitModal(router);
            } catch (error) {
              console.error(`[${screenName}] Failed to discard timer:`, error);
            } finally {
              isStoppingRef.current = false;
            }
          },
        },
      ]
    );
  }, [
    canDiscard,
    titleKey,
    elapsedSeconds,
    discard,
    beforeDiscard,
    router,
    isStoppingRef,
    screenName,
    t,
  ]);
}
