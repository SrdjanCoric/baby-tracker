import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import type { ExportDataType, ExportRecordCounts } from "@/types/export";
import { getDataTypeLabels, DATA_TYPE_ICONS } from "@/constants/export";

interface DataTypeSelectorProps {
  selectedTypes: ExportDataType[];
  recordCounts: ExportRecordCounts;
  onSelectionChange: (types: ExportDataType[]) => void;
}

interface DataTypeItemProps {
  type: ExportDataType;
  label: string;
  icon: string;
  count: number;
  isSelected: boolean;
  onToggle: () => void;
}

function DataTypeItem({
  type,
  label,
  icon,
  count,
  isSelected,
  onToggle,
}: DataTypeItemProps) {
  const { t } = useTranslation();
  const isDisabled = count === 0;

  return (
    <Pressable
      onPress={onToggle}
      disabled={isDisabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected, disabled: isDisabled }}
      accessibilityLabel={`${label}, ${count} records`}
      className={`flex-row items-center py-3 px-4 rounded-xl mb-2 ${
        isDisabled
          ? "bg-gray-100 dark:bg-gray-800 opacity-50"
          : isSelected
          ? "bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-500"
          : "bg-surface-secondary dark:bg-surface-dark-secondary border-2 border-transparent"
      }`}
      testID={`data-type-${type}`}
    >
      <View
        className={`w-6 h-6 rounded-md mr-3 items-center justify-center ${
          isSelected
            ? "bg-primary-500"
            : "bg-gray-200 dark:bg-gray-700"
        }`}
      >
        {isSelected && (
          <Text className="text-white text-sm font-bold">✓</Text>
        )}
      </View>

      <Text className="text-xl mr-3">{icon}</Text>

      <View className="flex-1">
        <Text
          className={`text-base font-medium ${
            isDisabled
              ? "text-gray-400"
              : "text-content-primary dark:text-content-dark-primary"
          }`}
        >
          {label}
        </Text>
      </View>

      <Text
        className={`text-sm ${
          isDisabled
            ? "text-gray-400"
            : "text-content-secondary dark:text-content-dark-secondary"
        }`}
      >
        {t(count === 1 ? "export.record_one" : "export.record_other", { count })}
      </Text>
    </Pressable>
  );
}

export function DataTypeSelector({
  selectedTypes,
  recordCounts,
  onSelectionChange,
}: DataTypeSelectorProps) {
  const { t } = useTranslation();
  const dataTypeLabels = getDataTypeLabels(t);

  const dataTypes: ExportDataType[] = [
    "feedings",
    "sleep",
    "diapers",
    "pumping",
    "growth",
    "tummyTime",
  ];

  const handleToggle = (type: ExportDataType) => {
    if (selectedTypes.includes(type)) {
      onSelectionChange(selectedTypes.filter((t) => t !== type));
    } else {
      onSelectionChange([...selectedTypes, type]);
    }
  };

  const handleSelectAll = () => {
    const typesWithData = dataTypes.filter(
      (type) => recordCounts[type] > 0
    );
    onSelectionChange(typesWithData);
  };

  const handleDeselectAll = () => {
    onSelectionChange([]);
  };

  const typesWithData = dataTypes.filter(
    (type) => recordCounts[type] > 0
  );
  const allSelected =
    typesWithData.length > 0 &&
    typesWithData.every((type) => selectedTypes.includes(type));

  return (
    <View>
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary">
          {t("export.dataTypes")}
        </Text>
        <Pressable
          onPress={allSelected ? handleDeselectAll : handleSelectAll}
          accessibilityRole="button"
          accessibilityLabel={allSelected ? t("export.deselectAll") : t("export.selectAll")}
          testID="select-all-button"
        >
          <Text className="text-sm text-primary-500 dark:text-primary-400 font-medium">
            {allSelected ? t("export.deselectAll") : t("export.selectAll")}
          </Text>
        </Pressable>
      </View>

      {dataTypes.map((type) => (
        <DataTypeItem
          key={type}
          type={type}
          label={dataTypeLabels[type]}
          icon={DATA_TYPE_ICONS[type]}
          count={recordCounts[type]}
          isSelected={selectedTypes.includes(type)}
          onToggle={() => handleToggle(type)}
        />
      ))}
    </View>
  );
}
