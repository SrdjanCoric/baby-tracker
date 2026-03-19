/**
 * useAccessibility hook
 * Provides React Native accessibility features including announcements,
 * screen reader detection, and reduced motion support
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { AccessibilityInfo, Platform } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import {
  createTimerAnnouncementMessage,
  createSaveSuccessMessage,
  createErrorMessage,
  shouldAnnounce,
} from "@/utils/accessibility";

interface UseAccessibilityReturn {
  isScreenReaderEnabled: boolean;
  reduceMotionEnabled: boolean;
  announce: (message: string) => void;
  announceTimerStart: (activityType: string) => void;
  announceTimerStop: (activityType: string, durationSeconds?: number) => void;
  announceSaveSuccess: (activityType: string) => void;
  announceError: (context?: string) => void;
  setAccessibilityFocus: (nodeHandle: number | null) => void;
}

export function useAccessibility(): UseAccessibilityReturn {
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);
  const reduceMotionEnabled = useReducedMotion();
  const announcementQueueRef = useRef<string[]>([]);
  const isAnnouncingRef = useRef(false);
  const { t } = useTranslation();

  useEffect(() => {
    const checkScreenReader = async () => {
      try {
        const enabled = await AccessibilityInfo.isScreenReaderEnabled();
        setIsScreenReaderEnabled(enabled);
      } catch {
        setIsScreenReaderEnabled(false);
      }
    };

    checkScreenReader();

    const subscription = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      setIsScreenReaderEnabled
    );

    return () => {
      subscription.remove();
    };
  }, []);

  const processAnnouncementQueue = useCallback(() => {
    if (isAnnouncingRef.current || announcementQueueRef.current.length === 0) {
      return;
    }

    isAnnouncingRef.current = true;
    const message = announcementQueueRef.current.shift();

    if (message) {
      try {
        AccessibilityInfo.announceForAccessibility(message);
      } catch {
        // Silently handle announcement failures
      }
    }

    setTimeout(() => {
      isAnnouncingRef.current = false;
      processAnnouncementQueue();
    }, 500);
  }, []);

  const announce = useCallback(
    (message: string) => {
      if (!message || typeof message !== "string") {
        return;
      }

      announcementQueueRef.current.push(message);
      processAnnouncementQueue();
    },
    [processAnnouncementQueue]
  );

  const announceTimerStart = useCallback(
    (activityType: string) => {
      if (!shouldAnnounce("timer_start")) return;
      const message = createTimerAnnouncementMessage(activityType, "start", t);
      announce(message);
    },
    [announce, t]
  );

  const announceTimerStop = useCallback(
    (activityType: string, durationSeconds?: number) => {
      if (!shouldAnnounce("timer_stop")) return;
      const message = createTimerAnnouncementMessage(
        activityType,
        "stop",
        t,
        durationSeconds
      );
      announce(message);
    },
    [announce, t]
  );

  const announceSaveSuccess = useCallback(
    (activityType: string) => {
      if (!shouldAnnounce("save_success")) return;
      const message = createSaveSuccessMessage(activityType, t);
      announce(message);
    },
    [announce, t]
  );

  const announceError = useCallback(
    (errorContext?: string) => {
      if (!shouldAnnounce("error")) return;
      const message = createErrorMessage(t, errorContext);
      announce(message);
    },
    [announce, t]
  );

  const setAccessibilityFocus = useCallback(
    (nodeHandle: number | null) => {
      if (nodeHandle != null && Platform.OS !== "web") {
        try {
          AccessibilityInfo.setAccessibilityFocus(nodeHandle);
        } catch {
          // Silently handle focus failures
        }
      }
    },
    []
  );

  return {
    isScreenReaderEnabled,
    reduceMotionEnabled: reduceMotionEnabled ?? false,
    announce,
    announceTimerStart,
    announceTimerStop,
    announceSaveSuccess,
    announceError,
    setAccessibilityFocus,
  };
}
