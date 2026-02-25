import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "nativewind";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
} from "react-native-reanimated";
import { useMilestones, useBaby } from "@/contexts";
import {
  AGE_GROUPS,
  CATEGORY_ORDER,
  CATEGORY_EMOJI,
  getMilestonesByCategory,
  getCurrentAgeGroupKey,
} from "@/constants/milestones";
import type { MilestoneCategory } from "@/constants/milestones";
import { ACTIVITY, SURFACE, TEXT } from "@/constants/colors";

const GOLD = ACTIVITY.milestones.accent;
const GOLD_DARK = ACTIVITY.milestones.accentDark;
const MUTED_BG = ACTIVITY.milestones.muted;
const MUTED_BG_DARK = ACTIVITY.milestones.mutedDark;
const NOT_SURE_COLOR = "#E0A099";

const CATEGORY_LABELS: Record<MilestoneCategory, "milestones.social" | "milestones.language" | "milestones.cognitive" | "milestones.movement"> = {
  social: "milestones.social",
  language: "milestones.language",
  cognitive: "milestones.cognitive",
  movement: "milestones.movement",
};

export default function MilestonesScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { selectedBaby } = useBaby();
  const {
    setMilestoneState,
    clearMilestoneState,
    getMilestoneState,
    getYesCountForAge,
    getNotSureCountForAge,
    getTotalCountForAge,
    isAgeCompleted,
    responses,
  } = useMilestones();

  const currentAgeKey = useMemo(() => {
    if (!selectedBaby?.birthDate) return AGE_GROUPS[0].key;
    return getCurrentAgeGroupKey(new Date(selectedBaby.birthDate)) ?? AGE_GROUPS[0].key;
  }, [selectedBaby?.birthDate]);

  const [selectedAgeKey, setSelectedAgeKey] = useState(currentAgeKey);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const agePickerRef = useRef<ScrollView>(null);

  useEffect(() => {
    setSelectedAgeKey(currentAgeKey);
  }, [currentAgeKey]);

  const selectedGroup = useMemo(
    () => AGE_GROUPS.find((g) => g.key === selectedAgeKey) ?? AGE_GROUPS[0],
    [selectedAgeKey]
  );

  const categorized = useMemo(
    () => getMilestonesByCategory(selectedAgeKey),
    [selectedAgeKey]
  );

  const yesCount = useMemo(() => getYesCountForAge(selectedAgeKey), [getYesCountForAge, selectedAgeKey, responses]);
  const notSureCount = useMemo(() => getNotSureCountForAge(selectedAgeKey), [getNotSureCountForAge, selectedAgeKey, responses]);
  const totalCount = useMemo(() => getTotalCountForAge(selectedAgeKey), [getTotalCountForAge, selectedAgeKey]);
  const progress = totalCount > 0 ? Math.round((yesCount / totalCount) * 100) : 0;
  const completed = useMemo(() => isAgeCompleted(selectedAgeKey), [isAgeCompleted, selectedAgeKey, responses]);

  const prevCompletedRef = useRef(completed);
  useEffect(() => {
    if (completed && !prevCompletedRef.current) {
      setShowCelebration(true);
    }
    prevCompletedRef.current = completed;
  }, [completed]);

  const handleToggle = useCallback(
    async (milestoneId: string) => {
      const current = getMilestoneState(milestoneId);
      switch (current) {
        case "not_yet":
          await setMilestoneState(milestoneId, "yes");
          break;
        case "yes":
          await setMilestoneState(milestoneId, "not_sure");
          break;
        case "not_sure":
          await clearMilestoneState(milestoneId);
          break;
      }
    },
    [getMilestoneState, setMilestoneState, clearMilestoneState]
  );

  const accent = isDark ? GOLD_DARK : GOLD;
  const mutedBg = isDark ? MUTED_BG_DARK : MUTED_BG;

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-surface-dark" edges={["top"]}>
      <View className="items-center pt-2 pb-1">
        <View className="w-9 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mb-3" />
        <View className="flex-row items-center">
          <Text className="text-lg font-semibold text-text-primary dark:text-text-primary-dark font-nunito-semibold">
            {t("milestones.title")}
          </Text>
          <Pressable
            onPress={() => setShowInfo(true)}
            hitSlop={8}
            className="ml-1.5"
          >
            <View
              className="items-center justify-center"
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                borderWidth: 1.5,
                borderColor: isDark ? "#8A8588" : "#7A756E",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: isDark ? "#8A8588" : "#7A756E",
                  lineHeight: 13,
                }}
              >
                i
              </Text>
            </View>
          </Pressable>
        </View>
        {selectedBaby && (
          <Text className="text-sm text-text-secondary dark:text-text-secondary-dark font-nunito">
            {selectedBaby.name}
          </Text>
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-6"
        showsVerticalScrollIndicator={false}
      >
        {/* Illustration */}
        <View className="items-center mt-4 mb-3">
          <View
            className="w-24 h-24 rounded-full items-center justify-center"
            style={{ backgroundColor: mutedBg }}
          >
            <Text style={{ fontSize: 40 }}>{"\u2B50"}</Text>
          </View>
        </View>

        {/* Star trail */}
        <View className="items-center mb-4">
          <View className="flex-row justify-center">
            {AGE_GROUPS.map((group) => (
              <Text
                key={group.key}
                style={{
                  fontSize: 16,
                  marginHorizontal: 1,
                  color: isAgeCompleted(group.key) ? accent : isDark ? "#4A4550" : "#D5D1CC",
                }}
              >
                {isAgeCompleted(group.key) ? "\u2605" : "\u2606"}
              </Text>
            ))}
          </View>
        </View>

        {/* Age group picker */}
        <ScrollView
          ref={agePickerRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 pb-2"
          className="mb-4"
        >
          {AGE_GROUPS.map((group, idx) => {
            const isActive = group.key === selectedAgeKey;
            const isFuture = group.months > (selectedGroup?.months ?? 0) && group.key !== currentAgeKey;
            return (
              <Pressable
                key={group.key}
                onPress={() => setSelectedAgeKey(group.key)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 9999,
                  ...(isActive ? {
                    backgroundColor: isDark ? SURFACE.dark.card : SURFACE.light.card,
                  } : {}),
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: isActive
                      ? (isDark ? TEXT.dark.primary : TEXT.light.primary)
                      : (isDark ? TEXT.dark.secondary : TEXT.light.secondary),
                    fontWeight: isActive ? "600" : "500",
                    opacity: isFuture && !isActive ? 0.5 : 1,
                  }}
                >
                  {group.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Progress */}
        <View className="mb-4">
          <Text className="text-sm text-text-secondary dark:text-text-secondary-dark font-nunito mb-1.5">
            {yesCount} of {totalCount}
          </Text>
          <View className="h-2 rounded-full bg-border-subtle dark:bg-border-subtle-dark overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{ width: `${progress}%`, backgroundColor: accent }}
            />
          </View>
        </View>

        {/* Category sections */}
        {CATEGORY_ORDER.map((category) => {
          const items = categorized[category];
          if (items.length === 0) return null;
          const categoryYes = items.filter((m) => getMilestoneState(m.id) === "yes").length;
          const allDone = categoryYes === items.length;

          return (
            <View key={category} className="mb-5">
              <View className="flex-row items-center mb-2.5 px-1">
                <Text style={{ fontSize: 18 }} className="mr-2">
                  {CATEGORY_EMOJI[category]}
                </Text>
                <Text className="text-base font-nunito-semibold text-text-primary dark:text-text-primary-dark flex-1">
                  {t(CATEGORY_LABELS[category])}
                </Text>
                <View
                  className="rounded-full px-2.5 py-0.5"
                  style={{
                    backgroundColor: allDone
                      ? (isDark ? "rgba(218, 187, 120, 0.15)" : "rgba(201, 165, 92, 0.12)")
                      : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
                  }}
                >
                  <Text
                    className="font-nunito-semibold"
                    style={{
                      fontSize: 12,
                      color: allDone ? accent : (isDark ? "#8A8588" : "#7A756E"),
                    }}
                  >
                    {categoryYes}/{items.length}
                  </Text>
                </View>
              </View>

              <View style={{ gap: 4 }}>
                {items.map((milestone) => (
                  <MilestoneRow
                    key={milestone.id}
                    milestoneId={milestone.id}
                    text={milestone.text}
                    state={getMilestoneState(milestone.id)}
                    onToggle={handleToggle}
                    accent={accent}
                    isDark={isDark}
                  />
                ))}
              </View>
            </View>
          );
        })}

        {/* Attribution */}
        <Text className="text-xs text-text-tertiary dark:text-text-tertiary-dark text-center mt-2 mb-4 font-nunito">
          {t("milestones.attribution")}
        </Text>
      </ScrollView>

      {showInfo && (
        <MilestonesInfoOverlay
          onClose={() => setShowInfo(false)}
          accent={accent}
          isDark={isDark}
        />
      )}

      {showCelebration && (
        <CelebrationOverlay
          visible={showCelebration}
          onDismiss={() => setShowCelebration(false)}
          accent={accent}
        />
      )}
    </SafeAreaView>
  );
}

function MilestoneRow({
  milestoneId,
  text,
  state,
  onToggle,
  accent,
  isDark,
}: {
  milestoneId: string;
  text: string;
  state: "yes" | "not_sure" | "not_yet";
  onToggle: (id: string) => void;
  accent: string;
  isDark: boolean;
}) {
  const handlePress = useCallback(() => {
    onToggle(milestoneId);
  }, [milestoneId, onToggle]);

  const leftAccent = state === "yes" ? accent
    : state === "not_sure" ? NOT_SURE_COLOR
    : "transparent";

  return (
    <Pressable
      onPress={handlePress}
      className="flex-row items-center rounded-xl bg-surface-card dark:bg-surface-dark-card overflow-hidden"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <View
        style={{ width: 3, backgroundColor: leftAccent, alignSelf: "stretch" }}
      />
      <View className="flex-row items-center flex-1 py-2.5 pl-3 pr-3.5">
        <StateCircle state={state} accent={accent} isDark={isDark} />
        <Text
          className={`flex-1 ml-2.5 font-nunito-medium ${
            state === "yes"
              ? "text-text-secondary dark:text-text-secondary-dark"
              : "text-text-primary dark:text-text-primary-dark"
          }`}
          style={{ fontSize: 14, lineHeight: 20 }}
        >
          {text}
        </Text>
      </View>
    </Pressable>
  );
}

function StateCircle({
  state,
  accent,
  isDark,
}: {
  state: "yes" | "not_sure" | "not_yet";
  accent: string;
  isDark: boolean;
}) {
  if (state === "yes") {
    return (
      <View
        className="items-center justify-center"
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: accent,
        }}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700", lineHeight: 15 }}>
          {"\u2713"}
        </Text>
      </View>
    );
  }

  if (state === "not_sure") {
    return (
      <View
        className="items-center justify-center"
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: isDark ? "rgba(224, 160, 153, 0.7)" : NOT_SURE_COLOR,
        }}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700", lineHeight: 15 }}>?</Text>
      </View>
    );
  }

  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: isDark ? "#4A4550" : "#D5D1CC",
      }}
    />
  );
}

