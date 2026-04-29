import { useCallback, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { useTranslation } from "react-i18next";

interface SleepPredictionInfoModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

const PAGES = 3;

export function SleepPredictionInfoModal({
  visible,
  onClose,
  onOpenSettings,
}: SleepPredictionInfoModalProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const screenWidth = Dimensions.get("window").width;
  const modalWidth = Math.min(screenWidth - 48, 380);

  const accent = isDark ? "#A68DC8" : "#8B7BA0";
  const textPrimary = isDark ? "rgba(232,224,216,0.87)" : "#2D2A26";
  const textSecondary = isDark ? "rgba(232,224,216,0.85)" : "#7A7570";
  const cardBg = isDark ? "#2A2725" : "#FFFFFF";
  const dotInactive = isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)";

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(e.nativeEvent.contentOffset.x / modalWidth);
      setCurrentPage(page);
    },
    [modalWidth]
  );

  const handleSettingsPress = useCallback(() => {
    onClose();
    setTimeout(onOpenSettings, 300);
  }, [onClose, onOpenSettings]);

  const handleClose = useCallback(() => {
    setCurrentPage(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Backdrop — sits behind modal, tapping it closes */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        {/* Modal card — not nested inside the backdrop Pressable */}
        <View
          style={{
            width: modalWidth,
            backgroundColor: cardBg,
            borderRadius: 20,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: accent }}>
              {t("dashboard.sleepPrediction")}
            </Text>
            <Pressable
              onPress={handleClose}
              hitSlop={12}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: textSecondary }}>✕</Text>
            </Pressable>
          </View>

          {/* Pages */}
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
            style={{ width: modalWidth }}
          >
            {/* Page 1: Settings */}
            <View style={{ width: modalWidth, paddingHorizontal: 20, paddingVertical: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: textPrimary, marginBottom: 12 }}>
                {t("dashboard.infoSettingsTitle")}
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 21, color: textSecondary, marginBottom: 16 }}>
                {t("dashboard.infoSettingsBody")}
              </Text>
              <Pressable
                onPress={handleSettingsPress}
                style={{
                  backgroundColor: accent,
                  borderRadius: 10,
                  paddingVertical: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>
                  {t("dashboard.infoSettingsButton")}
                </Text>
              </Pressable>
            </View>

            {/* Page 2: Missed nap */}
            <View style={{ width: modalWidth, paddingHorizontal: 20, paddingVertical: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: textPrimary, marginBottom: 12 }}>
                {t("dashboard.infoMissedNapTitle")}
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 21, color: textSecondary, marginBottom: 12 }}>
                {t("dashboard.infoMissedNapBody")}
              </Text>
              <View style={{ backgroundColor: isDark ? "rgba(166,141,200,0.08)" : "rgba(139,123,160,0.06)", borderRadius: 10, padding: 14 }}>
                <Text style={{ fontSize: 13, lineHeight: 20, color: textPrimary }}>
                  {t("dashboard.infoMissedNapRetry")}
                </Text>
              </View>
            </View>

            {/* Page 3: How long to try + encouragement */}
            <View style={{ width: modalWidth, paddingHorizontal: 20, paddingVertical: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: textPrimary, marginBottom: 12 }}>
                {t("dashboard.infoHowLongTitle")}
              </Text>
              <View style={{ backgroundColor: isDark ? "rgba(166,141,200,0.08)" : "rgba(139,123,160,0.06)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <Text style={{ fontSize: 13, lineHeight: 20, color: textPrimary }}>
                  {t("dashboard.infoHowLongRetry")}
                </Text>
              </View>
              <Text style={{ fontSize: 14, lineHeight: 21, color: textSecondary }}>
                {t("dashboard.infoEncouragement")}
              </Text>
            </View>
          </ScrollView>

          {/* Pagination dots + page indicator */}
          <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", paddingBottom: 18, paddingTop: 4, gap: 16 }}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {Array.from({ length: PAGES }).map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === currentPage ? 16 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i === currentPage ? accent : dotInactive,
                  }}
                />
              ))}
            </View>
            <Text style={{ fontSize: 11, color: textSecondary, fontWeight: "600" }}>
              {currentPage + 1} / {PAGES}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 24,
  },
});
