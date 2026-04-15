import { useCallback, useEffect, useMemo } from "react";
import { Modal, Pressable, View, Image } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/theme-context";
import type { StoredBabyProfile } from "@/services/baby-storage";

interface BirthdayCelebrationModalProps {
  visible: boolean;
  baby: StoredBabyProfile;
  milestoneAge: { value: number; unit: "month" | "year" };
  onClose: () => void;
}

const BALLOON_COLORS = ["#ffd166", "#f4a5b8", "#5ec6c6", "#c8a8e9"];
const CONFETTI_COLORS = ["#ffd166", "#f4a5b8", "#5ec6c6", "#c8a8e9", "#ffd166"];

function getNameColor(gender?: "male" | "female"): string {
  if (gender === "female") return "#f4a5b8";
  if (gender === "male") return "#6B8DB5";
  return "#C9A55C";
}


interface BalloonProps {
  color: string;
  size: number;
  left: number;
  top: number;
  delay: number;
}

function Balloon({ color, size, left, top, delay }: BalloonProps) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-12, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
    return () => cancelAnimation(translateY);
  }, [translateY, delay]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { rotate: "-3deg" }],
  }));

  const width = size;
  const height = size * 1.25;

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left,
          top,
          width,
          height,
          borderRadius: size,
          backgroundColor: color,
        },
        style,
      ]}
    >
      <View
        style={{
          position: "absolute",
          bottom: -18,
          left: width / 2 - 0.5,
          width: 1,
          height: 18,
          backgroundColor: "#ccc",
        }}
      />
    </Animated.View>
  );
}

interface ConfettiPieceProps {
  color: string;
  startX: number;
  size: number;
  delay: number;
  cardHeight: number;
}

function ConfettiPiece({ color, startX, size, delay, cardHeight }: ConfettiPieceProps) {
  const translateY = useSharedValue(-20);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withTiming(cardHeight + 40, { duration: 2500, easing: Easing.linear }),
        -1,
        false
      )
    );
    rotate.value = withDelay(
      delay,
      withRepeat(
        withTiming(720, { duration: 2500, easing: Easing.linear }),
        -1,
        false
      )
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2000 }),
          withTiming(0, { duration: 500 })
        ),
        -1,
        false
      )
    );
    return () => {
      cancelAnimation(translateY);
      cancelAnimation(rotate);
      cancelAnimation(opacity);
    };
  }, [translateY, rotate, opacity, delay, cardHeight]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: startX,
          top: -10,
          width: size,
          height: size * 1.2,
          borderRadius: 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