function MilestonesInfoOverlay({
  onClose,
  accent,
  isDark,
}: {
  onClose: () => void;
  accent: string;
  isDark: boolean;
}) {
  const { t } = useTranslation();
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 200 });
  }, []);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: "center",
          alignItems: "center",
          zIndex: 50,
          backgroundColor: "rgba(0,0,0,0.4)",
        },
        backdropStyle,
      ]}
    >
      <Pressable
        onPress={onClose}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View
        className="mx-8 rounded-2xl bg-surface-card dark:bg-surface-dark-card p-5"
        style={{ maxWidth: 340, width: "85%" }}
      >
        <Text className="text-base font-nunito-semibold text-text-primary dark:text-text-primary-dark mb-3">
          {t("milestones.infoTitle")}
        </Text>

        <View className="mb-3" style={{ gap: 10 }}>
          <View className="flex-row items-start">
            <View
              className="items-center justify-center mr-2.5"
              style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: accent }}
            >
              <Text style={{ color: "#FFF", fontSize: 13, fontWeight: "700", lineHeight: 15 }}>{"\u2713"}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-nunito-semibold text-text-primary dark:text-text-primary-dark">
                {t("milestones.yes")}
              </Text>
              <Text className="text-xs font-nunito text-text-secondary dark:text-text-secondary-dark mt-0.5">
                {t("milestones.infoYes")}
              </Text>
            </View>
          </View>

          <View className="flex-row items-start">
            <View
              className="items-center justify-center mr-2.5"
              style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: NOT_SURE_COLOR }}
            >
              <Text style={{ color: "#FFF", fontSize: 13, fontWeight: "700", lineHeight: 15 }}>?</Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-nunito-semibold text-text-primary dark:text-text-primary-dark">
                {t("milestones.notSure")}
              </Text>
              <Text className="text-xs font-nunito text-text-secondary dark:text-text-secondary-dark mt-0.5">
                {t("milestones.infoNotSure")}
              </Text>
            </View>
          </View>

          <View className="flex-row items-start">
            <View
              className="mr-2.5"
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 1.5,
                borderColor: isDark ? "#4A4550" : "#D5D1CC",
              }}
            />
            <View className="flex-1">
              <Text className="text-sm font-nunito-semibold text-text-primary dark:text-text-primary-dark">
                {t("milestones.notYet")}
              </Text>
              <Text className="text-xs font-nunito text-text-secondary dark:text-text-secondary-dark mt-0.5">
                {t("milestones.infoNotYet")}
              </Text>
            </View>
          </View>
        </View>

        <View className="border-t border-border-subtle dark:border-border-subtle-dark pt-3 mt-1">
          <Text className="text-xs font-nunito text-text-tertiary dark:text-text-tertiary-dark leading-4">
            {t("milestones.infoReassurance")}
          </Text>
        </View>

        <Pressable
          onPress={onClose}
          className="items-center mt-4 py-2 rounded-xl"
          style={{ backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)" }}
        >
          <Text className="text-sm font-nunito-semibold text-text-primary dark:text-text-primary-dark">
            {t("common.done")}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function CelebrationOverlay({
  visible,
  onDismiss,
  accent,
}: {
  visible: boolean;
  onDismiss: () => void;
  accent: string;
}) {
  const { width, height } = useWindowDimensions();
  const starScale = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);
  const particles = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => ({
      id: i,
      angle: (i / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
      distance: 80 + Math.random() * 60,
      delay: Math.random() * 300,
    }));
  }, []);

  useEffect(() => {
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 200 });
      starScale.value = withSequence(
        withSpring(1.2, { damping: 8, stiffness: 120 }),
        withSpring(1, { damping: 10 })
      );

      const timer = setTimeout(() => {
        overlayOpacity.value = withTiming(0, { duration: 400 });
        starScale.value = withTiming(0, { duration: 400 });
        setTimeout(() => {
          runOnJS(onDismiss)();
        }, 450);
      }, 2200);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const starStyle = useAnimatedStyle(() => ({
    transform: [{ scale: starScale.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: "center",
          alignItems: "center",
          zIndex: 100,
        },
        overlayStyle,
      ]}
      pointerEvents="none"
    >
      {particles.map((p) => (
        <StarParticle
          key={p.id}
          centerX={width / 2}
          centerY={height / 2}
          angle={p.angle}
          distance={p.distance}
          delay={p.delay}
          accent={accent}
        />
      ))}
      <Animated.View style={starStyle}>
        <Text style={{ fontSize: 64 }}>{"\u2B50"}</Text>
      </Animated.View>
    </Animated.View>
  );
}

function StarParticle({
  centerX,
  centerY,
  angle,
  distance,
  delay,
  accent,
}: {
  centerX: number;
  centerY: number;
  angle: number;
  distance: number;
  delay: number;
  accent: string;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.3);

  useEffect(() => {
    const targetX = Math.cos(angle) * distance;
    const targetY = Math.sin(angle) * distance;

    opacity.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(800, withTiming(0, { duration: 600 }))
    ));
    translateX.value = withDelay(delay, withTiming(targetX, { duration: 1000 }));
    translateY.value = withDelay(delay, withTiming(targetY, { duration: 1000 }));
    scale.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 300 }),
      withTiming(0.5, { duration: 700 })
    ));
  }, []);

  const style = useAnimatedStyle(() => ({
    position: "absolute" as const,
    left: centerX - 8,
    top: centerY - 8,
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={style}>
      <Text style={{ fontSize: 16, color: accent }}>{"\u2B50"}</Text>
    </Animated.View>
  );
}
