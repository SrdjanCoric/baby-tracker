import React from "react";
import { AppState, type AppStateStatus } from "react-native";
import { act, render, waitFor } from "@testing-library/react-native";

import { WearSessionSync } from "./WearSessionSync";

const mockPublishActive = jest.fn();
const mockPublishInvalidated = jest.fn();
const mockGetPendingRefreshRequest = jest.fn(async () => null);
const mockSubscribeRefreshRequests = jest.fn(() => jest.fn());
const mockRefreshSession = jest.fn();
const mockHandledRefreshStore = {
  read: jest.fn(async () => -1),
  write: jest.fn(async () => undefined),
};
let mockAppStateListener: ((state: AppStateStatus) => void) | null = null;

let mockAuthState = {
  isLoading: false,
  user: {
    id: "user-1",
    email: "alex@example.com",
    displayName: "Alex",
  },
  session: {
    access_token: "access-token",
    expires_at: 1_800_000_000,
  },
};
let mockBabyState = {
  isLoading: false,
  selectedBaby: {
    id: "baby-1",
    name: "Sofi",
  },
};

jest.mock("@/contexts", () => ({
  useAuth: () => mockAuthState,
  useBaby: () => mockBabyState,
}));

jest.mock("@/services/wear-session-handoff-phone", () => ({
  HANDLED_REFRESH_REVISION_KEY: "handled-refresh",
  wearSessionRevisionStore: jest.fn(() => mockHandledRefreshStore),
  loadWearSessionPhoneRuntime: () => ({
    adapter: {
      getInstallEpoch: async () => "phone-install-1",
      publishState: async () => undefined,
      getPendingRefreshRequest: mockGetPendingRefreshRequest,
      subscribeRefreshRequests: mockSubscribeRefreshRequests,
    },
    publisher: {
      publishActive: mockPublishActive,
      publishInvalidated: mockPublishInvalidated,
    },
  }),
}));

jest.mock("@/services/supabase", () => ({
  supabase: {
    auth: {
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
    },
  },
}));

describe("WearSessionSync", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    mockAuthState = {
      isLoading: false,
      user: {
        id: "user-1",
        email: "alex@example.com",
        displayName: "Alex",
      },
      session: {
        access_token: "access-token",
        expires_at: 1_800_000_000,
      },
    };
    mockBabyState = {
      isLoading: false,
      selectedBaby: {
        id: "baby-1",
        name: "Sofi",
      },
    };
    mockGetPendingRefreshRequest.mockResolvedValue(null);
    mockSubscribeRefreshRequests.mockReturnValue(jest.fn());
    mockPublishActive.mockResolvedValue(undefined);
    mockPublishInvalidated.mockResolvedValue(undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    mockAppStateListener = null;
    jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
      mockAppStateListener = listener;
      return { remove: jest.fn() };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("retries an unchanged desired session after publication fails", async () => {
    mockPublishActive
      .mockRejectedValueOnce(new Error("data layer offline"))
      .mockResolvedValue(undefined);
    const view = render(<WearSessionSync />);

    await waitFor(() => expect(mockPublishActive).toHaveBeenCalledTimes(1));

    mockAuthState = {
      ...mockAuthState,
      user: { ...mockAuthState.user },
    };
    view.rerender(<WearSessionSync />);

    await waitFor(() => expect(mockPublishActive).toHaveBeenCalledTimes(2));
  });

  it("retries a failed durable refresh request when the app becomes active", async () => {
    mockGetPendingRefreshRequest.mockResolvedValue(7);
    mockRefreshSession
      .mockRejectedValueOnce(new Error("phone offline"))
      .mockResolvedValue({ data: { session: {} }, error: null });

    render(<WearSessionSync />);

    await waitFor(() => expect(mockGetPendingRefreshRequest).toHaveBeenCalledTimes(1));
    await expect(mockGetPendingRefreshRequest.mock.results[0].value).resolves.toBe(7);
    await waitFor(() => expect(mockHandledRefreshStore.read).toHaveBeenCalledTimes(1));
    await expect(mockHandledRefreshStore.read.mock.results[0].value).resolves.toBe(-1);
    await waitFor(() => expect(mockRefreshSession).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(console.warn).toHaveBeenCalledWith(
        "[WearSessionSync] Phone session refresh unavailable"
      )
    );
    expect(mockAppStateListener).not.toBeNull();

    act(() => mockAppStateListener?.("active"));

    await waitFor(() => expect(mockGetPendingRefreshRequest).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockRefreshSession).toHaveBeenCalledTimes(2));
  });
});
