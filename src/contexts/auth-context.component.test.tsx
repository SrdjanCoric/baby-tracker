jest.unmock("@/contexts/auth-context");

import React, { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react-native";
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

const mockSignOut = jest.fn().mockResolvedValue({ error: null });
const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();
const mockSignInWithOtp = jest.fn();
const mockGetSession = jest
  .fn()
  .mockResolvedValue({ data: { session: null }, error: null });
const mockSetSession = jest.fn();
const mockGetUser = jest.fn();
const mockProfileSingle = jest.fn();

jest.mock("@/services/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (callback: AuthStateCallback) => {
        authStateCallback = callback;
        return {
          data: {
            subscription: {
              unsubscribe: jest.fn(),
            },
          },
        };
      },
      signInWithPassword: () => mockSignInWithPassword(),
      signUp: () => mockSignUp(),
      signInWithOtp: (options: unknown) => mockSignInWithOtp(options),
      signInWithOAuth: jest.fn(),
      signInWithIdToken: jest.fn(),
      signOut: () => mockSignOut(),
      getUser: () => mockGetUser(),
      setSession: () => mockSetSession(),
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
  AppleAuthenticationScope: {
    FULL_NAME: 0,
    EMAIL: 1,
  },
}));

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn().mockResolvedValue({
      data: {
        idToken: "mock-id-token",
        user: { email: "test@gmail.com" },
      },
    }),
    signOut: jest.fn().mockResolvedValue(null),
  },
  isErrorWithCode: jest.fn().mockReturnValue(false),
  statusCodes: {
    SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
    IN_PROGRESS: "IN_PROGRESS",
    PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
  },
}));

jest.mock("expo-auth-session/providers/google", () => ({}));

jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

jest.mock("expo-crypto", () => ({
  getRandomBytesAsync: jest.fn().mockResolvedValue(new Uint8Array(32)),
}));

const mockSetStorageUserId = jest.fn();
jest.mock("@/services/storage-prefix", () => ({
  setStorageUserId: (id: string | null) => mockSetStorageUserId(id),
}));

jest.mock("@/constants/auth", () => ({
  AUTH_CONFIG: {
    OAUTH_REDIRECT_URI: "sofibaby://login-callback/",
  },
}));

const mockClearSyncData = jest.fn().mockResolvedValue(undefined);
jest.mock("@/contexts/sync-context", () => ({
  clearSyncData: () => mockClearSyncData(),
}));

import { AuthProvider, useAuth } from "./auth-context";

