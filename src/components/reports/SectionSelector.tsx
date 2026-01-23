import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import type { ReportSection } from "@/types/report";
import { SECTION_LABELS, SECTION_ICONS, SECTION_DESCRIPTIONS } from "@/constants/report";

interface SectionSelectorProps {
  selectedSections: ReportSection[];
  onSelectionChange: (sections: ReportSection[]) => void;
}

interface SectionItemProps {
  section: ReportSection;
  label: string;
  icon: string;
  description: string;
  isSelected: boolean;
  onToggle: () => void;
}

function SectionItem({
  section,
  label,
  icon,
  description,
  isSelected,
  onToggle,
}: SectionItemProps) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={`${label}, ${description}`}
      className={`flex-row items-center py-3 px-4 rounded-xl mb-2 ${
        isSelected
          ? "bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-500"
          : "bg-surface-secondary dark:bg-surface-dark-secondary border-2 border-transparent"
      }`}
      testID={`section-${section}`}
    >
      <View
        className={`w-6 h-6 rounded-md mr-3 items-center justify-center ${
          isSelected ? "bg-primary-500" : "bg-gray-200 dark:bg-gray-700"
        }`}
      >
        {isSelected && (
          <Text className="text-white text-sm font-bold">✓</Text>
        )}
      </View>

      <Text className="text-xl mr-3">{icon}</Text>

      <View className="flex-1">
        <Text
          className="text-base font-medium text-content-primary dark:text-content-dark-primary"
        >
          {label}
        </Text>
        <Text
          className="text-xs text-content-tertiary dark:text-content-dark-tertiary mt-0.5"
        >
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

export function SectionSelector({
  selectedSections,
  onSelectionChange,
}: SectionSelectorProps) {
  const { t } = useTranslation();

  const sections: ReportSection[] = [
    "summary",
    "feeding",
    "sleep",
    "diapers",
    "pumping",
    "growth",
    "tummyTime",
  ];

  const handleToggle = (section: ReportSection) => {
    if (selectedSections.includes(section)) {
      onSelectionChange(selectedSections.filter((s) => s !== section));
    } else {
      onSelectionChange([...selectedSections, section]);
    }
  };

  const handleSelectAll = () => {
    onSelectionChange(sections);
  };

  const handleDeselectAll = () => {
    onSelectionChange([]);
  };

  const allSelected = sections.every((section) =>
    selectedSections.includes(section)
  );

  return (
    <View>
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-sm font-medium text-content-secondary dark:text-content-dark-secondary">
          {t("reports.sections")}
        </Text>
        <Pressable
          onPress={allSelected ? handleDeselectAll : handleSelectAll}
          accessibilityRole="button"
          accessibilityLabel={allSelected ? t("export.deselectAll") : t("export.selectAll")}
          testID="select-all-sections-button"
        >
          <Text className="text-sm text-primary-500 dark:text-primary-400 font-medium">
            {allSelected ? t("export.deselectAll") : t("export.selectAll")}
          </Text>
        </Pressable>
      </View>

      {sections.map((section) => (
        <SectionItem
          key={section}
          section={section}
          label={SECTION_LABELS[section]}
          icon={SECTION_ICONS[section]}
          description={SECTION_DESCRIPTIONS[section]}
          isSelected={selectedSections.includes(section)}
          onToggle={() => handleToggle(section)}
        />
      ))}
    </View>
  );
}
