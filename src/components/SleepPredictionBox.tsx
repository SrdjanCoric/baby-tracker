import { memo } from "react";
import { Text, View, Pressable, useColorScheme } from "react-native";
import { useTranslation } from "react-i18next";
import { ACTIVITY } from "@/constants/colors";
import { CONTENT_COLORS } from "@/constants/design-tokens";

type PredictionState =
  | "countdown"
  | "now"
  | "overdue"
  | "noSleepLogged"
  | "building"
  | "allDone"
  | "confirmWake"
  | "hidden";

interface SleepPredictionBoxProps {
  state: PredictionState;
  rangeStart?: string;
  rangeEnd?: string;
  slotLabel?: string;
  countdownText?: string;
  subtitle?: string;
  daysRemaining?: number;
  onConfirmWake?: () => void;
  onDismissWake?: () => void;
}

const OVERDUE_COLOR_LIGHT = "#f59e0b";
const OVERDUE_COLOR_DARK = "#fbbf24";

const PRED_BOX = {
  light: {
    bg: "#F2EFF4",
    bgMuted: "#F9F7FA",
    timeText: "#2D2A26",
    mutedText: "#807A73",
    slotLabel: "#6B5C78",
    mutedMessage: "#807A73",
    promptMessage: "#6B5C78",
  },
  dark: {
    bg: "#363330",
    bgMuted: "#363330",
    timeText: "#FFFFFF",
    mutedText: "#A09B97",
    slotLabel: "#C4B8CC",
    mutedMessage: "#B5A7BD",
    promptMessage: "#B5A7BD",
  },
} as const;

function SleepPredictionBoxInner({
  state,
  rangeStart,
  rangeEnd,
  slotLabel,
  countdownText,
  subtitle,
  daysRemaining,
  onConfirmWake,
  onDismissWake,
}: SleepPredictionBoxProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  if (state === "hidden") return null;

  const accentColor = isDark ? ACTIVITY.sleep.accentDark : ACTIVITY.sleep.accent;
  const pred = isDark ? PRED_BOX.dark : PRED_BOX.light;

  const isMutedState = state === "noSleepLogged" || state === "building" || state === "allDone";
  const isUrgent = state === "now";

  const boxBg = isMutedState ? pred.bgMuted : pred.bg;

  const boxBorderColor = isUrgent
    ? accentColor
    : isMutedState
      ? `${accentColor}1F`
      : isDark ? `${accentColor}40` : `${accentColor}33`;

  if (state === "noSleepLogged") {
    return (
      <View
        style={{
          backgroundColor: boxBg,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 8,
          marginTop: 6,
          borderWidth: 1,
          borderColor: boxBorderColor,
        }}
      >
        <Text
          style={{
            color: pred.promptMessage,
            fontSize: 12,
            fontWeight: "600",
            textAlign: "center",
          }}
        >
          {t("prediction.logSleep")}
        </Text>
      </View>
    );
  }

  if (state === "building") {
    return (
      <View
        style={{
          backgroundColor: boxBg,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 8,
          marginTop: 6,
          borderWidth: 1,
          borderColor: boxBorderColor,
        }}
      >
        <Text
          style={{ color: pred.mutedMessage, fontSize: 12, fontWeight: "600", textAlign: "center" }}
        >
          {t("prediction.building", { days: daysRemaining ?? 3 })}
        </Text>
      </View>
    );
  }

  if (state === "allDone") {
    return (
      <View
        style={{
          backgroundColor: boxBg,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 8,
          marginTop: 6,
          borderWidth: 1,
          borderColor: boxBorderColor,
        }}
      >
        <Text
          style={{ color: pred.mutedMessage, fontSize: 12, fontWeight: "600", textAlign: "center" }}
        >
          {t("prediction.allDone")}
        </Text>
      </View>
    );
  }

  if (state === "confirmWake") {
    return (
      <View
        style={{
          backgroundColor: boxBg,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 8,
          marginTop: 6,
          borderWidth: 1,
          borderColor: boxBorderColor,
        }}
      >
        <Text
          style={{
            color: pred.promptMessage,
            fontSize: 12,
            fontWeight: "600",
            textAlign: "center",
            marginBottom: 6,
          }}
        >
          {t("prediction.upForTheDay")}
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}>
          <Pressable
            onPress={onConfirmWake}
            style={{
              backgroundColor: accentColor,
              borderRadius: 8,
              paddingHorizontal: 14,
              paddingVertical: 5,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>
              {t("prediction.yesUpForDay")}
            </Text>
          </Pressable>
          <Pressable
            onPress={onDismissWake}
            style={{
              backgroundColor: isDark ? "#4A4744" : "#E8E4E0",
              borderRadius: 8,
              paddingHorizontal: 14,
              paddingVertical: 5,
            }}
          >
            <Text style={{ color: isDark ? "#D4D0CC" : "#6B6560", fontSize: 11, fontWeight: "700" }}>
              {t("prediction.noNightFeed")}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const overdueColor = isDark ? OVERDUE_COLOR_DARK : OVERDUE_COLOR_LIGHT;
  const pillBg =
    state === "overdue"
      ? overdueColor
      : state === "now"
        ? accentColor
        : isDark
          ? `${accentColor}30`
          : `${accentColor}20`;
  const pillTextColor =
    state === "overdue"
      ? isDark ? "#1E1B19" : "#FFFFFF"
      : state === "now"
        ? "#FFFFFF"
        : accentColor;

  return (
    <View
      style={{
        backgroundColor: boxBg,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginTop: 6,
        borderWidth: 1,
        borderColor: boxBorderColor,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexShrink: 1 }}>
          {slotLabel && (
            <Text
              style={{
                color: pred.slotLabel,
                fontSize: 10,
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                marginBottom: 2,
              }}
              numberOfLines={1}
            >
              {slotLabel}
            </Text>
          )}
          <Text numberOfLines={1}>
            <Text
              style={{
                color: pred.timeText,
                fontSize: 15,
                fontWeight: "800",
              }}
            >
              {rangeStart}
            </Text>
            <Text
              style={{
                color: pred.mutedText,
                fontSize: 15,
                fontWeight: "500",
              }}
            >
              {" – "}
            </Text>
            <Text
              style={{
                color: pred.timeText,
                fontSize: 15,
                fontWeight: "800",
              }}
            >
              {rangeEnd}
            </Text>
          </Text>
        </View>

        {countdownText && (
          <View
            style={{
              backgroundColor: pillBg,
              borderRadius: 12,
              paddingHorizontal: 8,
              paddingVertical: 3,
              marginLeft: 8,
            }}
          >
            <Text
              style={{
                color: pillTextColor,
                fontSize: 11,
                fontWeight: "700",
              }}
              numberOfLines={1}
            >
              {countdownText}
            </Text>
          </View>
        )}
      </View>

      {subtitle && (
        <Text
          style={{
            color: pred.mutedText,
            fontSize: 10,
            fontStyle: "italic",
            opacity: 0.8,
            marginTop: 3,
          }}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
}

const SleepPredictionBox = memo(SleepPredictionBoxInner);

export { SleepPredictionBox, type SleepPredictionBoxProps, type PredictionState };
