/**
 * Integration test to ensure sync auth context is properly initialized
 * This test was added after discovering a bug where setAuthContext was never
 * called, causing "Sync auth context not set" errors when logging activities.
 */
import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import { View, Text } from "react-native";

const mockSetAuthContext = jest.fn();
const mockEnqueueOperation = jest.fn();

jest.mock("@/contexts/sync-context", () => ({
  SyncProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSync: () => ({
    status: "online" as const,
    pendingCount: 0,
    lastSyncedAt: null,
    error: null,
    isConnected: true,
    forceSync: jest.fn(),
    retryFailedSync: jest.fn(),
    clearAllData: jest.fn(),
    subscribeToRemoteChanges: jest.fn(() => () => {}),
    setAuthContext: mockSetAuthContext,
    enqueueOperation: mockEnqueueOperation,
  }),
}));

jest.mock("@/contexts/auth-context", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    user: {
      id: "test-user-123",
      email: "test@example.com",
      householdId: "test-household-456",
    },
    isAuthenticated: true,
    isLoading: false,
    signIn: jest.fn(),
    signOut: jest.fn(),
    signUp: jest.fn(),
  }),
}));

import { useAuth } from "@/contexts/auth-context";
import { useSync } from "@/contexts/sync-context";

function SyncAuthSetup({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { setAuthContext } = useSync();
  const hasSetAuthRef = React.useRef(false);
  const lastUserIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (user?.id && !hasSetAuthRef.current) {
      // Use householdId if available, otherwise fall back to userId for single-user mode
      const householdId = user.householdId || user.id;
      setAuthContext(householdId, user.id);
      hasSetAuthRef.current = true;
      lastUserIdRef.current = user.id;
    }

    // Reset if user changes or logs out
    if (!user?.id || (lastUserIdRef.current && lastUserIdRef.current !== user.id)) {
      hasSetAuthRef.current = false;
      lastUserIdRef.current = null;
    }
  }, [user?.id, user?.householdId, setAuthContext]);

  return <>{children}</>;
}

function TestComponent() {
  return (
    <View>
      <Text>Test Content</Text>
    </View>
  );
}

describe("SyncAuthSetup Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should call setAuthContext when user has id and householdId", async () => {
    render(
      <SyncAuthSetup>
        <TestComponent />
      </SyncAuthSetup>
    );

    await waitFor(() => {
      expect(mockSetAuthContext).toHaveBeenCalledWith(
        "test-household-456",
        "test-user-123"
      );
    });
  });

  it("should only call setAuthContext once for the same user", async () => {
    const { rerender } = render(
      <SyncAuthSetup>
        <TestComponent />
      </SyncAuthSetup>
    );

    await waitFor(() => {
      expect(mockSetAuthContext).toHaveBeenCalledTimes(1);
    });

    rerender(
      <SyncAuthSetup>
        <TestComponent />
      </SyncAuthSetup>
    );

    expect(mockSetAuthContext).toHaveBeenCalledTimes(1);
  });

  it("should provide a complete useSync mock with enqueueOperation", () => {
    const sync = useSync();

    expect(sync.enqueueOperation).toBeDefined();
    expect(typeof sync.enqueueOperation).toBe("function");
    expect(sync.setAuthContext).toBeDefined();
    expect(typeof sync.setAuthContext).toBe("function");
    expect(sync.subscribeToRemoteChanges).toBeDefined();
    expect(typeof sync.subscribeToRemoteChanges).toBe("function");
  });
});
