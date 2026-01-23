import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { BabySelector } from "./BabySelector";

const mockSelectBaby = jest.fn();

jest.mock("@/contexts", () => ({
  useBaby: jest.fn(),
}));

jest.mock("@/validators/baby", () => ({
  calculateBabyAge: jest.fn((date: Date) => {
    const now = new Date();
    const months = Math.floor((now.getTime() - date.getTime()) / (30.44 * 24 * 60 * 60 * 1000));
    return `${months} months`;
  }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "baby.addFirstBaby": "Add your first baby",
        "baby.addBaby": "Add Baby",
        "baby.tapToSwitch": "Tap to switch baby",
        "baby.selectBaby": "Select Baby",
        "baby.addAnotherBaby": "Add Another Baby",
        "baby.monthsOld": `${params?.count || 0} months old`,
        "baby.weeksOld": `${params?.count || 0} weeks old`,
        "baby.daysOld": `${params?.count || 0} days old`,
        "baby.yearsOld": `${params?.count || 0} years old`,
        "baby.yearsMonthsOld": `${params?.years || 0} years ${params?.months || 0} months old`,
        "baby.notBornYet": "Not born yet",
      };
      return translations[key] || key;
    },
  }),
}));

import { useBaby } from "@/contexts";

const mockUseBaby = useBaby as jest.Mock;

describe("BabySelector", () => {
  const mockBaby1 = {
    id: "1",
    name: "Emma",
    birthDate: new Date("2025-06-15").toISOString(),
  };

  const mockBaby2 = {
    id: "2",
    name: "Oliver",
    birthDate: new Date("2025-08-20").toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseBaby.mockReturnValue({
      babies: [mockBaby1],
      selectedBaby: mockBaby1,
      selectBaby: mockSelectBaby,
      isLoading: false,
    });
  });

  describe("loading state", () => {
    it("shows loading skeleton when isLoading", () => {
      mockUseBaby.mockReturnValue({
        babies: [],
        selectedBaby: null,
        selectBaby: mockSelectBaby,
        isLoading: true,
      });
      const { UNSAFE_root } = render(<BabySelector />);
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  describe("no baby state", () => {
    it('shows "Add Baby" button when no selectedBaby', () => {
      mockUseBaby.mockReturnValue({
        babies: [],
        selectedBaby: null,
        selectBaby: mockSelectBaby,
        isLoading: false,
      });
      render(<BabySelector />);
      expect(screen.getByText("Add Baby")).toBeTruthy();
    });

    it("calls onAddBaby when add button pressed", () => {
      const onAddBabyMock = jest.fn();
      mockUseBaby.mockReturnValue({
        babies: [],
        selectedBaby: null,
        selectBaby: mockSelectBaby,
        isLoading: false,
      });
      render(<BabySelector onAddBaby={onAddBabyMock} />);
      fireEvent.press(screen.getByLabelText("Add your first baby"));
      expect(onAddBabyMock).toHaveBeenCalled();
    });
  });

  describe("selected baby state", () => {
    it("renders selected baby name", () => {
      render(<BabySelector />);
      expect(screen.getByText("Emma")).toBeTruthy();
    });

    it("renders baby age when birthDate provided", () => {
      render(<BabySelector />);
      expect(screen.getByText(/months/)).toBeTruthy();
    });
  });

  describe("dropdown indicator", () => {
    it("shows dropdown indicator when multiple babies", () => {
      mockUseBaby.mockReturnValue({
        babies: [mockBaby1, mockBaby2],
        selectedBaby: mockBaby1,
        selectBaby: mockSelectBaby,
        isLoading: false,
      });
      render(<BabySelector />);
      expect(screen.getByText("▾")).toBeTruthy();
    });

    it("hides dropdown when single baby", () => {
      render(<BabySelector />);
      expect(screen.queryByText("▾")).toBeNull();
    });
  });

  describe("modal interactions", () => {
    it("opens modal when pressed", () => {
      mockUseBaby.mockReturnValue({
        babies: [mockBaby1, mockBaby2],
        selectedBaby: mockBaby1,
        selectBaby: mockSelectBaby,
        isLoading: false,
      });
      render(<BabySelector />);
      fireEvent.press(screen.getByLabelText(/Emma.*Tap to switch/));
      expect(screen.getByText("Select Baby")).toBeTruthy();
    });

    it("renders all babies in modal", () => {
      mockUseBaby.mockReturnValue({
        babies: [mockBaby1, mockBaby2],
        selectedBaby: mockBaby1,
        selectBaby: mockSelectBaby,
        isLoading: false,
      });
      render(<BabySelector />);
      fireEvent.press(screen.getByLabelText(/Emma.*Tap to switch/));
      expect(screen.getAllByText("Emma").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Oliver")).toBeTruthy();
    });

    it("marks selected baby in modal", () => {
      mockUseBaby.mockReturnValue({
        babies: [mockBaby1, mockBaby2],
        selectedBaby: mockBaby1,
        selectBaby: mockSelectBaby,
        isLoading: false,
      });
      render(<BabySelector />);
      fireEvent.press(screen.getByLabelText(/Emma.*Tap to switch/));
      expect(screen.getByText("✓")).toBeTruthy();
    });

    it("calls selectBaby when different baby selected", async () => {
      mockUseBaby.mockReturnValue({
        babies: [mockBaby1, mockBaby2],
        selectedBaby: mockBaby1,
        selectBaby: mockSelectBaby,
        isLoading: false,
      });
      render(<BabySelector />);
      fireEvent.press(screen.getByLabelText(/Emma.*Tap to switch/));
      fireEvent.press(screen.getByLabelText("Oliver"));
      await waitFor(() => {
        expect(mockSelectBaby).toHaveBeenCalledWith("2");
      });
    });

    it('shows "Add Another Baby" button in modal', () => {
      mockUseBaby.mockReturnValue({
        babies: [mockBaby1, mockBaby2],
        selectedBaby: mockBaby1,
        selectBaby: mockSelectBaby,
        isLoading: false,
      });
      render(<BabySelector />);
      fireEvent.press(screen.getByLabelText(/Emma.*Tap to switch/));
      expect(screen.getByText("Add Another Baby")).toBeTruthy();
    });

    it("calls onAddBaby when add button pressed in modal", () => {
      const onAddBabyMock = jest.fn();
      mockUseBaby.mockReturnValue({
        babies: [mockBaby1, mockBaby2],
        selectedBaby: mockBaby1,
        selectBaby: mockSelectBaby,
        isLoading: false,
      });
      render(<BabySelector onAddBaby={onAddBabyMock} />);
      fireEvent.press(screen.getByLabelText(/Emma.*Tap to switch/));
      fireEvent.press(screen.getByLabelText("Add Another Baby"));
      expect(onAddBabyMock).toHaveBeenCalled();
    });
  });

  describe("accessibility", () => {
    it("has correct accessibility label", () => {
      render(<BabySelector />);
      expect(screen.getByLabelText(/Emma.*Tap to switch/)).toBeTruthy();
    });
  });
});
