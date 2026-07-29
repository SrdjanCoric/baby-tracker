import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { SyncAuthGate } from "@/components/SyncAuthGate";

const mockSetAuthContext = jest.fn();
const mockClearAuthContext = jest.fn();
let mockIsInitialized = false;
let mockUser: { id: string; householdId: string | null } | null = {
  id: "test-user-123",
  householdId: "test-household-456",
};

jest.mock("@/contexts/sync-context", () => ({
  useSync: () => ({
    clearAuthContext: mockClearAuthContext,
    isInitialized: mockIsInitialized,
    setAuthContext: mockSetAuthContext,
  }),
}));

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ user: mockUser }),
}));

describe("SyncAuthGate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsInitialized = false;
    mockUser = {
      id: "test-user-123",
      householdId: "test-household-456",
    };
  });

  it("blocks authenticated providers until the engine is initialized with the current identity", async () => {
    const { queryByText, rerender } = render(
      <SyncAuthGate>
        <Text>Activity providers ready</Text>
      </SyncAuthGate>
    );

    expect(queryByText("Activity providers ready")).toBeNull();
    await waitFor(() => {
      expect(mockSetAuthContext).toHaveBeenCalledWith(
        "test-household-456",
        "test-user-123"
      );
    });

    mockIsInitialized = true;
    rerender(
      <SyncAuthGate>
        <Text>Activity providers ready</Text>
      </SyncAuthGate>
    );

    expect(queryByText("Activity providers ready")).not.toBeNull();
  });

  it("waits for the authenticated user's household and renders only the restricted fallback", () => {
    mockIsInitialized = true;
    mockUser = {
      id: "test-user-123",
      householdId: null,
    };

    const { queryByText, getByText } = render(
      <SyncAuthGate blockedFallback={<Text>Restricted restoration</Text>}>
        <Text>Activity providers ready</Text>
      </SyncAuthGate>
    );

    expect(queryByText("Activity providers ready")).toBeNull();
    expect(getByText("Restricted restoration")).toBeTruthy();
    expect(mockSetAuthContext).not.toHaveBeenCalled();
  });

  it("renders guest providers without creating an authenticated sync context", () => {
    mockUser = null;

    const { getByText } = render(
      <SyncAuthGate>
        <Text>Guest activity providers ready</Text>
      </SyncAuthGate>
    );

    expect(getByText("Guest activity providers ready")).toBeTruthy();
    expect(mockSetAuthContext).not.toHaveBeenCalled();
  });

  it("clears authenticated sync state before rendering guest providers after logout", async () => {
    mockIsInitialized = true;
    const renderOrder: string[] = [];
    mockClearAuthContext.mockImplementation(() => {
      renderOrder.push("auth cleared");
    });

    function GuestReadyMarker() {
      renderOrder.push("guest rendered");
      return <Text>Guest providers ready</Text>;
    }

    const { getByText, rerender } = render(
      <SyncAuthGate>
        <Text>Authenticated providers ready</Text>
      </SyncAuthGate>
    );

    await waitFor(() => {
      expect(getByText("Authenticated providers ready")).toBeTruthy();
    });

    renderOrder.length = 0;
    mockUser = null;
    rerender(
      <SyncAuthGate>
        <GuestReadyMarker />
      </SyncAuthGate>
    );

    await waitFor(() => {
      expect(mockClearAuthContext).toHaveBeenCalled();
      expect(getByText("Guest providers ready")).toBeTruthy();
    });
    expect(renderOrder[0]).toBe("auth cleared");
    expect(renderOrder).toContain("guest rendered");
  });

  it("reconfigures the engine before rendering providers for a changed household", async () => {
    mockIsInitialized = true;
    const renderOrder: string[] = [];
    mockSetAuthContext.mockImplementation((_householdId: string) => {
      renderOrder.push("auth configured");
    });

    function ReadyMarker({ label }: { label: string }) {
      renderOrder.push(`rendered ${label}`);
      return <Text>{label}</Text>;
    }

    const { rerender, getByText } = render(
      <SyncAuthGate>
        <ReadyMarker label="First household" />
      </SyncAuthGate>
    );

    await waitFor(() => {
      expect(getByText("First household")).toBeTruthy();
    });

    renderOrder.length = 0;
    mockUser = {
      id: "test-user-123",
      householdId: "test-household-789",
    };
    rerender(
      <SyncAuthGate>
        <ReadyMarker label="Second household" />
      </SyncAuthGate>
    );

    await waitFor(() => {
      expect(mockSetAuthContext).toHaveBeenLastCalledWith(
        "test-household-789",
        "test-user-123"
      );
      expect(getByText("Second household")).toBeTruthy();
    });
    expect(renderOrder[0]).toBe("auth configured");
    expect(renderOrder).toContain("rendered Second household");
  });
});