export function BirthdayCelebrationModal({
  visible,
  baby,
  milestoneAge,
  onClose,
}: BirthdayCelebrationModalProps) {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const hasPhoto = !!baby.photoUri;
  const nameColor = getNameColor(baby.gender);
  const unitLabel = t(`birthday.${milestoneAge.unit}`, { count: milestoneAge.value });

  const cardScale = useSharedValue(0.8);
  const cardOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      cardScale.value = withSpring(1, { damping: 12, stiffness: 200 });
      cardOpacity.value = withTiming(1, { duration: 300 });
    } else {
      cardScale.value = 0.8;
      cardOpacity.value = 0;
    }
  }, [visible, cardScale, cardOpacity]);

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const nameFontSize = hasPhoto ? 28 : 32;
  const numberFontSize = hasPhoto ? 100 : 120;
  const monthFontSize = hasPhoto ? 32 : 36;
  const oldFontSize = hasPhoto ? 28 : 30;
  const bannerFontSize = hasPhoto ? 13 : 16;
  const bannerPaddingH = hasPhoto ? 22 : 28;
  const bannerPaddingV = hasPhoto ? 6 : 8;

  const confettiPieces = useMemo(() => {
    const pieces: { color: string; x: number; size: number; delay: number }[] = [];
    for (let i = 0; i < 10; i++) {
      pieces.push({
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        x: (i * 32 + 10) % 300,
        size: 6 + (i % 3) * 2,
        delay: i * 250,
      });
    }
    return pieces;
  }, []);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.45)" }}
        onPress={onClose}
      >
        <Animated.View style={[{ width: 320, position: "relative" }, cardAnimStyle]}>
          <Pressable
            style={{
              backgroundColor: isDark ? "#2D2A28" : "#FFFFFF",
              borderRadius: 28,
              padding: 32,
              paddingBottom: 30,
              alignItems: "center",
              overflow: "hidden",
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Balloons */}
            <Balloon color={BALLOON_COLORS[0]} size={40} left={-8} top={20} delay={0} />
            <Balloon color={BALLOON_COLORS[1]} size={40} left={248} top={40} delay={500} />
            <Balloon color={BALLOON_COLORS[2]} size={30} left={20} top={hasPhoto ? 160 : 140} delay={1000} />
            <Balloon color={BALLOON_COLORS[3]} size={34} left={228} top={hasPhoto ? 140 : 120} delay={300} />

            {/* Confetti */}
            {confettiPieces.map((piece, i) => (
              <ConfettiPiece
                key={i}
                color={piece.color}
                startX={piece.x}
                size={piece.size}
                delay={piece.delay}
                cardHeight={hasPhoto ? 420 : 360}
              />
            ))}

            {/* Close button */}
            <Pressable
              onPress={onClose}
              style={{
                position: "absolute",
                top: 14,
                right: 18,
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: isDark ? "#3A363D" : "#f0ece6",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 10,
              }}
              hitSlop={8}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: isDark ? "#9E9A97" : "#999" }}>
                ×
              </Text>
            </Pressable>

            {/* Baby Name */}
            <Text
              style={{
                fontSize: nameFontSize,
                fontWeight: "900",
                color: nameColor,
                letterSpacing: 0.5,
                marginBottom: 12,
                fontFamily: "Nunito-Black",
                zIndex: 2,
              }}
            >
              {baby.name}
            </Text>

            {/* TODAY Banner */}
            <View style={{ marginBottom: hasPhoto ? 14 : 20, zIndex: 2 }}>
              <View
                style={{
                  backgroundColor: "#5ec6c6",
                  paddingHorizontal: bannerPaddingH,
                  paddingVertical: bannerPaddingV,
                  borderRadius: 6,
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontSize: bannerFontSize,
                    fontWeight: "800",
                    letterSpacing: 3,
                    textTransform: "uppercase",
                    fontFamily: "Nunito-ExtraBold",
                  }}
                >
                  {t("birthday.today")}
                </Text>
              </View>
              {/* Banner ribbon tabs */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: -1 }}>
                <View
                  style={{
                    width: 0,
                    height: 0,
                    borderLeftWidth: 6,
                    borderRightWidth: 6,
                    borderTopWidth: 6,
                    borderLeftColor: "transparent",
                    borderRightColor: "transparent",
                    borderTopColor: "#4db0b0",
                  }}
                />
                <View
                  style={{
                    width: 0,
                    height: 0,
                    borderLeftWidth: 6,
                    borderRightWidth: 6,
                    borderTopWidth: 6,
                    borderLeftColor: "transparent",
                    borderRightColor: "transparent",
                    borderTopColor: "#4db0b0",
                  }}
                />
              </View>
            </View>

            {/* Photo (if available) */}
            {hasPhoto && (
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  borderWidth: 3,
                  borderColor: isDark ? "#3A363D" : "#fff",
                  overflow: "hidden",
                  marginBottom: 8,
                  zIndex: 2,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.08,
                  shadowRadius: 12,
                  elevation: 4,
                }}
              >
                <Image
                  source={{ uri: baby.photoUri }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              </View>
            )}

            {/* "I am" */}
            <Text
              style={{
                fontSize: hasPhoto ? 20 : 22,
                fontWeight: "700",
                color: "#7a8599",
                marginTop: hasPhoto ? 10 : 6,
                marginBottom: 4,
                fontFamily: "Nunito-Bold",
                zIndex: 2,
              }}
            >
              {t("birthday.iAm")}
            </Text>

            {/* Big Number */}
            <Text
              style={{
                fontSize: numberFontSize,
                fontWeight: "900",
                color: "#5ec6c6",
                lineHeight: numberFontSize,
                fontFamily: "Nunito-Black",
                zIndex: 2,
              }}
            >
              {milestoneAge.value}
            </Text>

            {/* Month/Year */}
            <Text
              style={{
                fontSize: monthFontSize,
                fontWeight: "900",
                color: "#7ec8c8",
                textTransform: "uppercase",
                letterSpacing: 2,
                lineHeight: monthFontSize * 1.1,
                fontFamily: "Nunito-Black",
                zIndex: 2,
              }}
            >
              {unitLabel}
            </Text>

            {/* Old */}
            <Text
              style={{
                fontSize: oldFontSize,
                fontWeight: "900",
                color: "#a8d8d8",
                textTransform: "uppercase",
                letterSpacing: 2,
                fontFamily: "Nunito-Black",
                zIndex: 2,
              }}
            >
              {t("birthday.old")}
            </Text>

            {/* Decorative leaves */}
            <View
              style={{
                position: "absolute",
                bottom: 40,
                left: -10,
                width: 60,
                height: 30,
                borderTopRightRadius: 30,
                borderBottomRightRadius: 30,
                backgroundColor: "#f4a5b8",
                opacity: 0.15,
                transform: [{ rotate: "-20deg" }],
              }}
            />
            <View
              style={{
                position: "absolute",
                bottom: 30,
                right: -10,
                width: 60,
                height: 30,
                borderTopRightRadius: 30,
                borderBottomRightRadius: 30,
                backgroundColor: "#f4a5b8",
                opacity: 0.15,
                transform: [{ rotate: "200deg" }],
              }}
            />
            <View
              style={{
                position: "absolute",
                bottom: 60,
                right: 10,
                width: 40,
                height: 20,
                borderTopRightRadius: 20,
                borderBottomRightRadius: 20,
                backgroundColor: "#5ec6c6",
                opacity: 0.15,
                transform: [{ rotate: "160deg" }],
              }}
            />
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