function TestConsumer({ testID }: { testID: string }) {
  const auth = useAuth();
  return (
    <View testID={testID}>
      <Text testID="loading">{auth.isLoading ? "loading" : "ready"}</Text>
      <Text testID="authenticated">
        {auth.isAuthenticated ? "authenticated" : "unauthenticated"}
      </Text>
      <Text testID="user-email">{auth.user?.email || "no-user"}</Text>
      <Text testID="user-id">{auth.user?.id || "no-id"}</Text>
      <Text
        testID="refresh-profile"
        onPress={() => {
          void auth.refreshUserProfile().then(
            () => AsyncStorage.setItem("profile-result", "available"),
            () => AsyncStorage.setItem("profile-result", "unavailable")
          );
        }}
      >
        Refresh profile
      </Text>
    </View>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authStateCallback = null;
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockProfileSingle.mockResolvedValue({
      data: { household_id: "household-1", display_name: "Caregiver", is_owner: true },
      error: null,
    });
  });

  describe("useAuth hook", () => {
    it("should throw error when used outside AuthProvider", () => {
      const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer testID="test" />);
      }).toThrow("useAuth must be used within an AuthProvider");

      consoleError.mockRestore();
    });
  });

  describe("AuthProvider initialization", () => {
    it("should start in loading state", async () => {
      render(
        <AuthProvider>
          <TestConsumer testID="test" />
        </AuthProvider>
      );

      expect(screen.getByTestId("loading").props.children).toBe("loading");
    });

    it("should set isLoading to false after initialization", async () => {
      render(
        <AuthProvider>
          <TestConsumer testID="test" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });
    });

    it("should be unauthenticated when no session exists", async () => {
      render(
        <AuthProvider>
          <TestConsumer testID="test" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      expect(screen.getByTestId("authenticated").props.children).toBe(
        "unauthenticated"
      );
      expect(screen.getByTestId("user-email").props.children).toBe("no-user");
    });

    it("should be authenticated when session exists on init", async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      render(
        <AuthProvider>
          <TestConsumer testID="test" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      await waitFor(() => {
        expect(screen.getByTestId("authenticated").props.children).toBe(
          "authenticated"
        );
      });

      expect(screen.getByTestId("user-email").props.children).toBe(
        "test@example.com"
      );
    });

    it("should set storage user ID when session exists", async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      render(
        <AuthProvider>
          <TestConsumer testID="test" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      expect(mockSetStorageUserId).toHaveBeenCalledWith("test-user-id");
    });
  });

  describe("profile refresh", () => {
    it("rejects an unavailable profile instead of returning empty account fields", async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: mockSession }, error: null });
      mockProfileSingle
        .mockResolvedValueOnce({
          data: { household_id: "household-1", display_name: "Caregiver", is_owner: true },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: new Error("offline") });

      render(
        <AuthProvider>
          <TestConsumer testID="test" />
        </AuthProvider>
      );
      await waitFor(() => expect(screen.getByTestId("loading").props.children).toBe("ready"));

      fireEvent.press(screen.getByTestId("refresh-profile"));

      await waitFor(() => {
        expect(AsyncStorage.setItem).toHaveBeenCalledWith("profile-result", "unavailable");
      });
    });
  });

  describe("auth state changes", () => {
    it("should update user state on SIGNED_IN event", async () => {
      render(
        <AuthProvider>
          <TestConsumer testID="test" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").props.children).toBe("ready");
      });

      expect(authStateCallback).not.toBeNull();

      await act(async () => {
        if (authStateCallback) {
          authStateCallback("SIGNED_IN", mockSession);
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId("authenticated").props.children).toBe(
          "authenticated"
        );
      });

      expect(screen.getByTestId("user-email").props.children).toBe(
        "test@example.com"
      );
    });

    it("should clear user state on SIGNED_OUT event", async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      render(
        <AuthProvider>
          <TestConsumer testID="test" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("authenticated").props.children).toBe(
          "authenticated"
        );
      });

      await act(async () => {
        if (authStateCallback) {
          authStateCallback("SIGNED_OUT", null);
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId("authenticated").props.children).toBe(
          "unauthenticated"
        );
        expect(screen.getByTestId("user-email").props.children).toBe("no-user");
      });
    });

    it("should handle TOKEN_REFRESHED event with valid session", async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      render(
        <AuthProvider>
          <TestConsumer testID="test" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("authenticated").props.children).toBe(
          "authenticated"
        );
      });

      const newUser = { ...mockUser, email: "updated@example.com" };
      const newSession = { ...mockSession, user: newUser };

      await act(async () => {
        if (authStateCallback) {
          authStateCallback("TOKEN_REFRESHED", newSession);
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId("authenticated").props.children).toBe(
          "authenticated"
        );
      });
    });

    it("should clear state on TOKEN_REFRESHED with null session (refresh failure)", async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      render(
        <AuthProvider>
          <TestConsumer testID="test" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("authenticated").props.children).toBe(
          "authenticated"
        );
      });

      await act(async () => {
        if (authStateCallback) {
          authStateCallback("TOKEN_REFRESHED", null);
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId("authenticated").props.children).toBe(
          "unauthenticated"
        );
      });

      expect(mockSetStorageUserId).toHaveBeenCalledWith(null);
    });
  });

  describe("signOut", () => {
    it("should call supabase signOut", async () => {
      let signOutFn: (() => Promise<{ error: Error | null }>) | undefined;

      function SignOutTestConsumer() {
        const auth = useAuth();
        useEffect(() => {
          signOutFn = auth.signOut;
        }, [auth.signOut]);
        return (
          <View>
            <Text testID="authenticated">
              {auth.isAuthenticated ? "authenticated" : "unauthenticated"}
            </Text>
          </View>
        );
      }

      render(
        <AuthProvider>
          <SignOutTestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(signOutFn).toBeDefined();
      });

      await act(async () => {
        if (signOutFn) {
          await signOutFn();
        }
      });

      expect(mockSignOut).toHaveBeenCalled();
    });

    it("keeps local account data when remote sign out fails", async () => {
      let signOutFn: (() => Promise<{ error: Error | null }>) | undefined;
      mockSignOut.mockResolvedValueOnce({ error: new Error("offline") });
      jest.spyOn(AsyncStorage, "getAllKeys").mockResolvedValue(["@babies:user-1:household-1"]);
      jest.spyOn(AsyncStorage, "multiRemove").mockResolvedValue(undefined);

      function SignOutTestConsumer() {
        const auth = useAuth();
        useEffect(() => {
          signOutFn = auth.signOut;
        }, [auth.signOut]);
        return <View />;
      }

      render(
        <AuthProvider>
          <SignOutTestConsumer />
        </AuthProvider>
      );
      await waitFor(() => expect(signOutFn).toBeDefined());
      mockSetStorageUserId.mockClear();
      mockClearSyncData.mockClear();

      let result: { error: Error | null } | undefined;
      await act(async () => {
        result = await signOutFn?.();
      });

      expect(result?.error).toEqual(new Error("offline"));
      expect(AsyncStorage.multiRemove).not.toHaveBeenCalled();
      expect(mockClearSyncData).not.toHaveBeenCalled();
      expect(mockSetStorageUserId).not.toHaveBeenCalledWith(null);
    });

    it("preserves unscoped guest data when switching away from a conflicting account", async () => {
      let signOutFn: ((options?: { preserveGuestData?: boolean }) => Promise<{ error: Error | null }>) | undefined;
      jest.spyOn(AsyncStorage, "getAllKeys").mockResolvedValue([
        "@babies",
        "@feedings:guest-baby",
        "@babies:user-1:household-1",
        "@feedings:account-baby:user-1",
        "@sync_queue",
      ]);
      jest.spyOn(AsyncStorage, "multiRemove").mockResolvedValue(undefined);

      function SignOutTestConsumer() {
        const auth = useAuth();
        useEffect(() => {
          signOutFn = auth.signOut;
        }, [auth.signOut]);
        return <View />;
      }

      render(
        <AuthProvider>
          <SignOutTestConsumer />
        </AuthProvider>
      );
      await waitFor(() => expect(signOutFn).toBeDefined());

      await act(async () => {
        await signOutFn?.({ preserveGuestData: true });
      });

      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
        "@babies:user-1:household-1",
        "@feedings:account-baby:user-1",
        "@sync_queue",
      ]);
    });

    it("should clear storage user ID on signOut", async () => {
      let signOutFn: (() => Promise<{ error: Error | null }>) | undefined;

      function SignOutTestConsumer() {
        const auth = useAuth();
        useEffect(() => {
          signOutFn = auth.signOut;
        }, [auth.signOut]);
        return <View />;
      }

      render(
        <AuthProvider>
          <SignOutTestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(signOutFn).toBeDefined();
      });

      mockSetStorageUserId.mockClear();

      await act(async () => {
        if (signOutFn) {
          await signOutFn();
        }
      });

      expect(mockSetStorageUserId).toHaveBeenCalledWith(null);
    });
  });

  describe("signIn", () => {
    it("should call supabase signInWithPassword", async () => {
      mockSignInWithPassword.mockResolvedValue({ error: null });

      let signInFn:
        | ((
            email: string,
            password: string
          ) => Promise<{ error: Error | null }>)
        | undefined;

      function SignInTestConsumer() {
        const auth = useAuth();
        useEffect(() => {
          signInFn = auth.signIn;
        }, [auth.signIn]);
        return <View />;
      }

      render(
        <AuthProvider>
          <SignInTestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(signInFn).toBeDefined();
      });

      await act(async () => {
        if (signInFn) {
          await signInFn("test@example.com", "password123");
        }
      });

      expect(mockSignInWithPassword).toHaveBeenCalled();
    });

    it("should return error on signIn failure", async () => {
      const mockError = new Error("Invalid credentials");
      mockSignInWithPassword.mockResolvedValue({ error: mockError });

      let signInFn:
        | ((
            email: string,
            password: string
          ) => Promise<{ error: Error | null }>)
        | undefined;

      function SignInTestConsumer() {
        const auth = useAuth();
        useEffect(() => {
          signInFn = auth.signIn;
        }, [auth.signIn]);
        return <View />;
      }

      render(
        <AuthProvider>
          <SignInTestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(signInFn).toBeDefined();
      });

      let result: { error: Error | null } | undefined;
      await act(async () => {
        if (signInFn) {
          result = await signInFn("test@example.com", "wrongpassword");
        }
      });

      expect(result?.error).toBeTruthy();
    });
  });

  describe("signUp", () => {
    it("should call supabase signUp", async () => {
      mockSignUp.mockResolvedValue({ data: { user: mockUser }, error: null });

      let signUpFn:
        | ((
            email: string,
            password: string,
            displayName?: string
          ) => Promise<{ error: Error | null }>)
        | undefined;

      function SignUpTestConsumer() {
        const auth = useAuth();
        useEffect(() => {
          signUpFn = auth.signUp;
        }, [auth.signUp]);
        return <View />;
      }

      render(
        <AuthProvider>
          <SignUpTestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(signUpFn).toBeDefined();
      });

      await act(async () => {
        if (signUpFn) {
          await signUpFn("new@example.com", "Password123", "New User");
        }
      });

      expect(mockSignUp).toHaveBeenCalled();
    });

    it("should return error on signUp failure", async () => {
      const mockError = new Error("Email already exists");
      mockSignUp.mockResolvedValue({ data: null, error: mockError });

      let signUpFn:
        | ((
            email: string,
            password: string,
            displayName?: string
          ) => Promise<{ error: Error | null }>)
        | undefined;

      function SignUpTestConsumer() {
        const auth = useAuth();
        useEffect(() => {
          signUpFn = auth.signUp;
        }, [auth.signUp]);
        return <View />;
      }

      render(
        <AuthProvider>
          <SignUpTestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(signUpFn).toBeDefined();
      });

      let result: { error: Error | null } | undefined;
      await act(async () => {
        if (signUpFn) {
          result = await signUpFn("existing@example.com", "Password123");
        }
      });

      expect(result?.error).toBeTruthy();
    });
  });

  describe("signInWithMagicLink", () => {
    it("should call supabase signInWithOtp", async () => {
      mockSignInWithOtp.mockResolvedValue({ error: null });

      let magicLinkFn:
        | ((email: string, options?: { createAccount?: boolean }) => Promise<{ error: Error | null }>)
        | undefined;

      function MagicLinkTestConsumer() {
        const auth = useAuth();
        useEffect(() => {
          magicLinkFn = auth.signInWithMagicLink;
        }, [auth.signInWithMagicLink]);
        return <View />;
      }

      render(
        <AuthProvider>
          <MagicLinkTestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(magicLinkFn).toBeDefined();
      });

      await act(async () => {
        if (magicLinkFn) {
          await magicLinkFn("test@example.com", { createAccount: false });
        }
      });

      expect(mockSignInWithOtp).toHaveBeenCalledWith(expect.objectContaining({
        email: "test@example.com",
        options: expect.objectContaining({ shouldCreateUser: false }),
      }));
    });
  });

  describe("context value", () => {
    it("should provide isAppleSignInAvailable", async () => {
      let isAppleAvailable: boolean | undefined;

      function AppleTestConsumer() {
        const auth = useAuth();
        useEffect(() => {
          isAppleAvailable = auth.isAppleSignInAvailable;
        }, [auth.isAppleSignInAvailable]);
        return <View />;
      }

      render(
        <AuthProvider>
          <AppleTestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(isAppleAvailable).toBeDefined();
      });

      expect(typeof isAppleAvailable).toBe("boolean");
    });

    it("should provide all required auth methods", async () => {
      let authMethods: {
        signUp?: unknown;
        signIn?: unknown;
        signOut?: unknown;
        signInWithMagicLink?: unknown;
        signInWithGoogle?: unknown;
        signInWithApple?: unknown;
        updateDisplayName?: unknown;
      } = {};

      function MethodsTestConsumer() {
        const auth = useAuth();
        useEffect(() => {
          authMethods = {
            signUp: auth.signUp,
            signIn: auth.signIn,
            signOut: auth.signOut,
            signInWithMagicLink: auth.signInWithMagicLink,
            signInWithGoogle: auth.signInWithGoogle,
            signInWithApple: auth.signInWithApple,
            updateDisplayName: auth.updateDisplayName,
          };
        }, [auth]);
        return <View />;
      }

      render(
        <AuthProvider>
          <MethodsTestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(authMethods.signUp).toBeDefined();
      });

      expect(typeof authMethods.signUp).toBe("function");
      expect(typeof authMethods.signIn).toBe("function");
      expect(typeof authMethods.signOut).toBe("function");
      expect(typeof authMethods.signInWithMagicLink).toBe("function");
      expect(typeof authMethods.signInWithGoogle).toBe("function");
      expect(typeof authMethods.signInWithApple).toBe("function");
      expect(typeof authMethods.updateDisplayName).toBe("function");
    });
  });
});
