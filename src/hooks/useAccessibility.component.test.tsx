import React from "react";
import { render, act, waitFor } from "@testing-library/react-native";
import { View, Text, AccessibilityInfo } from "react-native";
import { useAccessibility } from "./useAccessibility";

jest.mock("react-native-reanimated", () => ({
  useReducedMotion: jest.fn(() => false),
}));

const TestComponent = ({
  onMount,
}: {
  onMount?: (hook: ReturnType<typeof useAccessibility>) => void;
}) => {
  const accessibility = useAccessibility();

  React.useEffect(() => {
    onMount?.(accessibility);
  }, [accessibility, onMount]);

  return (
    <View>
      <Text testID="screen-reader">
        {accessibility.isScreenReaderEnabled ? "enabled" : "disabled"}
      </Text>
      <Text testID="reduce-motion">
        {accessibility.reduceMotionEnabled ? "enabled" : "disabled"}
      </Text>
    </View>
  );
};

describe("useAccessibility", () => {
  let mockIsScreenReaderEnabled: jest.SpyInstance;
  let mockAddEventListener: jest.SpyInstance;
  let mockAnnounceForAccessibility: jest.SpyInstance;
  let mockSetAccessibilityFocus: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();

    mockIsScreenReaderEnabled = jest
      .spyOn(AccessibilityInfo, "isScreenReaderEnabled")
      .mockResolvedValue(false);

    mockAddEventListener = jest
      .spyOn(AccessibilityInfo, "addEventListener")
      .mockReturnValue({ remove: jest.fn() });

    mockAnnounceForAccessibility = jest
      .spyOn(AccessibilityInfo, "announceForAccessibility")
      .mockImplementation(() => {});

    mockSetAccessibilityFocus = jest
      .spyOn(AccessibilityInfo, "setAccessibilityFocus")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("screen reader detection", () => {
    it("should detect when screen reader is disabled", async () => {
      mockIsScreenReaderEnabled.mockResolvedValue(false);

      const { getByTestId } = render(<TestComponent />);

      await waitFor(() => {
        expect(getByTestId("screen-reader").props.children).toBe("disabled");
      });
    });

    it("should detect when screen reader is enabled", async () => {
      mockIsScreenReaderEnabled.mockResolvedValue(true);

      const { getByTestId } = render(<TestComponent />);

      await waitFor(() => {
        expect(getByTestId("screen-reader").props.children).toBe("enabled");
      });
    });

    it("should subscribe to screen reader changes", () => {
      render(<TestComponent />);

      expect(mockAddEventListener).toHaveBeenCalledWith(
        "screenReaderChanged",
        expect.any(Function)
      );
    });

    it("should unsubscribe on unmount", () => {
      const mockRemove = jest.fn();
      mockAddEventListener.mockReturnValue({ remove: mockRemove });

      const { unmount } = render(<TestComponent />);
      unmount();

      expect(mockRemove).toHaveBeenCalled();
    });
  });

  describe("reduced motion", () => {
    it("should return reduced motion state", () => {
      const { getByTestId } = render(<TestComponent />);

      expect(getByTestId("reduce-motion").props.children).toBe("disabled");
    });
  });

  describe("announce", () => {
    it("should call announceForAccessibility with message", async () => {
      let hookResult: ReturnType<typeof useAccessibility>;

      render(
        <TestComponent
          onMount={(hook) => {
            hookResult = hook;
          }}
        />
      );

      await waitFor(() => {
        expect(hookResult).toBeDefined();
      });

      act(() => {
        hookResult.announce("Test message");
        jest.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(mockAnnounceForAccessibility).toHaveBeenCalledWith("Test message");
      });
    });

    it("should not announce empty message", async () => {
      let hookResult: ReturnType<typeof useAccessibility>;

      render(
        <TestComponent
          onMount={(hook) => {
            hookResult = hook;
          }}
        />
      );

      await waitFor(() => {
        expect(hookResult).toBeDefined();
      });

      mockAnnounceForAccessibility.mockClear();

      act(() => {
        hookResult.announce("");
        jest.advanceTimersByTime(500);
      });

      expect(mockAnnounceForAccessibility).not.toHaveBeenCalled();
    });

    it("should queue multiple announcements", async () => {
      let hookResult: ReturnType<typeof useAccessibility>;

      render(
        <TestComponent
          onMount={(hook) => {
            hookResult = hook;
          }}
        />
      );

      await waitFor(() => {
        expect(hookResult).toBeDefined();
      });

      act(() => {
        hookResult.announce("Message 1");
        hookResult.announce("Message 2");
        jest.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(mockAnnounceForAccessibility).toHaveBeenCalledWith("Message 1");
      });

      act(() => {
        jest.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(mockAnnounceForAccessibility).toHaveBeenCalledWith("Message 2");
      });
    });
  });

  describe("announceTimerStart", () => {
    it("should announce timer start message", async () => {
      let hookResult: ReturnType<typeof useAccessibility>;

      render(
        <TestComponent
          onMount={(hook) => {
            hookResult = hook;
          }}
        />
      );

      await waitFor(() => {
        expect(hookResult).toBeDefined();
      });

      mockAnnounceForAccessibility.mockClear();

      act(() => {
        hookResult.announceTimerStart("breastfeeding");
        jest.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(mockAnnounceForAccessibility).toHaveBeenCalledWith(
          "Breastfeeding timer started"
        );
      });
    });
  });

  describe("announceTimerStop", () => {
    it("should announce timer stop message without duration", async () => {
      let hookResult: ReturnType<typeof useAccessibility>;

      render(
        <TestComponent
          onMount={(hook) => {
            hookResult = hook;
          }}
        />
      );

      await waitFor(() => {
        expect(hookResult).toBeDefined();
      });

      mockAnnounceForAccessibility.mockClear();

      act(() => {
        hookResult.announceTimerStop("pumping");
        jest.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(mockAnnounceForAccessibility).toHaveBeenCalledWith(
          "Pumping timer stopped"
        );
      });
    });

    it("should announce timer stop message with duration", async () => {
      let hookResult: ReturnType<typeof useAccessibility>;

      render(
        <TestComponent
          onMount={(hook) => {
            hookResult = hook;
          }}
        />
      );

      await waitFor(() => {
        expect(hookResult).toBeDefined();
      });

      mockAnnounceForAccessibility.mockClear();

      act(() => {
        hookResult.announceTimerStop("tummyTime", 600);
        jest.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(mockAnnounceForAccessibility).toHaveBeenCalledWith(
          "Tummy time timer stopped. Duration: 10 minutes"
        );
      });
    });
  });

  describe("announceSaveSuccess", () => {
    it("should announce save success message", async () => {
      let hookResult: ReturnType<typeof useAccessibility>;

      render(
        <TestComponent
          onMount={(hook) => {
            hookResult = hook;
          }}
        />
      );

      await waitFor(() => {
        expect(hookResult).toBeDefined();
      });

      mockAnnounceForAccessibility.mockClear();

      act(() => {
        hookResult.announceSaveSuccess("diaper");
        jest.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(mockAnnounceForAccessibility).toHaveBeenCalledWith(
          "Diaper change saved successfully"
        );
      });
    });
  });

  describe("announceError", () => {
    it("should announce generic error message", async () => {
      let hookResult: ReturnType<typeof useAccessibility>;

      render(
        <TestComponent
          onMount={(hook) => {
            hookResult = hook;
          }}
        />
      );

      await waitFor(() => {
        expect(hookResult).toBeDefined();
      });

      mockAnnounceForAccessibility.mockClear();

      act(() => {
        hookResult.announceError();
        jest.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(mockAnnounceForAccessibility).toHaveBeenCalledWith(
          "An error occurred. Please try again."
        );
      });
    });

    it("should announce error with context", async () => {
      let hookResult: ReturnType<typeof useAccessibility>;

      render(
        <TestComponent
          onMount={(hook) => {
            hookResult = hook;
          }}
        />
      );

      await waitFor(() => {
        expect(hookResult).toBeDefined();
      });

      mockAnnounceForAccessibility.mockClear();

      act(() => {
        hookResult.announceError("saving");
        jest.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(mockAnnounceForAccessibility).toHaveBeenCalledWith(
          "Error saving. Please try again."
        );
      });
    });
  });

  describe("setAccessibilityFocus", () => {
    it("should set focus on valid node handle", async () => {
      let hookResult: ReturnType<typeof useAccessibility>;

      render(
        <TestComponent
          onMount={(hook) => {
            hookResult = hook;
          }}
        />
      );

      await waitFor(() => {
        expect(hookResult).toBeDefined();
      });

      act(() => {
        hookResult.setAccessibilityFocus(123);
      });

      expect(mockSetAccessibilityFocus).toHaveBeenCalledWith(123);
    });

    it("should not set focus on null handle", async () => {
      let hookResult: ReturnType<typeof useAccessibility>;

      render(
        <TestComponent
          onMount={(hook) => {
            hookResult = hook;
          }}
        />
      );

      await waitFor(() => {
        expect(hookResult).toBeDefined();
      });

      mockSetAccessibilityFocus.mockClear();

      act(() => {
        hookResult.setAccessibilityFocus(null);
      });

      expect(mockSetAccessibilityFocus).not.toHaveBeenCalled();
    });
  });
});
