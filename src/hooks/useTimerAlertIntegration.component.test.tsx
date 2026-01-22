jest.unmock("./useTimerAlertIntegration");
jest.unmock("@/contexts/notification-context");

const mockScheduleNotification = jest.fn();
const mockCheckTimerAlert = jest.fn();
const mockGetSettings = jest.fn();
const mockSetupNotificationHandler = jest.fn();
const mockSetupAndroidChannels = jest.fn();
const mockGetPermissionStatus = jest.fn();

const mockDefaultSettings = {
  feedingReminders: {
    enabled: false,
    intervalHours: 3,
  },
  timerAlerts: {
    enabled: true,
    thresholds: {
      breastfeeding: 60,
      pumping: 45,
      tummyTime: 30,
      nap: 180,
      nightSleep: 720,
    },
  },
  quietHours: {
    enabled: false,
    startTime: "22:00",
    endTime: "07:00",
  },
};

jest.mock("@/services/notification-service", () => ({
  NotificationService: {
    scheduleNotification: (content: unknown, time: Date) =>
      mockScheduleNotification(content, time),
    setupNotificationHandler: () => mockSetupNotificationHandler(),
    setupAndroidChannels: () => mockSetupAndroidChannels(),
    getPermissionStatus: () => mockGetPermissionStatus(),
    requestPermissions: jest.fn().mockResolvedValue(true),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
    cancelAllNotifications: jest.fn(),
    getAllScheduledNotifications: jest.fn(),
    getNavigationRoute: jest.fn(),
  },
}));

jest.mock("@/services/notification-storage", () => ({
  NotificationStorageService: {
    getSettings: () => mockGetSettings(),
    saveSettings: jest.fn().mockResolvedValue(undefined),
    getFeedingReminderNotificationId: jest.fn().mockResolvedValue(null),
    saveFeedingReminderNotificationId: jest.fn().mockResolvedValue(undefined),
    clearFeedingReminderNotificationId: jest.fn().mockResolvedValue(undefined),
    clearSettings: jest.fn(),
  },
}));

jest.mock("@/utils/notification-scheduler", () => ({
  calculateNextFeedingReminder: jest.fn(),
  shouldSendTimerAlert: (
    activityType: string,
    duration: number,
    settings: unknown
  ) => mockCheckTimerAlert(activityType, duration, settings),
}));

import React, { useRef, useEffect } from "react";
import { render, screen, act, waitFor, fireEvent } from "@testing-library/react-native";
import { Text, View, Pressable } from "react-native";
import type { TimerThresholds } from "@/types/notifications";

import { NotificationProvider, useNotifications } from "@/contexts/notification-context";
import { useTimerAlertIntegration } from "./useTimerAlertIntegration";

interface TestConsumerProps {
  activityType: keyof TimerThresholds;
  durationToCheck?: number;
  onAlertSent?: (sent: boolean) => void;
}

function TestConsumer({
  activityType,
  durationToCheck,
  onAlertSent,
}: TestConsumerProps) {
  const { isLoading } = useNotifications();
  const { alertSent, timerAlertsEnabled, threshold, checkAndSendAlert, resetAlert } =
    useTimerAlertIntegration(activityType);
  const checkAndSendAlertRef = useRef(checkAndSendAlert);

  useEffect(() => {
    checkAndSendAlertRef.current = checkAndSendAlert;
  }, [checkAndSendAlert]);

  const handleCheck = async () => {
    if (durationToCheck !== undefined) {
      const sent = await checkAndSendAlertRef.current(durationToCheck);
      onAlertSent?.(sent);
    }
  };

  return (
    <View>
      <Text testID="loading">{isLoading ? "loading" : "ready"}</Text>
      <Text testID="alert-sent">{alertSent ? "true" : "false"}</Text>
      <Text testID="timer-alerts-enabled">
        {timerAlertsEnabled ? "true" : "false"}
      </Text>
      <Text testID="threshold">{threshold}</Text>
      <Pressable testID="check-button" onPress={handleCheck}>
        <Text>Check</Text>
      </Pressable>
      <Pressable testID="reset-button" onPress={resetAlert}>
        <Text>Reset</Text>
      </Pressable>
    </View>
  );
}

function renderWithProvider(props: TestConsumerProps) {
  return render(
    <NotificationProvider>
      <TestConsumer {...props} />
    </NotificationProvider>
  );
}

