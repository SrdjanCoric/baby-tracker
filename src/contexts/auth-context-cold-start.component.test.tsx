jest.unmock("@/contexts/auth-context");

import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react-native";
import { Text, View } from "react-native";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

const mockUser: User = {
  id: "test-user-id",
  aud: "authenticated",
  role: "authenticated",
  email: "test@example.com",
  email_confirmed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {},
};

const mockSession: Session = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user: mockUser,
};

type AuthStateCallback = (
  event: AuthChangeEvent,
  session: Session | null
) => void;
let authStateCallback: AuthStateCallback | null = null;

const mockGetSession = jest.fn();
const mockProfileSingle = jest.fn();

jest.mock("@/services/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (callback: AuthStateCallback) => {
        authStateCallback = callback;
        return {
          data: { subscription: { unsubscribe: jest.fn() } },
        };
      },
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signInWithOtp: jest.fn(),
      signInWithOAuth: jest.fn(),
      signInWithIdToken: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
      setSession: jest.fn(),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: () => mockProfileSingle(),
      update: jest.fn().mockReturnThis(),
    }),
  },
}));

jest.mock("expo-apple-authentication", () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: { configure: jest.fn() },
  isErrorWithCode: jest.fn().mockReturnValue(false),
  statusCodes: {},
}));

jest.mock("expo-auth-session/providers/google", () => ({}));
jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));
jest.mock("expo-crypto", () => ({
  getRandomBytesAsync: jest.fn().mockResolvedValue(new Uint8Array(32)),
}));

jest.mock("@/services/storage-prefix", () => ({
  setStorageUserId: jest.fn(),
}));

jest.mock("@/constants/auth", () => ({
  AUTH_CONFIG: { OAUTH_REDIRECT_URI: "sofibaby://login-callback/" },
}));

jest.mock("@/contexts/sync-context", () => ({
  clearSyncData: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/services/watch-service", () => ({
  clearWatchContext: jest.fn().mockResolvedValue(undefined),
}));

import { AuthProvider, useAuth } from "./auth-context";

function TestConsumer() {
  const auth = useAuth();
  return (
    <View>
      <Text testID="loading">{auth.isLoading ? "loading" : "ready"}</Text>
      <Text testID="household">{auth.user?.householdId ?? "no-household"}</Text>
    </View>
  );
}

describe("AuthContext cold start with stored session", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authStateCallback = null;
    mockGetSession.mockResolvedValue({
      data: { session: mockSession },
      error: null,
    });
    mockProfileSingle.mockResolvedValue({
      data: {
        household_id: "household-1",
        display_name: "Caregiver",
        is_owner: true,
      },
      error: null,
    });
  });

  it("keeps householdId when a late auth event re-delivers the same session", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("loading").props.children).toBe("ready")
    );
    await waitFor(() =>
      expect(screen.getByTestId("household").props.children).toBe("household-1")
    );

    // Simulate the profile refetch triggered by the auth event staying
    // in flight (slow network on cold start).
    let resolveProfile: (value: unknown) => void = () => {};
    mockProfileSingle.mockImplementation(
      () => new Promise((resolve) => { resolveProfile = resolve; })
    );

    // supabase-js delivers INITIAL_SESSION / SIGNED_IN asynchronously after
    // subscription — on device this lands during the first seconds of use.
    await act(async () => {
      authStateCallback?.("SIGNED_IN", mockSession);
    });

    // The already-loaded profile must survive the event; regressing to null
    // remounts AuthScopeBoundary/SyncAuthGate and resets navigation.
    expect(screen.getByTestId("household").props.children).toBe("household-1");

    await act(async () => {
      resolveProfile({
        data: {
          household_id: "household-1",
          display_name: "Caregiver",
          is_owner: true,
        },
        error: null,
      });
    });
  });
});
