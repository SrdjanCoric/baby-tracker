import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";

const mockPush = jest.fn();
const mockDismissPredictionBanner = jest.fn();
const mockSetDayNightBoundary = jest.fn().mockResolvedValue(undefined);
const mockDismissDrift = jest.fn();
const mockAcceptDrift = jest.fn();
const mockGetCompletedNapsSinceNightSleep = jest.fn().mockReturnValue([]);
const mockGetLastSleep = jest.fn().mockReturnValue(null);

let mockUseSleepReturn: Record<string, unknown> = {};
let mockUseBabyReturn: Record<string, unknown> = {};
let mockUseActiveTimersReturn: Record<string, unknown> = {};
let mockIsUnderTwoMonths = false;
const mockGetLockForActivity = jest.fn().mockReturnValue(null);

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
  }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "dashboard.sleepPrediction": "Sleep prediction",
        "dashboard.startAt2Months": "Sleep predictions start at 2 months",
        "dashboard.manualWakeWindows": "Set manual wake windows",
        "dashboard.setupTitle": "Set up sleep predictions",
        "dashboard.setupDescription": "Set your baby's typical day start and bedtime to enable predictions",
        "dashboard.setupButton": "Set up",
        "dashboard.setupSave": "Save",
        "dashboard.dayStartLabel": "Day starts",
        "dashboard.dayEndLabel": "Bedtime",
        "dashboard.trackSleep": "Track sleep so we can predict nap times",
        "dashboard.computing": `Predicting sleep patterns for ${options?.name || ""}`,
        "dashboard.computingGeneric": "Predicting sleep patterns",
        "dashboard.isSleeping": `${options?.name || ""} is sleeping`,
        "dashboard.isSleepingGeneric": "Baby is sleeping",
        "dashboard.bedtime": "Bedtime",
        "dashboard.nighttime": "Nighttime",
        "dashboard.napTimeNear": "Nap time near",
        "dashboard.bedtimeNear": "Bedtime near",
        "dashboard.napTimeAgo": `Nap time ${options?.time || ""} ago`,
        "dashboard.predictionInfo": "About predictions",
        "dashboard.predictionInfoDetail": `Predictions are based on ${options?.name || ""}'s recent sleep patterns.`,
        "dashboard.predictionInfoDetailGeneric": "Predictions are based on recent sleep patterns.",
        "dashboard.napDayCount": `${options?.count || 0}-nap day`,
        "common.durationHM": `${options?.h || 0}h ${options?.m || 0}m`,
        "common.durationH": `${options?.h || 0}h`,
        "common.durationM": `${options?.m || 0}m`,
        "dashboard.driftBedtimeTitle": "Bedtime seems earlier",
        "dashboard.driftBedtimeBody": `Over the last 5 days, bedtime has been around ${options?.time || ""}`,
        "dashboard.driftBedtimeUpdate": `Update to ${options?.time || ""}`,
        "dashboard.driftBedtimeKeep": `Keep ${options?.time || ""}`,
        "dashboard.driftMorningTitle": "Morning seems earlier",
        "dashboard.driftMorningBody": `Over the last 5 days, the morning routine has been starting around ${options?.time || ""}`,
        "dashboard.driftMorningUpdate": `Update to ${options?.time || ""}`,
        "dashboard.driftMorningKeep": `Keep ${options?.time || ""}`,
      };

      if (key === "dashboard.ageBasedNote") {
        const count = options?.count ?? 0;
        return `Based on age guidelines — ${count} more day${Number(count) !== 1 ? "s" : ""} until personalized`;
      }

      return translations[key] || key;
    },
  }),
}));

jest.mock("@/contexts", () => ({
  useSleep: () => mockUseSleepReturn,
  useBaby: () => mockUseBabyReturn,
}));

jest.mock("@/utils/sleepGoals", () => ({
  isUnderTwoMonths: () => mockIsUnderTwoMonths,
}));

const mockPredictNextSleep = jest.fn().mockReturnValue(null);
const mockGetQualifyingNightSleep = jest.fn().mockReturnValue(null);
const mockGetMorningThreshold = jest.fn().mockImplementation((dayStartHour: number) => dayStartHour - 3 - 3 / 60);

jest.mock("@/utils/sleepPredictions", () => {
  const actual = jest.requireActual("@/utils/sleepPredictions");
  return {
    ...actual,
    predictNextSleep: (...args: unknown[]) => mockPredictNextSleep(...args),
    getQualifyingNightSleep: (...args: unknown[]) => mockGetQualifyingNightSleep(...args),
    getMorningThreshold: (...args: unknown[]) => mockGetMorningThreshold(...args),
  };
});

