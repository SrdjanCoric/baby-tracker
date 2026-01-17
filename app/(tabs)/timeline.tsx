import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  TimelineItem,
  TimelineDayHeader,
  TimelineDivider,
} from "@/components";

// Mock data for demonstration - will be replaced with real data
const MOCK_TIMELINE = [
  {
    id: "1",
    activity: "feeding" as const,
    time: "2:30 PM",
    title: "Bottle Feeding",
    subtitle: "4 oz · Breast milk",
  },
  {
    id: "2",
    activity: "sleep" as const,
    time: "1:45 PM",
    title: "Nap ended",
    subtitle: "Duration: 1h 15m",
  },
  {
    id: "3",
    activity: "diaper" as const,
    time: "12:30 PM",
    title: "Diaper Change",
    subtitle: "Wet",
  },
  {
    id: "4",
    activity: "feeding" as const,
    time: "11:00 AM",
    title: "Breastfeeding",
    subtitle: "Left side · 18 min",
  },
];

export default function TimelineScreen() {
  const { t } = useTranslation();

  const hasEntries = MOCK_TIMELINE.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["bottom"]}>
      {hasEntries ? (
        <ScrollView className="flex-1">
          <TimelineDayHeader title={t("common.today")} date="Jan 17" />

          {MOCK_TIMELINE.map((item, index) => (
            <View key={item.id}>
              <TimelineItem
                activity={item.activity}
                time={item.time}
                title={item.title}
                subtitle={item.subtitle}
                onPress={() => {
                  // Navigate to edit screen
                }}
              />
              {index < MOCK_TIMELINE.length - 1 && <TimelineDivider />}
            </View>
          ))}

          <TimelineDayHeader title={t("common.yesterday")} date="Jan 16" />

          {/* More mock items for yesterday */}
          <TimelineItem
            activity="diaper"
            time="8:00 PM"
            title="Diaper Change"
            subtitle="Mixed · Brown"
            onPress={() => {}}
          />
          <TimelineDivider />
          <TimelineItem
            activity="sleep"
            time="7:30 PM"
            title="Night Sleep started"
            onPress={() => {}}
          />
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-6xl mb-4">📋</Text>
          <Text className="text-xl font-semibold text-content-primary dark:text-content-dark-primary mb-2">
            {t("timeline.noEntries")}
          </Text>
          <Text className="text-center text-content-secondary dark:text-content-dark-secondary">
            {t("timeline.startTracking")}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
