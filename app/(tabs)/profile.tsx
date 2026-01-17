import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

interface SettingsRowProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  danger?: boolean;
}

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  showChevron = true,
  danger = false,
}: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center py-4 px-4 active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
      accessibilityRole="button"
    >
      <Text className="text-xl mr-3">{icon}</Text>
      <Text
        className={`flex-1 text-base ${
          danger
            ? "text-red-500"
            : "text-content-primary dark:text-content-dark-primary"
        }`}
      >
        {label}
      </Text>
      {value && (
        <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mr-2">
          {value}
        </Text>
      )}
      {showChevron && (
        <Text className="text-content-tertiary dark:text-content-dark-tertiary">
          ›
        </Text>
      )}
    </Pressable>
  );
}

function SettingsDivider() {
  return <View className="h-px bg-gray-200 dark:bg-gray-700 ml-14" />;
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider px-4 mb-2">
        {title}
      </Text>
      <View className="bg-surface-card dark:bg-surface-dark-card rounded-card overflow-hidden">
        {children}
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["bottom"]}>
      <ScrollView className="flex-1 px-4 pt-4">
        {/* Baby Management */}
        <SettingsSection title={t("baby.title")}>
          <SettingsRow
            icon="👶"
            label={t("baby.addBaby")}
            onPress={() => router.push("/baby/add")}
          />
        </SettingsSection>

        {/* Preferences */}
        <SettingsSection title="Preferences">
          <SettingsRow
            icon="📏"
            label={t("settings.units")}
            value={t("settings.metric")}
            onPress={() => {}}
          />
          <SettingsDivider />
          <SettingsRow
            icon="🎨"
            label={t("settings.theme")}
            value={t("settings.systemDefault")}
            onPress={() => {}}
          />
          <SettingsDivider />
          <SettingsRow
            icon="🔔"
            label={t("settings.notifications")}
            onPress={() => {}}
          />
        </SettingsSection>

        {/* Data */}
        <SettingsSection title="Data">
          <SettingsRow
            icon="📤"
            label={t("settings.export")}
            onPress={() => {}}
          />
        </SettingsSection>

        {/* Household */}
        <SettingsSection title={t("household.title")}>
          <SettingsRow
            icon="👨‍👩‍👧"
            label={t("household.caregivers")}
            onPress={() => {}}
          />
          <SettingsDivider />
          <SettingsRow
            icon="🔗"
            label={t("household.inviteCode")}
            onPress={() => {}}
          />
        </SettingsSection>

        {/* About */}
        <SettingsSection title={t("settings.about")}>
          <SettingsRow
            icon="ℹ️"
            label={t("settings.version")}
            value="1.0.0"
            showChevron={false}
          />
          <SettingsDivider />
          <SettingsRow
            icon="🔒"
            label={t("settings.privacyPolicy")}
            onPress={() => {}}
          />
        </SettingsSection>

        {/* Account */}
        <SettingsSection title={t("settings.account")}>
          <SettingsRow
            icon="🚪"
            label={t("settings.signOut")}
            onPress={() => {}}
            showChevron={false}
          />
          <SettingsDivider />
          <SettingsRow
            icon="🗑️"
            label={t("settings.deleteAccount")}
            onPress={() => {}}
            showChevron={false}
            danger
          />
        </SettingsSection>

        {/* Bottom spacing */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
