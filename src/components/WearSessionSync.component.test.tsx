import React from "react";
import { render, waitFor } from "@testing-library/react-native";

import { WearSessionSync } from "./WearSessionSync";

const mockPublishActive = jest.fn();
const mockPublishInvalidated = jest.fn();
const mockGetPendingRefreshRequest = jest.fn(async () => null);
const mockSubscribeRefreshRequests = jest.fn(() => jest.fn());
const mockRefreshSession = jest.fn();

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
  wearSessionRevisionStore: jest.fn(() => ({
    read: async () => -1,
    write: async () => undefined,
  })),
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
      refreshSession: mockRefreshSession,
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
    mockPublishInvalidated.mockResolvedValue(undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
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
});
