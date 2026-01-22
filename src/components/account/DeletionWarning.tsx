import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import type { DeletionPreview } from "@/types/account-deletion";
import { calculateTotalRecords } from "@/utils/account-deletion";

interface DeletionWarningProps {
  preview: DeletionPreview;
}

function DeletionWarning({ preview }: DeletionWarningProps) {
  const { t } = useTranslation();
  const totalRecords = calculateTotalRecords(preview);

  return (
    <View className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 mb-6">
      <View className="flex-row items-center mb-3">
        <Text className="text-2xl mr-2">{"\u26A0\uFE0F"}</Text>
        <Text className="text-lg font-semibold text-red-600 dark:text-red-400">
          {t("accountDeletion.warningTitle")}
        </Text>
      </View>

      <Text className="text-sm text-red-700 dark:text-red-300 mb-4">
        {t("accountDeletion.warningDescription")}
      </Text>

      <View className="bg-white dark:bg-surface-dark-card rounded-lg p-3 mb-3">
        <Text className="text-sm font-medium text-content-primary dark:text-content-dark-primary mb-2">
          {t("accountDeletion.dataToDelete")}
        </Text>

        {preview.feedings > 0 && (
          <DataRow
            label={t("accountDeletion.feedings")}
            count={preview.feedings}
          />
        )}
        {preview.sleep > 0 && (
          <DataRow label={t("accountDeletion.sleep")} count={preview.sleep} />
        )}
        {preview.diapers > 0 && (
          <DataRow
            label={t("accountDeletion.diapers")}
            count={preview.diapers}
          />
        )}
        {preview.pumping > 0 && (
          <DataRow
            label={t("accountDeletion.pumping")}
            count={preview.pumping}
          />
        )}
        {preview.growth > 0 && (
          <DataRow label={t("accountDeletion.growth")} count={preview.growth} />
        )}
        {preview.tummyTime > 0 && (
          <DataRow
            label={t("accountDeletion.tummyTime")}
            count={preview.tummyTime}
          />
        )}

        {totalRecords === 0 && (
          <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary">
            {t("accountDeletion.noRecords")}
          </Text>
        )}

        {totalRecords > 0 && (
          <View className="mt-2 pt-2 border-t border-border-subtle dark:border-border-dark-subtle">
            <DataRow
              label={t("accountDeletion.totalRecords")}
              count={totalRecords}
              isBold
            />
          </View>
        )}
      </View>

      {preview.babies.length > 0 && (
        <View className="bg-white dark:bg-surface-dark-card rounded-lg p-3 mb-3">
          <Text className="text-sm font-medium text-content-primary dark:text-content-dark-primary mb-2">
            {t("accountDeletion.babiesToDelete", {
              count: preview.babies.length,
            })}
          </Text>
          {preview.babies.map((baby) => (
            <Text
              key={baby.id}
              className="text-sm text-content-secondary dark:text-content-dark-secondary"
            >
              {"\u2022"} {baby.name}
            </Text>
          ))}
        </View>
      )}

      {preview.householdWillBeDeleted && (
        <View className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
          <Text className="text-sm text-orange-700 dark:text-orange-300">
            {t("accountDeletion.householdWillBeDeleted")}
          </Text>
        </View>
      )}

      {preview.hasOtherCaregivers && !preview.householdWillBeDeleted && (
        <View className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
          <Text className="text-sm text-blue-700 dark:text-blue-300">
            {t("accountDeletion.otherCaregiversExist")}
          </Text>
        </View>
      )}
    </View>
  );
}

interface DataRowProps {
  label: string;
  count: number;
  isBold?: boolean;
}

function DataRow({ label, count, isBold = false }: DataRowProps) {
  const textStyle = isBold
    ? "text-sm font-semibold text-content-primary dark:text-content-dark-primary"
    : "text-sm text-content-secondary dark:text-content-dark-secondary";

  return (
    <View className="flex-row justify-between py-0.5">
      <Text className={textStyle}>{label}</Text>
      <Text className={textStyle}>{count}</Text>
    </View>
  );
}

export { DeletionWarning };