describe("useTimerAlertIntegration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockScheduleNotification.mockResolvedValue("test-notification-id");
    mockCheckTimerAlert.mockReturnValue(false);
    mockGetSettings.mockResolvedValue(mockDefaultSettings);
    mockSetupAndroidChannels.mockResolvedValue(undefined);
    mockGetPermissionStatus.mockResolvedValue("granted");
  });

  describe("initialization", () => {
    it("should return alertSent as false initially", async () => {
      renderWithProvider({ activityType: "breastfeeding" });

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      expect(screen.getByTestId("alert-sent").props.children).toBe("false");
    });

    it("should return timerAlertsEnabled based on settings", async () => {
      renderWithProvider({ activityType: "breastfeeding" });

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      expect(screen.getByTestId("timer-alerts-enabled").props.children).toBe("true");
    });

    it("should return correct threshold for breastfeeding", async () => {
      renderWithProvider({ activityType: "breastfeeding" });

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      expect(screen.getByTestId("threshold").props.children).toBe(60);
    });

    it("should return correct threshold for pumping", async () => {
      renderWithProvider({ activityType: "pumping" });

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      expect(screen.getByTestId("threshold").props.children).toBe(45);
    });

    it("should return correct threshold for tummyTime", async () => {
      renderWithProvider({ activityType: "tummyTime" });

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      expect(screen.getByTestId("threshold").props.children).toBe(30);
    });

    it("should return correct threshold for nap", async () => {
      renderWithProvider({ activityType: "nap" });

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      expect(screen.getByTestId("threshold").props.children).toBe(180);
    });

    it("should return correct threshold for nightSleep", async () => {
      renderWithProvider({ activityType: "nightSleep" });

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      expect(screen.getByTestId("threshold").props.children).toBe(720);
    });
  });

  describe("checkAndSendAlert", () => {
    it("should send alert when duration exceeds threshold", async () => {
      mockCheckTimerAlert.mockReturnValue(true);

      renderWithProvider({
        activityType: "breastfeeding",
        durationToCheck: 61,
      });

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      await act(async () => {
        fireEvent.press(screen.getByTestId("check-button"));
      });

      await waitFor(() => {
        expect(mockScheduleNotification).toHaveBeenCalled();
        expect(screen.getByTestId("alert-sent").props.children).toBe("true");
      });
    });

    it("should not send alert when duration is under threshold", async () => {
      mockCheckTimerAlert.mockReturnValue(false);

      renderWithProvider({
        activityType: "breastfeeding",
        durationToCheck: 30,
      });

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      await act(async () => {
        fireEvent.press(screen.getByTestId("check-button"));
      });

      await waitFor(() => {
        expect(mockScheduleNotification).not.toHaveBeenCalled();
        expect(screen.getByTestId("alert-sent").props.children).toBe("false");
      });
    });

    it("should not send alert if already sent for this session", async () => {
      mockCheckTimerAlert.mockReturnValue(true);

      renderWithProvider({
        activityType: "breastfeeding",
        durationToCheck: 61,
      });

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      await act(async () => {
        fireEvent.press(screen.getByTestId("check-button"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("alert-sent").props.children).toBe("true");
      });

      jest.clearAllMocks();

      await act(async () => {
        fireEvent.press(screen.getByTestId("check-button"));
      });

      expect(mockScheduleNotification).not.toHaveBeenCalled();
    });

    it("should include correct notification data for breastfeeding", async () => {
      mockCheckTimerAlert.mockReturnValue(true);

      renderWithProvider({
        activityType: "breastfeeding",
        durationToCheck: 61,
      });

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      await act(async () => {
        fireEvent.press(screen.getByTestId("check-button"));
      });

      await waitFor(() => {
        expect(mockScheduleNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Breastfeeding Timer",
            body: expect.any(String),
            data: expect.objectContaining({
              type: "timer_alert",
              activityType: "breastfeeding",
            }),
          }),
          expect.any(Date)
        );
      });
    });

    it("should include correct notification data for nap", async () => {
      mockCheckTimerAlert.mockReturnValue(true);

      renderWithProvider({
        activityType: "nap",
        durationToCheck: 181,
      });

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      await act(async () => {
        fireEvent.press(screen.getByTestId("check-button"));
      });

      await waitFor(() => {
        expect(mockScheduleNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Nap Timer",
            data: expect.objectContaining({
              type: "timer_alert",
              activityType: "nap",
            }),
          }),
          expect.any(Date)
        );
      });
    });
  });

  describe("resetAlert", () => {
    it("should reset alertSent to false", async () => {
      mockCheckTimerAlert.mockReturnValue(true);

      renderWithProvider({
        activityType: "breastfeeding",
        durationToCheck: 61,
      });

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      await act(async () => {
        fireEvent.press(screen.getByTestId("check-button"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("alert-sent").props.children).toBe("true");
      });

      await act(async () => {
        fireEvent.press(screen.getByTestId("reset-button"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("alert-sent").props.children).toBe("false");
      });
    });

    it("should allow sending a new alert after reset", async () => {
      mockCheckTimerAlert.mockReturnValue(true);

      renderWithProvider({
        activityType: "breastfeeding",
        durationToCheck: 61,
      });

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      await act(async () => {
        fireEvent.press(screen.getByTestId("check-button"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("alert-sent").props.children).toBe("true");
      });

      await act(async () => {
        fireEvent.press(screen.getByTestId("reset-button"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("alert-sent").props.children).toBe("false");
      });

      jest.clearAllMocks();

      await act(async () => {
        fireEvent.press(screen.getByTestId("check-button"));
      });

      await waitFor(() => {
        expect(mockScheduleNotification).toHaveBeenCalled();
        expect(screen.getByTestId("alert-sent").props.children).toBe("true");
      });
    });
  });
});
