import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";

type TimePeriod = "daily" | "weekly";

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  subvalue?: string;
  color: string;
  bgColor: string;
}

function StatCard({ icon, label, value, subvalue, color, bgColor }: StatCardProps) {
  return (
    <View
      className="flex-1 rounded-card p-4"
      style={{ backgroundColor: bgColor }}
    >
      <View className="flex-row items-center mb-2">
        <Text className="text-xl mr-2">{icon}</Text>
        <Text className="text-xs font-semibold uppercase tracking-wider text-content-secondary dark:text-content-dark-secondary">
          {label}
        </Text>
      </View>
      <Text
        className="text-stat font-bold"
        style={{ color }}
      >
        {value}
      </Text>
      {subvalue && (
        <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-1">
          {subvalue}
        </Text>
      )}
    </View>
  );
}

export default function StatisticsScreen() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<TimePeriod>("daily");

  // Mock data - will be replaced with real calculations
  const mockStats = {
    daily: {
      totalFeedings: "6",
      feedingDuration: "1h 45m",
      totalSleep: "14h 30m",
      napCount: "3 naps",
      diaperCount: "8",
      wetDry: "5 wet · 3 dirty",
    },
    weekly: {
      totalFeedings: "42",
      feedingDuration: "12h 15m",
      totalSleep: "98h",
      napCount: "21 naps",
      diaperCount: "56",
      wetDry: "35 wet · 21 dirty",
    },
  };

  const stats = mockStats[period];

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["bottom"]}>
      {/* Period selector */}
      <View className="flex-row mx-4 mt-2 mb-4 p-1 bg-surface-secondary dark:bg-surface-dark-secondary rounded-pill">
        <Pressable
          onPress={() => setPeriod("daily")}
          className={`flex-1 py-2 rounded-pill ${
            period === "daily" ? "bg-surface-card dark:bg-surface-dark-card" : ""
          }`}
        >
          <Text
            className={`text-center font-semibold ${
              period === "daily"
                ? "text-content-primary dark:text-content-dark-primary"
                : "text-content-secondary dark:text-content-dark-secondary"
            }`}
          >
            {t("statistics.daily")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setPeriod("weekly")}
          className={`flex-1 py-2 rounded-pill ${
            period === "weekly" ? "bg-surface-card dark:bg-surface-dark-card" : ""
          }`}
        >
          <Text
            className={`text-center font-semibold ${
              period === "weekly"
                ? "text-content-primary dark:text-content-dark-primary"
                : "text-content-secondary dark:text-content-dark-secondary"
            }`}
          >
            {t("statistics.weekly")}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
      >
        {/* Feeding stats */}
        <View className="mb-4">
          <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider mb-2">
            {t("feeding.title")}
          </Text>
          <View className="flex-row gap-3">
            <StatCard
              icon="🤱"
              label={t("statistics.totalFeedings")}
              value={stats.totalFeedings}
              subvalue={stats.feedingDuration}
              color="#88B04B"
              bgColor="#E8F0E0"
            />
          </View>
        </View>

        {/* Sleep stats */}
        <View className="mb-4">
          <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider mb-2">
            {t("sleep.title")}
          </Text>
          <View className="flex-row gap-3">
            <StatCard
              icon="😴"
              label={t("statistics.totalSleep")}
              value={stats.totalSleep}
              subvalue={stats.napCount}
              color="#6B5B95"
              bgColor="#E8E4F0"
            />
          </View>
        </View>

        {/* Diaper stats */}
        <View className="mb-4">
          <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider mb-2">
            {t("diaper.title")}
          </Text>
          <View className="flex-row gap-3">
            <StatCard
              icon="👶"
              label={t("statistics.totalDiapers")}
              value={stats.diaperCount}
              subvalue={stats.wetDry}
              color="#E8A5A3"
              bgColor="#FDF0EF"
            />
          </View>
        </View>

        {/* Placeholder for charts */}
        <View className="bg-surface-card dark:bg-surface-dark-card rounded-card p-6 items-center justify-center min-h-[200px] mb-6">
          <Text className="text-4xl mb-3">📈</Text>
          <Text className="text-base text-content-secondary dark:text-content-dark-secondary text-center">
            Charts will appear here once you have more data
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
