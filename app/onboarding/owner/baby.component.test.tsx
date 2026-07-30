import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import NewOwnerBabyScreen from "./baby";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockAddBaby = jest.fn();
const mockSelectBaby = jest.fn();
const mockSignOut = jest.fn();
const mockGetState = jest.fn();
const mockUpdateBabyDraft = jest.fn();
const mockMarkBabyCreated = jest.fn();
const mockStartOver = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock("@/contexts", () => ({
  useBaby: () => ({ addBaby: mockAddBaby, selectBaby: mockSelectBaby }),
  useAuth: () => ({ signOut: mockSignOut }),
  useLanguage: () => ({ language: "de", resolvedLanguage: "de" }),
}));

jest.mock("@/services/new-owner-onboarding-storage", () => ({
  NewOwnerOnboardingStorageService: {
    getState: (...args: unknown[]) => mockGetState(...args),
    updateBabyDraft: (...args: unknown[]) => mockUpdateBabyDraft(...args),
    markBabyCreated: (...args: unknown[]) => mockMarkBabyCreated(...args),
    startOver: (...args: unknown[]) => mockStartOver(...args),
  },
}));

jest.mock("@/components", () => ({
  Input: jest.requireActual("@/components/Input").Input,
}));

jest.mock("@/components/onboarding", () => ({
  OnboardingIllustration: () => null,
}));

const ownerBabyState = {
  version: 2,
  screen: "owner-baby",
  language: "de",
  entryPath: "owner",
  accountMode: "guest",
  babyDraft: { name: "", birthDate: null, gender: null },
};

describe("NewOwnerBabyScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetState.mockResolvedValue(ownerBabyState);
    mockUpdateBabyDraft.mockResolvedValue(undefined);
    mockMarkBabyCreated.mockResolvedValue(undefined);
    mockStartOver.mockResolvedValue(undefined);
    mockSelectBaby.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue({ error: null });
    mockAddBaby.mockResolvedValue({ id: "baby-1" });
  });

  it("does not create a baby until the complete profile is valid", async () => {
    render(<NewOwnerBabyScreen />);

    await waitFor(() => expect(screen.getByTestId("owner-baby-continue")).toBeTruthy());
    fireEvent.press(screen.getByTestId("owner-baby-continue"));

    expect(mockAddBaby).not.toHaveBeenCalled();
    expect(screen.getByText("validation.nameRequired")).toBeTruthy();
    expect(screen.getByText("validation.birthDateRequired")).toBeTruthy();
    expect(screen.getByText("validation.genderRequired")).toBeTruthy();
  });

  it("dismisses the iOS birth-date picker before continuing", async () => {
    render(<NewOwnerBabyScreen />);

    await waitFor(() => expect(screen.getByTestId("owner-baby-birth-date")).toBeTruthy());
    fireEvent.press(screen.getByTestId("owner-baby-birth-date"));
    expect(screen.getByTestId("owner-baby-birth-date-done")).toBeTruthy();

    fireEvent.press(screen.getByTestId("owner-baby-birth-date-done"));
    expect(screen.queryByTestId("owner-baby-birth-date-input")).toBeNull();
  });

  it("clears the draft and returns to Welcome when starting over", async () => {
    render(<NewOwnerBabyScreen />);

    await waitFor(() => expect(screen.getByTestId("owner-start-over")).toBeTruthy());
    fireEvent.press(screen.getByTestId("owner-start-over"));

    await waitFor(() => {
      expect(mockStartOver).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith("/onboarding/owner");
    });
  });

  it("offers an invitation after creating an authenticated baby", async () => {
    const birthDate = new Date("2026-06-12T00:00:00.000Z");
    mockGetState.mockResolvedValue({
      ...ownerBabyState,
      accountMode: "authenticated",
      babyDraft: {
        name: "Mila",
        birthDate: birthDate.toISOString(),
        gender: "female",
      },
    });

    render(<NewOwnerBabyScreen />);

    await waitFor(() => expect(screen.getByDisplayValue("Mila")).toBeTruthy());
    fireEvent.press(screen.getByTestId("owner-baby-continue"));

    await waitFor(() => {
      expect(mockMarkBabyCreated).toHaveBeenCalledWith("baby-1");
      expect(mockPush).toHaveBeenCalledWith("/onboarding/owner/invitation");
    });
  });

  it("signs out before restarting authenticated baby setup", async () => {
    mockGetState.mockResolvedValue({ ...ownerBabyState, accountMode: "authenticated" });
    render(<NewOwnerBabyScreen />);

    await waitFor(() => expect(screen.getByTestId("owner-start-over")).toBeTruthy());
    fireEvent.press(screen.getByTestId("owner-start-over"));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(mockStartOver).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith("/onboarding/owner");
    });
  });

  it("restores the draft, formats its date in the selected locale, and creates a guest baby", async () => {
    const birthDate = new Date("2026-06-12T00:00:00.000Z");
    mockGetState.mockResolvedValue({
      ...ownerBabyState,
      babyDraft: {
        name: "Mila",
        birthDate: birthDate.toISOString(),
        gender: "female",
      },
    });

    render(<NewOwnerBabyScreen />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Mila")).toBeTruthy();
      expect(screen.getByText(birthDate.toLocaleDateString("de", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }))).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("owner-baby-continue"));

    await waitFor(() => {
      expect(mockAddBaby).toHaveBeenCalledWith({
        name: "Mila",
        birthDate,
        gender: "female",
        photoUri: undefined,
      });
      expect(mockMarkBabyCreated).toHaveBeenCalledWith("baby-1");
      expect(mockPush).toHaveBeenCalledWith("/onboarding/owner/activity");
    });
  });
});
