import { useRef, useState } from "react";
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
import { useAuth, useLanguage, useTheme } from "@/contexts";
import { ACTION, BORDER, SURFACE, TEXT } from "@/constants/colors";
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
import { canRenderDevelopmentOnboardingTools } from "@/utils/development-onboarding";

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

interface PreviewModalProps {
  isDark: boolean;
  onClose: () => void;
}

function PreviewModal({ isDark, onClose }: PreviewModalProps) {
  const [path, setPath] = useState<DevelopmentOnboardingPreviewPath>("start-tracking");
  const [scenario, setScenario] = useState<DevelopmentOnboardingPreviewScenario>("initial");
  const adapter = DEVELOPMENT_ONBOARDING_PREVIEW_ADAPTERS[path];
  const model = getDevelopmentOnboardingPreview(path, scenario);
  const colors = {
    background: isDark ? SURFACE.dark.background : SURFACE.light.background,
    card: isDark ? SURFACE.dark.card : SURFACE.light.card,
    secondary: isDark ? SURFACE.dark.secondary : SURFACE.light.secondary,
    primaryText: isDark ? TEXT.dark.primary : TEXT.light.primary,
    secondaryText: isDark ? TEXT.dark.secondary : TEXT.light.secondary,
    tertiaryText: isDark ? TEXT.dark.tertiary : TEXT.light.tertiary,
    border: isDark ? BORDER.dark.default : BORDER.light.default,
    subtleBorder: isDark ? BORDER.dark.subtle : BORDER.light.subtle,
    action: isDark ? ACTION.dark.primary : ACTION.light.primary,
  };

  const selectPath = (nextPath: DevelopmentOnboardingPreviewPath) => {
    setPath(nextPath);
    setScenario("initial");
  };

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        <View
          className="flex-row items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: colors.subtleBorder }}
        >
          <View className="flex-1 pr-4">
            <Text className="text-lg font-bold" style={{ color: colors.primaryText }}>
              Isolated onboarding preview
            </Text>
            <Text className="text-sm mt-1" style={{ color: colors.secondaryText }}>
              Sample data only. Real app stores and services are disconnected.
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            testID="exit-onboarding-preview"
          >
            <Text className="text-base font-semibold" style={{ color: colors.action }}>
              Exit
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerClassName="p-5 gap-5">
          <View>
            <Text
              className="text-xs font-semibold uppercase mb-2"
              style={{ color: colors.tertiaryText }}
            >
              Path
            </Text>
            <View className="gap-2">
              {PATHS.map(option => {
                const selected = option === path;
                return (
                  <Pressable
                    key={option}
                    onPress={() => selectPath(option)}
                    className="rounded-xl border px-4 py-3"
                    style={{
                      backgroundColor: selected ? colors.secondary : colors.background,
                      borderColor: selected ? colors.action : colors.border,
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    testID={`preview-path-${option}`}
                  >
                    <Text className="font-semibold" style={{ color: colors.primaryText }}>
                      {DEVELOPMENT_ONBOARDING_PREVIEW_ADAPTERS[option].label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View>
            <Text
              className="text-xs font-semibold uppercase mb-2"
              style={{ color: colors.tertiaryText }}
            >
              State
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {adapter.scenarios.map(option => {
                const selected = option === scenario;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setScenario(option)}
                    className="rounded-full border px-3 py-2"
                    style={{
                      backgroundColor: selected ? colors.secondary : colors.background,
                      borderColor: selected ? colors.action : colors.border,
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    testID={`preview-scenario-${option}`}
                  >
                    <Text className="text-sm" style={{ color: colors.primaryText }}>
                      {SCENARIO_LABELS[option]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View
            className="rounded-card p-6 min-h-72 justify-center"
            style={{ backgroundColor: colors.card }}
            testID={`preview-state-${path}-${scenario}`}
          >
            <Text className="text-xs font-bold uppercase mb-3" style={{ color: colors.action }}>
              {adapter.label}
            </Text>
            {model.status === "loading" && (
              <ActivityIndicator size="large" color={colors.action} testID="preview-loading" />
            )}
            <Text className="text-2xl font-bold mt-4" style={{ color: colors.primaryText }}>
              {model.title}
            </Text>
            <Text className="text-base leading-6 mt-3" style={{ color: colors.secondaryText }}>
              {model.description}
            </Text>
            {model.fields?.map(field => (
              <View
                key={field.label}
                className="rounded-xl border px-4 py-3 mt-5"
                style={{ borderColor: colors.border, backgroundColor: colors.background }}
              >
                <Text className="text-xs mb-1" style={{ color: colors.tertiaryText }}>
                  {field.label}
                </Text>
                <Text className="text-base font-semibold" style={{ color: colors.primaryText }}>
                  {field.value}
                </Text>
              </View>
            ))}
            {model.primaryAction && (
              <Pressable
                onPress={() => setScenario("initial")}
                className="rounded-button-lg px-4 py-3 items-center mt-6"
                style={{ backgroundColor: colors.action }}
                accessibilityRole="button"
              >
                <Text className="text-white font-bold">{model.primaryAction}</Text>
              </Pressable>
            )}
            {model.secondaryAction && (
              <Pressable
                onPress={() => setScenario("initial")}
                className="rounded-button-lg border px-4 py-3 items-center mt-3"
                style={{ borderColor: colors.border }}
                accessibilityRole="button"
              >
                <Text className="font-semibold" style={{ color: colors.primaryText }}>
                  {model.secondaryAction}
                </Text>
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
  disabled: boolean;
  isDark: boolean;
  onPress: () => void;
  testID: string;
}

function ToolRow({
  title,
  description,
  disabled,
  isDark,
  onPress,
  testID,
}: ToolRowProps) {
  const primaryText = isDark ? TEXT.dark.primary : TEXT.light.primary;
  const secondaryText = isDark ? TEXT.dark.secondary : TEXT.light.secondary;
  const tertiaryText = isDark ? TEXT.dark.tertiary : TEXT.light.tertiary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="px-4 py-4"
      style={{ opacity: disabled ? 0.5 : 1 }}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      testID={testID}
    >
      <View className="flex-row items-center">
        <Text className="flex-1 text-base font-semibold" style={{ color: primaryText }}>
          {title}
        </Text>
        <Text style={{ color: tertiaryText }}>›</Text>
      </View>
      <Text className="text-sm mt-1 pr-4" style={{ color: secondaryText }}>
        {description}
      </Text>
    </Pressable>
  );
}

function DevelopmentOnboardingToolsContent() {
  const { isAuthenticated } = useAuth();
  const { language } = useLanguage();
  const { isDark } = useTheme();
  const [previewVisible, setPreviewVisible] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const mutationRef = useRef(false);
  const card = isDark ? SURFACE.dark.card : SURFACE.light.card;
  const divider = isDark ? BORDER.dark.subtle : BORDER.light.subtle;
  const tertiaryText = isDark ? TEXT.dark.tertiary : TEXT.light.tertiary;

  const replayFirstLaunch = async () => {
    if (mutationRef.current) return;
    mutationRef.current = true;
    setIsMutating(true);
    try {
      await runFirstLaunchRoutingAgain({ isAuthenticated, language });
      router.dismissAll();
      router.replace(
        isAuthenticated ? "/onboarding/owner/restore" : "/onboarding/owner"
      );
    } catch {
      Alert.alert("Replay failed", "Onboarding state could not be cleared. No routing was changed.");
    } finally {
      mutationRef.current = false;
      setIsMutating(false);
    }
  };

  const confirmReplay = () => {
    if (mutationRef.current) return;
    Alert.alert(
      "Run first-launch routing again?",
      "This clears onboarding completion and drafts, then runs the production role-based router using the current account. Your account, household, babies, activities, and preferences are preserved.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Run again", style: "destructive", onPress: replayFirstLaunch },
      ]
    );
  };

  const clearDraft = async () => {
    if (mutationRef.current) return;
    mutationRef.current = true;
    setIsMutating(true);
    try {
      await clearUnfinishedOnboardingDraft();
      Alert.alert("Draft cleared", "Onboarding completion and all other app data were preserved.");
    } catch {
      Alert.alert("Draft not cleared", "The unfinished onboarding draft could not be removed.");
    } finally {
      mutationRef.current = false;
      setIsMutating(false);
    }
  };

  return (
    <>
      <View className="mb-6">
        <Text
          className="text-xs font-semibold uppercase tracking-wider px-4 mb-2"
          style={{ color: tertiaryText }}
        >
          Developer Tools
        </Text>
        <View className="rounded-card overflow-hidden" style={{ backgroundColor: card }}>
          <ToolRow
            title="Preview onboarding"
            description="Explore sample paths and UI states without changing app data."
            disabled={isMutating}
            isDark={isDark}
            onPress={() => setPreviewVisible(true)}
            testID="preview-onboarding"
          />
          <View className="h-px ml-4" style={{ backgroundColor: divider }} />
          <ToolRow
            title="Run first-launch routing again"
            description="Clear onboarding progress and replay role-based routing with the current account data."
            disabled={isMutating}
            isDark={isDark}
            onPress={confirmReplay}
            testID="replay-first-launch"
          />
          <View className="h-px ml-4" style={{ backgroundColor: divider }} />
          <ToolRow
            title="Clear unfinished onboarding draft"
            description="Remove only a resumable draft. Completion and all other data stay unchanged."
            disabled={isMutating}
            isDark={isDark}
            onPress={clearDraft}
            testID="clear-onboarding-draft"
          />
        </View>
      </View>
      {previewVisible && (
        <PreviewModal isDark={isDark} onClose={() => setPreviewVisible(false)} />
      )}
    </>
  );
}

export function DevelopmentOnboardingTools() {
  if (!canRenderDevelopmentOnboardingTools(__DEV__)) return null;
  return <DevelopmentOnboardingToolsContent />;
}
