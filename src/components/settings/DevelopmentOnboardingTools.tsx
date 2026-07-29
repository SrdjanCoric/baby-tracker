import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth, useLanguage } from "@/contexts";
import {
  clearUnfinishedOnboardingDraft,
  runFirstLaunchRoutingAgain,
} from "@/services/development-onboarding-tools";
import {
  DEVELOPMENT_ONBOARDING_PREVIEW_ADAPTERS,
  getDevelopmentOnboardingPreview,
  type DevelopmentOnboardingPreviewPath,
  type DevelopmentOnboardingPreviewScenario,
} from "@/services/development-onboarding-preview";
import {
  canRenderDevelopmentOnboardingTools,
  enableDevelopmentOnboardingReplay,
} from "@/utils/development-onboarding";

const PATHS = Object.keys(
  DEVELOPMENT_ONBOARDING_PREVIEW_ADAPTERS
) as DevelopmentOnboardingPreviewPath[];

const SCENARIO_LABELS: Record<DevelopmentOnboardingPreviewScenario, string> = {
  initial: "Start",
  loading: "Loading",
  "recoverable-error": "Recoverable error",
  cancelled: "Cancellation",
  skipped: "Skip",
  success: "Success",
};

function PreviewModal({ onClose }: { onClose: () => void }) {
  const [path, setPath] = useState<DevelopmentOnboardingPreviewPath>("start-tracking");
  const [scenario, setScenario] = useState<DevelopmentOnboardingPreviewScenario>("initial");
  const adapter = DEVELOPMENT_ONBOARDING_PREVIEW_ADAPTERS[path];
  const model = getDevelopmentOnboardingPreview(path, scenario);

  const selectPath = (nextPath: DevelopmentOnboardingPreviewPath) => {
    setPath(nextPath);
    setScenario("initial");
  };

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-border-subtle dark:border-border-dark-subtle">
          <View className="flex-1 pr-4">
            <Text className="text-lg font-bold text-content-primary dark:text-content-dark-primary">
              Isolated onboarding preview
            </Text>
            <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mt-1">
              Sample data only. Real app stores and services are disconnected.
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            testID="exit-onboarding-preview"
          >
            <Text className="text-base font-semibold text-primary-600 dark:text-primary-400">
              Exit
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerClassName="p-5 gap-5">
          <View>
            <Text className="text-xs font-semibold uppercase text-content-tertiary dark:text-content-dark-tertiary mb-2">
              Path
            </Text>
            <View className="gap-2">
              {PATHS.map(option => (
                <Pressable
                  key={option}
                  onPress={() => selectPath(option)}
                  className="rounded-xl border px-4 py-3"
                  accessibilityRole="radio"
                  accessibilityState={{ selected: option === path }}
                  testID={`preview-path-${option}`}
                >
                  <Text className="font-semibold text-content-primary dark:text-content-dark-primary">
                    {DEVELOPMENT_ONBOARDING_PREVIEW_ADAPTERS[option].label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View>
            <Text className="text-xs font-semibold uppercase text-content-tertiary dark:text-content-dark-tertiary mb-2">
              State
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {adapter.scenarios.map(option => (
                <Pressable
                  key={option}
                  onPress={() => setScenario(option)}
                  className="rounded-full border px-3 py-2"
                  accessibilityRole="radio"
                  accessibilityState={{ selected: option === scenario }}
                  testID={`preview-scenario-${option}`}
                >
                  <Text className="text-sm text-content-primary dark:text-content-dark-primary">
                    {SCENARIO_LABELS[option]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View
            className="rounded-card bg-surface-card dark:bg-surface-dark-card p-6 min-h-64 justify-center"
            testID="preview-state-card"
          >
            {model.status === "loading" && <ActivityIndicator size="large" />}
            <Text className="text-2xl font-bold text-content-primary dark:text-content-dark-primary mt-4">
              {model.title}
            </Text>
            <Text className="text-base leading-6 text-content-secondary dark:text-content-dark-secondary mt-3">
              {model.description}
            </Text>
            {model.primaryAction && (
              <Pressable
                onPress={() => setScenario("initial")}
                className="rounded-button-lg bg-primary-600 px-4 py-3 items-center mt-6"
                accessibilityRole="button"
              >
                <Text className="text-white font-bold">{model.primaryAction}</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

interface ToolRowProps {
  title: string;
  description: string;
  onPress: () => void;
  testID: string;
}

function ToolRow({ title, description, onPress, testID }: ToolRowProps) {
  return (
    <Pressable
      onPress={onPress}
      className="px-4 py-4 active:bg-surface-secondary dark:active:bg-surface-dark-secondary"
      accessibilityRole="button"
      testID={testID}
    >
      <View className="flex-row items-center">
        <Text className="flex-1 text-base font-semibold text-content-primary dark:text-content-dark-primary">
          {title}
        </Text>
        <Text className="text-content-tertiary dark:text-content-dark-tertiary">›</Text>
      </View>
      <Text className="text-sm text-content-secondary dark:text-content-dark-secondary mt-1 pr-4">
        {description}
      </Text>
    </Pressable>
  );
}

function DevelopmentOnboardingToolsContent() {
  const { isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const [previewVisible, setPreviewVisible] = useState(false);

  const replayFirstLaunch = async () => {
    try {
      await runFirstLaunchRoutingAgain({ isAuthenticated, language });
      enableDevelopmentOnboardingReplay(__DEV__);
      router.dismissAll();
      router.replace("/onboarding/owner");
    } catch {
      Alert.alert("Replay failed", "Onboarding state could not be cleared. No routing was changed.");
    }
  };

  const confirmReplay = () => {
    Alert.alert(
      "Run first-launch routing again?",
      "This clears onboarding completion and drafts, then runs the upcoming role-based router using the current account. Your account, household, babies, activities, and preferences are preserved.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Run again", style: "destructive", onPress: replayFirstLaunch },
      ]
    );
  };

  const clearDraft = async () => {
    try {
      await clearUnfinishedOnboardingDraft();
      Alert.alert("Draft cleared", "Onboarding completion and all other app data were preserved.");
    } catch {
      Alert.alert("Draft not cleared", "The unfinished onboarding draft could not be removed.");
    }
  };

  return (
    <>
      <View className="mb-6">
        <Text className="text-xs font-semibold text-content-tertiary dark:text-content-dark-tertiary uppercase tracking-wider px-4 mb-2">
          Developer Tools
        </Text>
        <View className="bg-surface-card dark:bg-surface-dark-card rounded-card overflow-hidden">
          <ToolRow
            title="Preview onboarding"
            description="Explore sample paths and UI states without changing app data."
            onPress={() => setPreviewVisible(true)}
            testID="preview-onboarding"
          />
          <View className="h-px bg-gray-200 dark:bg-gray-700 ml-4" />
          <ToolRow
            title="Run first-launch routing again"
            description="Clear onboarding progress and replay role-based routing with the current account data."
            onPress={confirmReplay}
            testID="replay-first-launch"
          />
          <View className="h-px bg-gray-200 dark:bg-gray-700 ml-4" />
          <ToolRow
            title="Clear unfinished onboarding draft"
            description="Remove only a resumable draft. Completion and all other data stay unchanged."
            onPress={clearDraft}
            testID="clear-onboarding-draft"
          />
        </View>
      </View>
      {previewVisible && <PreviewModal onClose={() => setPreviewVisible(false)} />}
    </>
  );
}

export function DevelopmentOnboardingTools() {
  if (!canRenderDevelopmentOnboardingTools(__DEV__)) return null;
  return <DevelopmentOnboardingToolsContent />;
}
