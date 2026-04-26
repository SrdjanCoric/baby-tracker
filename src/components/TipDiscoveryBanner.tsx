import { useCallback, useRef } from "react";
import { Animated, Platform, Pressable, Text, View } from "react-native";
import { useColorScheme } from "nativewind";
import { useTranslation } from "react-i18next";

interface TipDiscoveryBannerProps {
  babyName: string;
  onEnable: () => void;
  onDismiss: () => void;
}

const COLORS = {
  light: {
    card: "#FEF7F4",
    border: "#F0E5DF",
    accent: "#8B5E2A",
    badge: "rgba(212, 165, 116, 0.12)",
    text: "#2D2A26",
    close: "rgba(212, 165, 116, 0.08)",
    closeText: "#857F78",
    circle: "#D4A574",
    buttonBg: "#D4A574",
    buttonBorder: "#C4955F",
    buttonText: "#FFFFFF",
  },
  dark: {
    card: "#322E2B",
    border: "rgba(255, 255, 255, 0.05)",
    accent: "#B5A7BD",
    badge: "rgba(181, 167, 189, 0.12)",
    text: "#E0DBE0",
    close: "rgba(181, 167, 189, 0.1)",
    closeText: "#908B85",
    circle: "#B5A7BD",
    buttonBg: "#B5A7BD",
    buttonBorder: "#9A8BA3",
    buttonText: "#1A1816",
  },
};

export function TipDiscoveryBanner({ babyName, onEnable, onDismiss }: TipDiscoveryBannerProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { t } = useTranslation();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const c = isDark ? COLORS.dark : COLORS.light;

  const animateOut = useCallback((callback: () => void) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(callback);
  }, [fadeAnim]);

  const handleEnable = useCallback(() => {
    animateOut(onEnable);
  }, [animateOut, onEnable]);

  const handleDismiss = useCallback(() => {
    animateOut(onDismiss);
  }, [animateOut, onDismiss]);

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
          padding: 16,
          paddingHorizontal: 20,
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

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
            paddingRight: 30,
          }}
        >
          <Text style={{ fontSize: 22 }}>💡</Text>
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
              {t("settings.dailyTips").toUpperCase()}
            </Text>
          </View>
        </View>

        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            lineHeight: 14 * 1.55,
            color: c.text,
            marginBottom: 14,
          }}
        >
          {t("tips.discoveryMessage", { babyName })}
        </Text>

        <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
          <Pressable
            onPress={handleEnable}
            className="active:opacity-80"
          >
            <View
              style={{
                backgroundColor: c.buttonBg,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: c.buttonBorder,
                paddingHorizontal: 18,
                paddingVertical: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: c.buttonText,
                  letterSpacing: 0.2,
                }}
              >
                {t("tips.discoveryEnable")}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}
