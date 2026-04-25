import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  AppState,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useColorScheme } from "nativewind";
import { useTranslation } from "react-i18next";
import { useUnits } from "@/contexts";
import { selectDailyTips, Tip, TipCategory } from "@/utils/tip-selector";
import {
  getTipsDismissedDate,
  setTipsDismissedDate,
  getTipsEnabled,
} from "@/services/tip-storage";

interface TipCarouselProps {
  babyId?: string;
  birthDate?: Date;
}

const CATEGORY_ICONS: Record<TipCategory, string> = {
  development: "🌀",
  sleep: "😴",
  feeding: "🤱",
  health: "💊",
  play: "🧸",
  safety: "🛡️",
};

const CATEGORY_TRANSLATION_KEYS = {
  development: "tips.category.development",
  sleep: "tips.category.sleep",
  feeding: "tips.category.feeding",
  health: "tips.category.health",
  play: "tips.category.play",
  safety: "tips.category.safety",
} as const;

const COLORS = {
  light: {
    card: "#FEF7F4",
    border: "#F0E5DF",
    accent: "#8B5E2A",
    badge: "rgba(212, 165, 116, 0.12)",
    text: "#2D2A26",
    close: "rgba(212, 165, 116, 0.08)",
    closeText: "#857F78",
    dot: "rgba(212, 165, 116, 0.2)",
    dotActive: "#D4A574",
    hint: "#857F78",
    circle: "#D4A574",
  },
  dark: {
    card: "#322E2B",
    border: "rgba(255, 255, 255, 0.05)",
    accent: "#B5A7BD",
    badge: "rgba(181, 167, 189, 0.12)",
    text: "#E0DBE0",
    close: "rgba(181, 167, 189, 0.1)",
    closeText: "#908B85",
    dot: "rgba(181, 167, 189, 0.15)",
    dotActive: "#B5A7BD",
    hint: "#908B85",
    circle: "#B5A7BD",
  },
};

const HORIZONTAL_MARGIN = Platform.OS === "android" ? 12 : 16;

function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

export function TipCarousel({ babyId, birthDate }: TipCarouselProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { t, i18n } = useTranslation();
  const { unitSystem } = useUnits();
  const { width: screenWidth } = useWindowDimensions();

  const [tips, setTips] = useState<Tip[]>([]);
  const [visible, setVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const flatListRef = useRef<FlatList>(null);
  const birthDateStr = birthDate?.toISOString() ?? "";
  const locale = i18n.language?.split("-")[0] || "en";

  const cardWidth = screenWidth - HORIZONTAL_MARGIN * 2;
  const c = isDark ? COLORS.dark : COLORS.light;

  const renderTipText = useCallback(
    (text: string): string =>
      text.replace(
        /\{\{([^|]+)\|([^}]+)\}\}/g,
        (_, imperial, metric) =>
          unitSystem === "imperial" ? imperial.trim() : metric.trim()
      ),
    [unitSystem]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!babyId || !birthDateStr) {
        setVisible(false);
        return;
      }

      const isEnabled = await getTipsEnabled();
      if (cancelled) return;
      if (!isEnabled) {
        setVisible(false);
        return;
      }

      const today = getTodayString();
      const dismissedDate = await getTipsDismissedDate(babyId);
      if (cancelled) return;
      if (dismissedDate === today) {
        setVisible(false);
        return;
      }

      const bd = new Date(birthDateStr);
      const dailyTips = await selectDailyTips(babyId, bd, new Date(), locale);
      if (cancelled) return;
      if (dailyTips.length === 0) {
        setVisible(false);
        return;
      }

      setTips(dailyTips);
      setVisible(true);
      fadeAnim.setValue(1);
    }

    load();
    return () => { cancelled = true; };
  }, [babyId, birthDateStr, locale, fadeAnim]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !babyId || !birthDateStr) return;

      (async () => {
        const isEnabled = await getTipsEnabled();
        if (!isEnabled) {
          setVisible(false);
          return;
        }
        const today = getTodayString();
        const dismissedDate = await getTipsDismissedDate(babyId);
        if (dismissedDate === today) {
          setVisible(false);
          return;
        }
        const bd = new Date(birthDateStr);
        const dailyTips = await selectDailyTips(babyId, bd, new Date(), locale);
        if (dailyTips.length === 0) {
          setVisible(false);
          return;
        }
        setTips(dailyTips);
        setVisible(true);
        fadeAnim.setValue(1);
      })();
    });
    return () => sub.remove();
  }, [babyId, birthDateStr, locale, fadeAnim]);

  const handleDismiss = useCallback(() => {
    if (!babyId) return;
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setTipsDismissedDate(babyId, getTodayString());
    });
  }, [babyId, fadeAnim]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
      setActiveIndex(index);
    },
    [cardWidth]
  );

  if (!visible || tips.length === 0) {
    return null;
  }

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        marginBottom: Platform.OS === "android" ? 10 : 12,
      }}
    >
      <View
        style={{
          borderRadius: 20,
          overflow: "hidden",
          backgroundColor: c.card,
          borderWidth: 1,
          borderColor: c.border,
        }}
      >
        <FlatList
          ref={flatListRef}
          data={tips}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          snapToInterval={cardWidth}
          decelerationRate="fast"
          renderItem={({ item, index }) => (
            <View
              style={{
                width: cardWidth,
                padding: 16,
                paddingHorizontal: 20,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  top: -25,
                  right: -15,
                  width: 90,
                  height: 90,
                  borderRadius: 45,
                  backgroundColor: c.circle,
                  opacity: 0.06,
                }}
              />

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                  paddingRight: 30,
                }}
              >
                <Text style={{ fontSize: 22 }}>
                  {CATEGORY_ICONS[item.category as TipCategory]}
                </Text>
                <View
                  style={{
                    backgroundColor: c.badge,
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: 20,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: c.accent,
                      letterSpacing: 0.3,
                    }}
                  >
                    {t(CATEGORY_TRANSLATION_KEYS[item.category as TipCategory])}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={handleDismiss}
                style={{
                  position: "absolute",
                  top: 14,
                  right: 14,
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: c.close,
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 2,
                }}
                hitSlop={8}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: c.closeText,
                    lineHeight: 14,
                  }}
                >
                  ✕
                </Text>
              </Pressable>

              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  lineHeight: 14 * 1.55,
                  color: c.text,
                  marginBottom: 12,
                }}
              >
                {renderTipText(item.text)}
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {tips.map((_, i) => (
                    <View
                      key={i}
                      style={{
                        width: i === activeIndex ? 18 : 6,
                        height: 6,
                        borderRadius: i === activeIndex ? 4 : 3,
                        backgroundColor:
                          i === activeIndex ? c.dotActive : c.dot,
                      }}
                    />
                  ))}
                </View>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: c.hint,
                  }}
                >
                  {index < tips.length - 1
                    ? t("tips.swipeForMore")
                    : t("tips.tipCount", {
                        current: tips.length,
                        total: tips.length,
                      })}
                </Text>
              </View>
            </View>
          )}
        />
      </View>
    </Animated.View>
  );
}
