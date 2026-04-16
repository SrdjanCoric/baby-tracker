import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View, Alert, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { useTheme, useUnits, useTimeFormat, useAuth, useLanguage } from "@/contexts";
import { getTipsEnabled, setTipsEnabled } from "@/services/tip-storage";

interface SettingsRowProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  danger?: boolean;
  testID?: string;
}

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  showChevron = true,
  danger = false,
  testID,
}: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center py-4 px-4 active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
      accessibilityRole="button"
      testID={testID}
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

const THEME_LABELS = {
  system: "settings.systemDefault",
  light: "settings.lightMode",
  dark: "settings.darkMode",
} as const;

const LANGUAGE_LABELS = {
  system: "settings.systemDefault",
  en: "settings.english",
  sr: "settings.serbian",
  es: "settings.spanish",
  fr: "settings.french",
  pt: "settings.portuguese",
  de: "settings.german",
} as const;

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { preference } = useTheme();
  const { unitSystem } = useUnits();
  const { timeFormat } = useTimeFormat();
  const { language } = useLanguage();
  const { isAuthenticated, user, signOut } = useAuth();
  const [tipsEnabled, setTipsEnabledState] = useState(true);

  useEffect(() => {
    getTipsEnabled().then(setTipsEnabledState);
  }, []);

  const handleToggleTips = async () => {
    const newValue = !tipsEnabled;
    await setTipsEnabled(newValue);
    setTipsEnabledState(newValue);
  };

  const handleSignOut = async () => {
    Alert.alert(
      t("settings.signOut"),
      t("auth.signOutConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.confirm"),
          style: "destructive",
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  const handleSignIn = () => {
    router.dismissAll();
    router.push("/auth/sign-in");
  };

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
      <View className="items-center pt-2 pb-3 border-b border-border-subtle dark:border-border-dark-subtle">
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
          {t("navigation.settings")}
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4">
        {/* Preferences */}
        <SettingsSection title={t("settings.preferences")}>
          <SettingsRow
            icon="🌐"
            label={t("settings.language")}
            value={t(LANGUAGE_LABELS[language])}
            onPress={() => router.push("/settings/language")}
            testID="language-setting"
          />
          <SettingsDivider />
          <SettingsRow
            icon="📏"
            label={t("settings.units")}
            value={unitSystem === "imperial" ? t("settings.imperial") : t("settings.metric")}
            onPress={() => router.push("/settings/units")}
            testID="units-setting"
          />
          <SettingsDivider />
          <SettingsRow
            icon="🕐"
            label={t("settings.timeFormat")}
            value={timeFormat === "24h" ? t("settings.24hour") : t("settings.12hour")}
            onPress={() => router.push("/settings/time-format")}
            testID="time-format-setting"
          />
          <SettingsDivider />
          <SettingsRow
            icon="🎨"
            label={t("settings.theme")}
            value={t(THEME_LABELS[preference])}
            onPress={() => router.push("/settings/theme")}
            testID="theme-setting"
          />
          <SettingsDivider />
          <SettingsRow
            icon="📱"
            label={t("settings.customizeDashboard")}
            onPress={() => router.push("/settings/dashboard")}
            testID="dashboard-config"
          />
          <SettingsDivider />
          <SettingsRow
            icon="⌚"
            label={t("settings.widgets")}
            onPress={() => router.push("/settings/widget-config")}
            testID="widget-config"
          />
          <SettingsDivider />
          <SettingsRow
            icon="🔔"
            label={t("settings.notifications")}
            onPress={() => router.push("/settings/notifications")}
          />
          <SettingsDivider />
          <SettingsRow
            icon="💡"
            label={t("settings.dailyTips")}
            value={tipsEnabled ? t("settings.on") : t("settings.off")}
            onPress={handleToggleTips}
            testID="daily-tips-setting"
          />
        </SettingsSection>

        {/* Data */}
        <SettingsSection title={t("settings.data")}>
          <SettingsRow
            icon="📤"
            label={t("settings.export")}
            onPress={() => router.push("/settings/export")}
          />
          <SettingsDivider />
          <SettingsRow
            icon="📄"
            label={t("settings.generateReport")}
            onPress={() => router.push("/settings/reports")}
          />
        </SettingsSection>

        {/* Household */}
        <SettingsSection title={t("household.title")}>
          <SettingsRow
            icon="👨‍👩‍👧"
            label={t("household.familySharing")}
            onPress={() => router.push("/settings/household")}
            testID="household-settings"
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
            onPress={() => Linking.openURL("https://srdjancoric.github.io/sofibaby-privacy/")}
          />
        </SettingsSection>

        {/* Account */}
        <SettingsSection title={t("settings.account")}>
          {isAuthenticated ? (
            <>
              <SettingsRow
                icon="👤"
                label={user?.email || user?.displayName || t("auth.signedIn")}
                showChevron={false}
              />
              <SettingsDivider />
              <SettingsRow
                icon="🚪"
                label={t("settings.signOut")}
                onPress={handleSignOut}
                showChevron={false}
                testID="sign-out-button"
              />
              <SettingsDivider />
              <SettingsRow
                icon="🗑️"
                label={t("settings.deleteAccount")}
                onPress={() => router.push("/settings/delete-account")}
                danger
              />
            </>
          ) : (
            <>
              <SettingsRow
                icon="☁️"
                label={t("auth.signInToSync")}
                onPress={handleSignIn}
                testID="sign-in-to-sync"
              />
              <Text className="px-4 py-2 text-sm text-content-tertiary dark:text-content-dark-tertiary">
                {t("auth.signInToSyncDescription")}
              </Text>
            </>
          )}
        </SettingsSection>

        {/* Bottom spacing */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
