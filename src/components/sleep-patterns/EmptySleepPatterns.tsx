import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/EmptyState";

export function EmptySleepPatterns() {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon="🌙"
      title={t("sleepPatterns.noData")}
      description={t("sleepPatterns.noDataDescription")}
      testID="empty-sleep-patterns"
    />
  );
}