jest.mock("@/services/sleep-storage", () => ({
  SleepStorageService: {
    getSelectedNapCount: jest.fn().mockResolvedValue(null),
    setSelectedNapCount: jest.fn().mockResolvedValue(undefined),
    clearSelectedNapCount: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("@/contexts/active-timers-context", () => ({
  useActiveTimers: () => mockUseActiveTimersReturn,
}));

jest.mock("@/contexts/time-format-context", () => ({
  useTimeFormat: () => ({ timeFormat: "12h" }),
}));

jest.mock("@react-native-community/datetimepicker", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => <View testID="datetime-picker" {...props} />,
  };
});

import { SleepPredictionCard } from "./SleepPredictionCard";

const defaultSleepContext = () => ({
  sleepPredictionModel: null,
  isComputingModel: false,
  activeTimer: null,
  sleeps: [],
  wakeWindowConfig: { dayStartHour: 7, dayEndHour: 19, dayBoundariesConfigured: true },
  qualifyingDayCount: 0,
  predictionBannerDismissed: false,
  getCompletedNapsSinceNightSleep: mockGetCompletedNapsSinceNightSleep,
  getLastSleep: mockGetLastSleep,
  dismissPredictionBanner: mockDismissPredictionBanner,
  setDayNightBoundary: mockSetDayNightBoundary,
  driftDetection: null,
  dismissDrift: mockDismissDrift,
  acceptDrift: mockAcceptDrift,
});

const defaultBabyContext = () => ({
  selectedBaby: { id: "baby-1", name: "Sofija", birthDate: "2025-06-15" },
});

const defaultActiveTimersContext = () => ({
  getLockForActivity: mockGetLockForActivity,
  locks: [],
  isLoading: false,
  removeLock: jest.fn(),
  isLockedByOther: jest.fn().mockReturnValue(false),
  getLockedByName: jest.fn().mockReturnValue(null),
  refreshLocks: jest.fn(),
});

const makeNightSleep = (endedAt: Date) => ({
  id: "night-1",
  babyId: "baby-1",
  type: "night",
  startedAt: new Date(endedAt.getTime() - 8 * 60 * 60 * 1000).toISOString(),
  endedAt: endedAt.toISOString(),
  durationSeconds: 8 * 60 * 60,
});

const makeNapSleep = (startedAt: Date, durationMin: number) => ({
  id: `nap-${startedAt.getTime()}`,
  babyId: "baby-1",
  type: "nap",
  startedAt: startedAt.toISOString(),
  endedAt: new Date(startedAt.getTime() + durationMin * 60 * 1000).toISOString(),
  durationSeconds: durationMin * 60,
});

const makeModel = (overrides: Record<string, unknown> = {}) => ({
  primaryNapCount: 2,
  secondaryNapCount: null,
  startRelativeWakeWindows: { "0": 120, "1": 150 },
  penultimateWakeWindow: 150,
  bedtimeWakeWindow: 180,
  medianNapDuration: 45,
  napCountDistribution: { 2: 5 },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 3, 27, 10, 0, 0));
  mockIsUnderTwoMonths = false;
  mockUseSleepReturn = defaultSleepContext();
  mockUseBabyReturn = defaultBabyContext();
  mockUseActiveTimersReturn = defaultActiveTimersContext();
  mockGetLockForActivity.mockReturnValue(null);
  mockPredictNextSleep.mockReturnValue(null);
  mockGetQualifyingNightSleep.mockReturnValue(null);
  mockGetMorningThreshold.mockImplementation((dayStartHour: number) => dayStartHour - 3 - 3 / 60);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("SleepPredictionCard", () => {
  describe("State 0: Under two months", () => {
    beforeEach(() => {
      mockIsUnderTwoMonths = true;
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        predictionBannerDismissed: false,
      };
    });

    it("shows under-2-months banner", () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Sleep predictions start at 2 months")).toBeTruthy();
    });

    it("shows manual wake windows link", () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Set manual wake windows")).toBeTruthy();
    });

    it("dismiss hides the banner permanently", () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      const dismissButton = screen.getByText("✕");
      fireEvent.press(dismissButton);
      expect(mockDismissPredictionBanner).toHaveBeenCalled();
    });

    it("does not show banner when already dismissed", () => {
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        predictionBannerDismissed: true,
      };
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.queryByText("Sleep predictions start at 2 months")).toBeNull();
    });
  });

  describe("State 1: Setup required", () => {
    beforeEach(() => {
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        wakeWindowConfig: { dayStartHour: undefined, dayEndHour: undefined },
      };
    });

    it("shows setup prompt when boundaries not set", () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Set up sleep predictions")).toBeTruthy();
      expect(screen.getByText("Set up")).toBeTruthy();
    });

    it("shows time pickers when setup button pressed", () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      fireEvent.press(screen.getByText("Set up"));
      expect(screen.getByText("Day starts")).toBeTruthy();
      expect(screen.getByText("Bedtime")).toBeTruthy();
      expect(screen.getByText("Save")).toBeTruthy();
    });

    it("calls setDayNightBoundary on save", async () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      fireEvent.press(screen.getByText("Set up"));
      fireEvent.press(screen.getByText("Save"));
      expect(mockSetDayNightBoundary).toHaveBeenCalled();
    });
  });

  describe("State 2: Need more data", () => {
    beforeEach(() => {
      const morningSleep = makeNightSleep(new Date(2026, 3, 27, 7, 0, 0));
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        sleeps: [morningSleep],
        qualifyingDayCount: 2,
        sleepPredictionModel: makeModel(),
      };
      mockGetQualifyingNightSleep.mockReturnValue(morningSleep);
      mockGetLastSleep.mockReturnValue(morningSleep);
    });

    it("shows age-based predictions with progress", () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText(/Based on age guidelines — 3 more days until personalized/)).toBeTruthy();
    });

    it("shows link to manual wake windows", () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Set manual wake windows")).toBeTruthy();
    });
  });

  describe("State 3: Track sleep", () => {
    beforeEach(() => {
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        qualifyingDayCount: 10,
        sleepPredictionModel: makeModel(),
      };
      mockGetQualifyingNightSleep.mockReturnValue(null);
    });

    it("shows track sleep message when no night sleep", () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Track sleep so we can predict nap times")).toBeTruthy();
    });
  });

  describe("State 4: Computing", () => {
    beforeEach(() => {
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        isComputingModel: true,
      };
    });

    it("shows computing/loading with baby name", () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Predicting sleep patterns for Sofija")).toBeTruthy();
    });

    it("shows generic computing text without baby name", () => {
      render(<SleepPredictionCard />);
      expect(screen.getByText("Predicting sleep patterns")).toBeTruthy();
    });
  });

  describe("State 5: Prediction", () => {
    const now = new Date(2026, 3, 27, 10, 0, 0);
    const futureTime = new Date(now.getTime() + 30 * 60 * 1000);
    const nightSleepEnd = new Date(2026, 3, 27, 7, 0, 0);
    const napEnd = new Date(now.getTime() - 60 * 60 * 1000);

    beforeEach(() => {
      const sleeps = [
        makeNightSleep(nightSleepEnd),
        makeNapSleep(new Date(napEnd.getTime() - 45 * 60 * 1000), 45),
      ];
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        sleeps,
        qualifyingDayCount: 10,
        sleepPredictionModel: makeModel(),
      };
      mockGetQualifyingNightSleep.mockReturnValue({ endedAt: nightSleepEnd });
      mockGetLastSleep.mockReturnValue({ endedAt: napEnd });
      mockPredictNextSleep.mockReturnValue({
        predictedTime: futureTime,
        type: "nap",
      });
    });

    it("shows prediction with nap time near", async () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      await act(async () => {});
      expect(screen.getByText(/Nap time near/)).toBeTruthy();
    });

    it("shows predicted time", async () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      await act(async () => {});
      expect(screen.getByText(/10:30/)).toBeTruthy();
    });

    it("shows info button with accessibility label", async () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      await act(async () => {});
      expect(screen.getByLabelText("About predictions")).toBeTruthy();
    });
  });

  describe("State 6: Overdue", () => {
    const nightSleepEnd = new Date(2026, 3, 27, 7, 0, 0);
    const lastNapEnd = new Date(Date.now() - 3 * 60 * 60 * 1000);

    beforeEach(() => {
      const pastTime = new Date(Date.now() - 15 * 60 * 1000);
      const sleeps = [
        makeNightSleep(nightSleepEnd),
        makeNapSleep(new Date(lastNapEnd.getTime() - 45 * 60 * 1000), 45),
      ];
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        sleeps,
        qualifyingDayCount: 10,
        sleepPredictionModel: makeModel(),
      };
      mockGetQualifyingNightSleep.mockReturnValue({ endedAt: nightSleepEnd });
      mockGetLastSleep.mockReturnValue({ endedAt: lastNapEnd });
      mockPredictNextSleep.mockReturnValue({
        predictedTime: pastTime,
        type: "nap",
      });
    });

    it("shows overdue nap time ago message", async () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      await act(async () => {});
      expect(screen.getByText(/Nap time.*ago/)).toBeTruthy();
    });

  });

  describe("State 7: Sleeping nap (with elapsed time)", () => {
    beforeEach(() => {
      const now = new Date(2026, 3, 27, 10, 0, 0);
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        activeTimer: {
          isRunning: true,
          isPaused: false,
          startTime: new Date(now.getTime() - 25 * 60 * 1000),
          sleepType: "nap",
          totalPausedMs: 0,
        },
      };
    });

    it("shows baby is sleeping with name", () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Sofija is sleeping")).toBeTruthy();
    });

    it("shows generic sleeping without name", () => {
      render(<SleepPredictionCard />);
      expect(screen.getByText("Baby is sleeping")).toBeTruthy();
    });

    it("shows sleeping state for nap (no elapsed time shown)", () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Sofija is sleeping")).toBeTruthy();
      expect(screen.queryByText(/\d+h|\d+m/)).toBeNull();
    });
  });

  describe("State 8: Bedtime prediction", () => {
    const nightSleepEnd = new Date(2026, 3, 27, 7, 0, 0);
    const lastNapEnd = new Date(Date.now() - 60 * 60 * 1000);

    beforeEach(() => {
      const futureTime = new Date(Date.now() + 60 * 60 * 1000);
      const sleeps = [
        makeNightSleep(nightSleepEnd),
        makeNapSleep(new Date(lastNapEnd.getTime() - 45 * 60 * 1000), 45),
      ];
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        sleeps,
        qualifyingDayCount: 10,
        sleepPredictionModel: makeModel(),
      };
      mockGetQualifyingNightSleep.mockReturnValue({ endedAt: nightSleepEnd });
      mockGetLastSleep.mockReturnValue({ endedAt: lastNapEnd });
      mockPredictNextSleep.mockReturnValue({
        predictedTime: futureTime,
        type: "bedtime",
      });
    });

    it("shows bedtime near with time", async () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      await act(async () => {});
      expect(screen.getByText(/Bedtime near/)).toBeTruthy();
    });
  });

  describe("State 9: Nighttime (calm label)", () => {
    it("shows bedtime label in evening", () => {
      jest.setSystemTime(new Date(2026, 3, 27, 20, 0, 0));
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        wakeWindowConfig: { dayStartHour: 7, dayEndHour: 19, dayBoundariesConfigured: true },
      };

      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Bedtime")).toBeTruthy();
    });

    it("shows nighttime label in early morning", () => {
      jest.setSystemTime(new Date(2026, 3, 27, 3, 0, 0));
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        wakeWindowConfig: { dayStartHour: 7, dayEndHour: 19, dayBoundariesConfigured: true },
      };

      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Nighttime")).toBeTruthy();
    });
  });

  describe("State 9b: Sleeping night (no elapsed time)", () => {
    beforeEach(() => {
      const now = new Date(2026, 3, 27, 10, 0, 0);
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        activeTimer: {
          isRunning: true,
          isPaused: false,
          startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          sleepType: "night",
          totalPausedMs: 0,
        },
      };
    });

    it("shows sleeping without elapsed time for night sleep", () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Sofija is sleeping")).toBeTruthy();
    });

    it("does not show elapsed time for night sleep", () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Sofija is sleeping")).toBeTruthy();
      expect(screen.queryByText(/\d+h|\d+m/)).toBeNull();
    });
  });

  describe("State 10: Bedtime drift prompt", () => {
    beforeEach(() => {
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        qualifyingDayCount: 10,
        sleepPredictionModel: makeModel(),
        driftDetection: {
          type: "bedtime",
          suggestedHour: 18.5,
          currentHour: 19,
        },
      };
      mockGetQualifyingNightSleep.mockReturnValue({ endedAt: new Date() });
      mockGetLastSleep.mockReturnValue({ endedAt: new Date(Date.now() - 60 * 60 * 1000) });
      mockPredictNextSleep.mockReturnValue({
        predictedTime: new Date(Date.now() + 30 * 60 * 1000),
        type: "nap",
      });
    });

    it("shows bedtime drift prompt", async () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      await act(async () => {});
      expect(screen.getByText("Bedtime seems earlier")).toBeTruthy();
    });

    it("shows update and keep buttons", async () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      await act(async () => {});
      expect(screen.getByText(/Update to/)).toBeTruthy();
      expect(screen.getByText(/Keep/)).toBeTruthy();
    });

    it("calls acceptDrift on update press", async () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      await act(async () => {});
      fireEvent.press(screen.getByText(/Update to/));
      expect(mockAcceptDrift).toHaveBeenCalled();
    });

    it("calls dismissDrift on keep press", async () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      await act(async () => {});
      fireEvent.press(screen.getByText(/Keep/));
      expect(mockDismissDrift).toHaveBeenCalled();
    });
  });

  describe("State 11: Morning drift prompt", () => {
    beforeEach(() => {
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        qualifyingDayCount: 10,
        sleepPredictionModel: makeModel(),
        driftDetection: {
          type: "morning",
          suggestedHour: 6,
          currentHour: 7,
        },
      };
      mockGetQualifyingNightSleep.mockReturnValue({ endedAt: new Date() });
      mockGetLastSleep.mockReturnValue({ endedAt: new Date(Date.now() - 60 * 60 * 1000) });
      mockPredictNextSleep.mockReturnValue({
        predictedTime: new Date(Date.now() + 30 * 60 * 1000),
        type: "nap",
      });
    });

    it("shows morning drift prompt", async () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      await act(async () => {});
      expect(screen.getByText("Morning seems earlier")).toBeTruthy();
    });

    it("shows update and keep buttons for morning drift", async () => {
      render(<SleepPredictionCard babyName="Sofija" />);
      await act(async () => {});
      expect(screen.getByText(/Update to/)).toBeTruthy();
      expect(screen.getByText(/Keep/)).toBeTruthy();
    });
  });

  describe("State priority order", () => {
    it("age gate takes priority over setup required", () => {
      mockIsUnderTwoMonths = true;
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        predictionBannerDismissed: false,
        wakeWindowConfig: { dayStartHour: undefined, dayEndHour: undefined },
      };
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Sleep predictions start at 2 months")).toBeTruthy();
      expect(screen.queryByText("Set up sleep predictions")).toBeNull();
    });

    it("setup required takes priority over need more data", () => {
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        wakeWindowConfig: { dayStartHour: undefined, dayEndHour: undefined },
        qualifyingDayCount: 2,
      };
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Set up sleep predictions")).toBeTruthy();
      expect(screen.queryByText(/Based on age guidelines/)).toBeNull();
    });

    it("computing takes priority over prediction", () => {
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        isComputingModel: true,
        qualifyingDayCount: 10,
        sleepPredictionModel: makeModel(),
      };
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Predicting sleep patterns for Sofija")).toBeTruthy();
    });

    it("sleeping takes priority over nighttime/prediction", () => {
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        activeTimer: {
          isRunning: true,
          isPaused: false,
          startTime: new Date(Date.now() - 10 * 60 * 1000),
          sleepType: "nap",
          totalPausedMs: 0,
        },
        qualifyingDayCount: 10,
        sleepPredictionModel: makeModel(),
      };
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Sofija is sleeping")).toBeTruthy();
    });
  });

  describe("Integration: model recomputes on remote mutations", () => {
    it("shows computing state when model is recomputing", () => {
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        isComputingModel: true,
        sleepPredictionModel: null,
      };

      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Predicting sleep patterns for Sofija")).toBeTruthy();
    });

    it("shows prediction after model finishes computing", async () => {
      const nightSleepEnd = new Date(2026, 3, 27, 7, 0, 0);
      const lastNapEnd = new Date(Date.now() - 60 * 60 * 1000);
      const futureTime = new Date(Date.now() + 30 * 60 * 1000);
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        sleeps: [
          makeNightSleep(nightSleepEnd),
          makeNapSleep(new Date(lastNapEnd.getTime() - 45 * 60 * 1000), 45),
        ],
        qualifyingDayCount: 10,
        sleepPredictionModel: makeModel(),
        isComputingModel: false,
      };
      mockGetQualifyingNightSleep.mockReturnValue({ endedAt: nightSleepEnd });
      mockGetLastSleep.mockReturnValue({ endedAt: lastNapEnd });
      mockPredictNextSleep.mockReturnValue({
        predictedTime: futureTime,
        type: "nap",
      });

      render(<SleepPredictionCard babyName="Sofija" />);
      await act(async () => {});
      expect(screen.getByText(/Nap time near/)).toBeTruthy();
    });
  });

  describe("Loading and no-baby states", () => {
    it("shows loading when no baby selected", () => {
      mockUseBabyReturn = { selectedBaby: null };
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.queryByText("Track sleep so we can predict nap times")).toBeNull();
      expect(screen.queryByText("Sofija is sleeping")).toBeNull();
    });

    it("shows no_birthdate state when baby has no birth date", () => {
      mockUseBabyReturn = { selectedBaby: { id: "baby-1", name: "Sofija", birthDate: undefined } };
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.queryByText("Set up sleep predictions")).toBeNull();
      expect(screen.queryByText("Track sleep so we can predict nap times")).toBeNull();
    });
  });

  describe("Remote lock → sleeping state", () => {
    it("shows sleeping when remote lock exists and no local timer", () => {
      mockGetLockForActivity.mockReturnValue({
        id: "lock-1",
        babyId: "baby-1",
        activityType: "sleep",
        startedBy: "other-user",
        startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        timerData: { type: "nap" },
      });
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        activeTimer: null,
      };
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Sofija is sleeping")).toBeTruthy();
    });

    it("local timer takes priority over remote lock", () => {
      mockGetLockForActivity.mockReturnValue({
        id: "lock-1",
        babyId: "baby-1",
        activityType: "sleep",
        startedBy: "other-user",
        startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        timerData: { type: "night" },
      });
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        activeTimer: {
          isRunning: true,
          isPaused: false,
          startTime: new Date(Date.now() - 10 * 60 * 1000),
          sleepType: "nap",
          totalPausedMs: 0,
        },
      };
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Sofija is sleeping")).toBeTruthy();
    });

    it("does not show sleeping when remote lock is cleared", () => {
      mockGetLockForActivity.mockReturnValue(null);
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        activeTimer: null,
      };
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.queryByText("Sofija is sleeping")).toBeNull();
    });
  });

  describe("Timer stop transition", () => {
    it("shows track_sleep (not sleeping) when timer stops and no remote lock", () => {
      mockGetLockForActivity.mockReturnValue(null);
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        activeTimer: null,
        qualifyingDayCount: 10,
        sleepPredictionModel: makeModel(),
      };
      mockGetQualifyingNightSleep.mockReturnValue(null);
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.queryByText("Sofija is sleeping")).toBeNull();
      expect(screen.getByText("Track sleep so we can predict nap times")).toBeTruthy();
    });

    it("shows sleeping when timer stops but remote lock still present", () => {
      mockGetLockForActivity.mockReturnValue({
        id: "lock-1",
        babyId: "baby-1",
        activityType: "sleep",
        startedBy: "other-user",
        startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        timerData: { type: "nap" },
      });
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        activeTimer: null,
      };
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Sofija is sleeping")).toBeTruthy();
    });

    it("shows prediction after stop when night sleep exists and model ready", async () => {
      const nightSleepEnd = new Date(2026, 3, 27, 7, 0, 0);
      const napEnd = new Date(Date.now() - 60 * 60 * 1000);
      const futureTime = new Date(Date.now() + 30 * 60 * 1000);
      mockGetLockForActivity.mockReturnValue(null);
      const sleeps = [
        makeNightSleep(nightSleepEnd),
        makeNapSleep(new Date(napEnd.getTime() - 45 * 60 * 1000), 45),
      ];
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        sleeps,
        activeTimer: null,
        qualifyingDayCount: 10,
        sleepPredictionModel: makeModel(),
      };
      mockGetQualifyingNightSleep.mockReturnValue({ endedAt: nightSleepEnd });
      mockGetLastSleep.mockReturnValue({ endedAt: napEnd });
      mockPredictNextSleep.mockReturnValue({
        predictedTime: futureTime,
        type: "nap",
      });
      render(<SleepPredictionCard babyName="Sofija" />);
      await act(async () => {});
      expect(screen.queryByText("Sofija is sleeping")).toBeNull();
      expect(screen.getByText(/Nap time near/)).toBeTruthy();
    });
  });

  describe("Nighttime edge cases", () => {
    it("shows nighttime in bedtime zone when no prediction data", () => {
      jest.setSystemTime(new Date(2026, 3, 27, 19, 30, 0));
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        wakeWindowConfig: { dayStartHour: 7, dayEndHour: 19, dayBoundariesConfigured: true },
      };
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Bedtime")).toBeTruthy();
    });

    it("shows prediction in bedtime zone when prediction data exists", async () => {
      jest.setSystemTime(new Date(2026, 3, 27, 19, 30, 0));
      const nightSleepEnd = new Date(2026, 3, 27, 7, 0, 0);
      const napEnd = new Date(2026, 3, 27, 15, 0, 0);
      const futureTime = new Date(2026, 3, 27, 20, 0, 0);
      const sleeps = [
        makeNightSleep(nightSleepEnd),
        makeNapSleep(new Date(napEnd.getTime() - 45 * 60 * 1000), 45),
      ];
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        sleeps,
        qualifyingDayCount: 10,
        sleepPredictionModel: makeModel({ medianBedtimeStart: 20.5 }),
        wakeWindowConfig: { dayStartHour: 7, dayEndHour: 19, dayBoundariesConfigured: true },
      };
      mockGetQualifyingNightSleep.mockReturnValue({ endedAt: nightSleepEnd });
      mockGetLastSleep.mockReturnValue({ endedAt: napEnd });
      mockPredictNextSleep.mockReturnValue({
        predictedTime: futureTime,
        type: "bedtime",
      });
      render(<SleepPredictionCard babyName="Sofija" />);
      await act(async () => {});
      expect(screen.queryByText("Bedtime")).toBeNull();
      expect(screen.getByText(/Bedtime near/)).toBeTruthy();
    });

    it("shows nighttime just before morning threshold", () => {
      jest.setSystemTime(new Date(2026, 3, 27, 3, 30, 0));
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        wakeWindowConfig: { dayStartHour: 7, dayEndHour: 19, dayBoundariesConfigured: true },
      };
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Nighttime")).toBeTruthy();
    });

    it("shows track_sleep just after morning threshold", () => {
      jest.setSystemTime(new Date(2026, 3, 27, 4, 0, 0));
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        wakeWindowConfig: { dayStartHour: 7, dayEndHour: 19, dayBoundariesConfigured: true },
      };
      mockGetQualifyingNightSleep.mockReturnValue(null);
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Track sleep so we can predict nap times")).toBeTruthy();
    });

    it("clears the prior morning at midnight and requests tracking at the next anchor", async () => {
      jest.setSystemTime(new Date(2026, 6, 25, 23, 59, 0));
      const morningSleep = makeNightSleep(new Date(2026, 6, 25, 7, 0, 0));
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        sleeps: [morningSleep],
        wakeWindowConfig: { dayStartHour: 9, dayEndHour: 19, dayBoundariesConfigured: true },
        qualifyingDayCount: 10,
        sleepPredictionModel: makeModel({ medianBedtimeStart: 23.5 }),
      };
      mockGetLastSleep.mockReturnValue(morningSleep);
      mockPredictNextSleep.mockReturnValue({
        predictedTime: new Date(2026, 6, 26, 0, 30, 0),
        type: "bedtime",
      });

      render(<SleepPredictionCard babyName="Sofija" />);
      await act(async () => {});
      expect(screen.getByText(/Bedtime near/)).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(60 * 1000);
      });
      expect(screen.getByText("Nighttime")).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime((5 * 60 + 57) * 60 * 1000);
      });
      expect(screen.getByText("Track sleep so we can predict nap times")).toBeTruthy();
    });
  });

  describe("Track sleep state", () => {
    it("uses a persisted nap as early-window continuation in the production regression", async () => {
      jest.setSystemTime(new Date(2026, 6, 25, 11, 0, 0));
      const overnight = makeNightSleep(new Date(2026, 6, 25, 5, 53, 0));
      const continuation = makeNapSleep(new Date(2026, 6, 25, 7, 5, 0), 205);
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        sleeps: [overnight, continuation],
        wakeWindowConfig: { dayStartHour: 9, dayEndHour: 19, dayBoundariesConfigured: true },
        qualifyingDayCount: 10,
        sleepPredictionModel: makeModel(),
      };
      mockGetQualifyingNightSleep.mockReturnValue(null);
      mockGetLastSleep.mockReturnValue(continuation);
      mockPredictNextSleep.mockReturnValue({
        predictedTime: new Date(2026, 6, 25, 12, 30, 0),
        type: "nap",
      });

      render(<SleepPredictionCard babyName="Sofija" />);
      await act(async () => {});

      expect(screen.queryByText("Track sleep so we can predict nap times")).toBeNull();
      expect(screen.getByText(/Nap time near/)).toBeTruthy();
    });

    it("shows track_sleep when no night sleep registered today", () => {
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        qualifyingDayCount: 10,
        sleepPredictionModel: makeModel(),
      };
      mockGetQualifyingNightSleep.mockReturnValue(null);
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Track sleep so we can predict nap times")).toBeTruthy();
    });

    it("does not show track_sleep when night sleep is registered", async () => {
      const nightSleepEnd = new Date(2026, 3, 27, 7, 0, 0);
      const sleeps = [makeNightSleep(nightSleepEnd)];
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        sleeps,
        qualifyingDayCount: 10,
        sleepPredictionModel: makeModel(),
      };
      mockGetQualifyingNightSleep.mockReturnValue({ endedAt: nightSleepEnd });
      mockGetLastSleep.mockReturnValue({ endedAt: nightSleepEnd });
      mockPredictNextSleep.mockReturnValue({
        predictedTime: new Date(Date.now() + 60 * 60 * 1000),
        type: "nap",
      });
      render(<SleepPredictionCard babyName="Sofija" />);
      await act(async () => {});
      expect(screen.queryByText("Track sleep so we can predict nap times")).toBeNull();
      expect(screen.getByText(/Nap time near/)).toBeTruthy();
    });
  });

  describe("Need more data vs prediction", () => {
    const nightSleepEnd = new Date(2026, 3, 27, 7, 0, 0);
    const napEnd = new Date(Date.now() - 60 * 60 * 1000);

    it("shows need_more_data when qualifying days < 5", () => {
      const sleeps = [
        makeNightSleep(nightSleepEnd),
        makeNapSleep(new Date(napEnd.getTime() - 45 * 60 * 1000), 45),
      ];
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        sleeps,
        qualifyingDayCount: 2,
        sleepPredictionModel: makeModel(),
      };
      mockGetQualifyingNightSleep.mockReturnValue({ endedAt: nightSleepEnd });
      mockGetLastSleep.mockReturnValue({ endedAt: napEnd });
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText(/Based on age guidelines — 3 more days until personalized/)).toBeTruthy();
    });

    it("shows prediction when qualifying days >= 5", async () => {
      const sleeps = [
        makeNightSleep(nightSleepEnd),
        makeNapSleep(new Date(napEnd.getTime() - 45 * 60 * 1000), 45),
      ];
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        sleeps,
        qualifyingDayCount: 5,
        sleepPredictionModel: makeModel(),
      };
      mockGetQualifyingNightSleep.mockReturnValue({ endedAt: nightSleepEnd });
      mockGetLastSleep.mockReturnValue({ endedAt: napEnd });
      mockPredictNextSleep.mockReturnValue({
        predictedTime: new Date(Date.now() + 60 * 60 * 1000),
        type: "nap",
      });
      render(<SleepPredictionCard babyName="Sofija" />);
      await act(async () => {});
      expect(screen.queryByText(/Based on age guidelines/)).toBeNull();
      expect(screen.getByText(/Nap time near/)).toBeTruthy();
    });
  });

  describe("Extended priority order", () => {
    it("computing takes priority over sleeping", () => {
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        isComputingModel: true,
        activeTimer: {
          isRunning: true,
          isPaused: false,
          startTime: new Date(Date.now() - 10 * 60 * 1000),
          sleepType: "nap",
          totalPausedMs: 0,
        },
      };
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Predicting sleep patterns for Sofija")).toBeTruthy();
      expect(screen.queryByText("Sofija is sleeping")).toBeNull();
    });

    it("sleeping takes priority over track_sleep", () => {
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        activeTimer: {
          isRunning: true,
          isPaused: false,
          startTime: new Date(Date.now() - 10 * 60 * 1000),
          sleepType: "nap",
          totalPausedMs: 0,
        },
      };
      mockGetQualifyingNightSleep.mockReturnValue(null);
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Sofija is sleeping")).toBeTruthy();
      expect(screen.queryByText("Track sleep so we can predict nap times")).toBeNull();
    });

    it("no_birthdate takes priority over setup_required", () => {
      mockUseBabyReturn = { selectedBaby: { id: "baby-1", name: "Sofija", birthDate: undefined } };
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        wakeWindowConfig: { dayStartHour: undefined, dayEndHour: undefined },
      };
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.queryByText("Set up sleep predictions")).toBeNull();
    });

    it("nighttime (early morning) takes priority over track_sleep", () => {
      jest.setSystemTime(new Date(2026, 3, 27, 2, 0, 0));
      mockUseSleepReturn = {
        ...defaultSleepContext(),
        wakeWindowConfig: { dayStartHour: 7, dayEndHour: 19, dayBoundariesConfigured: true },
      };
      mockGetQualifyingNightSleep.mockReturnValue(null);
      render(<SleepPredictionCard babyName="Sofija" />);
      expect(screen.getByText("Nighttime")).toBeTruthy();
      expect(screen.queryByText("Track sleep so we can predict nap times")).toBeNull();
    });
  });

});
