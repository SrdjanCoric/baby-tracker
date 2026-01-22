import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import JoinHouseholdScreen from "./join-household";

const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    push: jest.fn(),
    replace: mockReplace,
  }),
}));

jest.spyOn(Alert, "alert").mockImplementation((title, message, buttons) => {
  if (buttons && buttons.length > 0 && buttons[0].onPress) {
    buttons[0].onPress();
  }
});

const mockJoinHousehold = jest.fn();
let mockIsAuthenticated = true;

jest.mock("@/contexts", () => ({
  useHousehold: () => ({
    joinHousehold: mockJoinHousehold,
    isLoading: false,
    error: null,
  }),
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
  }),
}));

describe("JoinHouseholdScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAuthenticated = true;
    mockJoinHousehold.mockResolvedValue({ success: true, error: null });
  });

  describe("unauthenticated user", () => {
    beforeEach(() => {
      mockIsAuthenticated = false;
    });

    it("shows sign-in prompt when not authenticated", () => {
      render(<JoinHouseholdScreen />);

      expect(screen.getByText("Sign in to use Household")).toBeTruthy();
      expect(screen.getByText(/Create an account to share baby tracking/)).toBeTruthy();
    });

    it("shows sign-in button when not authenticated", () => {
      render(<JoinHouseholdScreen />);

      expect(screen.getByText("Sign In")).toBeTruthy();
    });

    it("does not show invite code input when not authenticated", () => {
      render(<JoinHouseholdScreen />);

      expect(screen.queryByTestId("invite-code-input")).toBeNull();
    });

    it("navigates to sign-in when sign-in button is pressed", () => {
      const mockPush = jest.fn();
      jest.spyOn(require("expo-router"), "useRouter").mockReturnValue({
        back: mockBack,
        push: mockPush,
        replace: mockReplace,
      });

      render(<JoinHouseholdScreen />);

      const signInButton = screen.getByText("Sign In");
      fireEvent.press(signInButton);

      expect(mockPush).toHaveBeenCalledWith("/auth/sign-in");
    });
  });

  describe("rendering", () => {
    it("renders the page title", () => {
      render(<JoinHouseholdScreen />);

      expect(screen.getByText("Join Household")).toBeTruthy();
    });

    it("renders the description text", () => {
      render(<JoinHouseholdScreen />);

      expect(screen.getByText(/Enter the invite code shared by another caregiver/)).toBeTruthy();
    });

    it("renders the invite code input", () => {
      render(<JoinHouseholdScreen />);

      expect(screen.getByTestId("invite-code-input")).toBeTruthy();
    });

    it("renders the join button", () => {
      render(<JoinHouseholdScreen />);

      expect(screen.getByText("Join")).toBeTruthy();
    });

  });

  describe("interactions", () => {
    it("updates input value when typing", () => {
      render(<JoinHouseholdScreen />);

      const input = screen.getByTestId("invite-code-input");
      fireEvent.changeText(input, "ABCD2345");

      expect(input.props.value).toBe("ABCD-2345");
    });

    it("formats input with dash for display", () => {
      render(<JoinHouseholdScreen />);

      const input = screen.getByTestId("invite-code-input");
      fireEvent.changeText(input, "abcd2345");

      expect(input.props.value).toBe("ABCD-2345");
    });

    it("handles input with spaces and dashes", () => {
      render(<JoinHouseholdScreen />);

      const input = screen.getByTestId("invite-code-input");
      fireEvent.changeText(input, "abcd 2345");

      expect(input.props.value).toBe("ABCD-2345");
    });

    it("calls joinHousehold when join button is pressed with valid code", async () => {
      render(<JoinHouseholdScreen />);

      const input = screen.getByTestId("invite-code-input");
      fireEvent.changeText(input, "ABCD2345");

      const joinButton = screen.getByText("Join");
      fireEvent.press(joinButton);

      await waitFor(() => {
        expect(mockJoinHousehold).toHaveBeenCalledWith("ABCD2345");
      });
    });

    it("navigates back on successful join", async () => {
      mockJoinHousehold.mockResolvedValue({ success: true, error: null });

      render(<JoinHouseholdScreen />);

      const input = screen.getByTestId("invite-code-input");
      fireEvent.changeText(input, "ABCD2345");

      const joinButton = screen.getByText("Join");
      fireEvent.press(joinButton);

      await waitFor(() => {
        expect(mockBack).toHaveBeenCalled();
      });
    });
  });

  describe("validation", () => {
    it("shows error for empty input", async () => {
      render(<JoinHouseholdScreen />);

      const joinButton = screen.getByText("Join");
      fireEvent.press(joinButton);

      await waitFor(() => {
        expect(screen.getByText(/Please enter an invite code/)).toBeTruthy();
      });
    });

    it("shows error for code that is too short", async () => {
      render(<JoinHouseholdScreen />);

      const input = screen.getByTestId("invite-code-input");
      fireEvent.changeText(input, "ABC");

      const joinButton = screen.getByText("Join");
      fireEvent.press(joinButton);

      await waitFor(() => {
        expect(screen.getByText(/must be 8 characters/)).toBeTruthy();
      });
    });

    it("shows error for invalid characters", async () => {
      render(<JoinHouseholdScreen />);

      const input = screen.getByTestId("invite-code-input");
      fireEvent.changeText(input, "ABCD0234");

      const joinButton = screen.getByText("Join");
      fireEvent.press(joinButton);

      await waitFor(() => {
        expect(screen.getByText(/Invalid characters/)).toBeTruthy();
      });
    });

    it("does not call joinHousehold when validation fails", async () => {
      render(<JoinHouseholdScreen />);

      const joinButton = screen.getByText("Join");
      fireEvent.press(joinButton);

      await waitFor(() => {
        expect(screen.getByText(/Please enter an invite code/)).toBeTruthy();
      });

      expect(mockJoinHousehold).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("shows error when household not found", async () => {
      mockJoinHousehold.mockResolvedValue({ success: false, error: "householdNotFound" });

      render(<JoinHouseholdScreen />);

      const input = screen.getByTestId("invite-code-input");
      fireEvent.changeText(input, "WXYZ9876");

      const joinButton = screen.getByText("Join");
      fireEvent.press(joinButton);

      await waitFor(() => {
        expect(screen.getByText(/Household not found/)).toBeTruthy();
      });
    });

    it("shows error when already in household", async () => {
      mockJoinHousehold.mockResolvedValue({ success: false, error: "alreadyInHousehold" });

      render(<JoinHouseholdScreen />);

      const input = screen.getByTestId("invite-code-input");
      fireEvent.changeText(input, "ABCD2345");

      const joinButton = screen.getByText("Join");
      fireEvent.press(joinButton);

      await waitFor(() => {
        expect(screen.getByText(/already belong/)).toBeTruthy();
      });
    });

    it("does not navigate back on failed join", async () => {
      mockJoinHousehold.mockResolvedValue({ success: false, error: "householdNotFound" });

      render(<JoinHouseholdScreen />);

      const input = screen.getByTestId("invite-code-input");
      fireEvent.changeText(input, "WXYZ9876");

      const joinButton = screen.getByText("Join");
      fireEvent.press(joinButton);

      await waitFor(() => {
        expect(screen.getByText(/Household not found/)).toBeTruthy();
      });

      expect(mockBack).not.toHaveBeenCalled();
    });
  });
});
