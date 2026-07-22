import { Alert } from "react-native";
import i18n from "@/i18n";

export function showTimerConflictNotice(lockHolderName?: string): void {
  Alert.alert(
    i18n.t("timerConflict.title"),
    i18n.t("timerConflict.body", {
      name: lockHolderName || i18n.t("common.someone"),
    })
  );
}
