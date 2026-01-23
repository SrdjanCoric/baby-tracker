import React from "react";
import { render, screen } from "@testing-library/react-native";
import { TrendIndicator } from "./TrendIndicator";
import { ThemeProvider } from "@/contexts/theme-context";
import { SEMANTIC_COLORS } from "@/constants/design-tokens";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "statistics.vsLastWeek": "vs last week",
      };
      return translations[key] || key;
    },
  }),
}));

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe("TrendIndicator", () => {
  describe("arrows", () => {
    it("renders up arrow for increase", () => {
      renderWithTheme(<TrendIndicator direction="increase" percentageChange={15} />);
      expect(screen.getByText(/↑/)).toBeTruthy();
    });

    it("renders down arrow for decrease", () => {
      renderWithTheme(<TrendIndicator direction="decrease" percentageChange={-10} />);
      expect(screen.getByText(/↓/)).toBeTruthy();
    });

    it("renders right arrow for stable", () => {
      renderWithTheme(<TrendIndicator direction="stable" percentageChange={0} />);
      expect(screen.getByText(/→/)).toBeTruthy();
    });
  });

  describe("colors", () => {
    it("applies green color for increase", () => {
      const { UNSAFE_getAllByType } = renderWithTheme(
        <TrendIndicator direction="increase" percentageChange={15} />
      );
      const texts = UNSAFE_getAllByType("Text" as any);
      const arrowText = texts.find((t) => t.props.children?.includes?.("↑") || t.props.children === "↑");
      expect(arrowText?.props.style?.color).toBe(SEMANTIC_COLORS.success.light);
    });

    it("applies red color for decrease", () => {
      const { UNSAFE_getAllByType } = renderWithTheme(
        <TrendIndicator direction="decrease" percentageChange={-10} />
      );
      const texts = UNSAFE_getAllByType("Text" as any);
      const arrowText = texts.find((t) => t.props.children?.includes?.("↓") || t.props.children === "↓");
      expect(arrowText?.props.style?.color).toBe(SEMANTIC_COLORS.error.light);
    });

    it("applies gray color for stable", () => {
      const { UNSAFE_getAllByType } = renderWithTheme(
        <TrendIndicator direction="stable" percentageChange={0} />
      );
      const texts = UNSAFE_getAllByType("Text" as any);
      const arrowText = texts.find((t) => t.props.children?.includes?.("→") || t.props.children === "→");
      expect(arrowText?.props.style?.color).toBe(SEMANTIC_COLORS.neutral.light);
    });
  });

  describe("percentage formatting", () => {
    it("formats positive percentage", () => {
      renderWithTheme(<TrendIndicator direction="increase" percentageChange={25} />);
      expect(screen.getByText(/\+25%/)).toBeTruthy();
    });

    it("formats negative percentage", () => {
      renderWithTheme(<TrendIndicator direction="decrease" percentageChange={-15} />);
      expect(screen.getByText(/-15%/)).toBeTruthy();
    });

    it("formats zero percentage for stable", () => {
      renderWithTheme(<TrendIndicator direction="stable" percentageChange={0} />);
      expect(screen.getByText(/0%/)).toBeTruthy();
    });
  });

  describe("absolute change", () => {
    it("renders absoluteChangeFormatted when provided", () => {
      renderWithTheme(
        <TrendIndicator
          direction="increase"
          percentageChange={15}
          absoluteChangeFormatted="+2h 30m"
        />
      );
      expect(screen.getByText("+2h 30m")).toBeTruthy();
    });
  });

  describe("compact mode", () => {
    it("shows arrow and percentage only in compact mode", () => {
      renderWithTheme(
        <TrendIndicator direction="increase" percentageChange={20} compact />
      );
      expect(screen.getByText(/↑ \+20%/)).toBeTruthy();
    });

    it('does not show "vs last week" text in compact mode', () => {
      renderWithTheme(
        <TrendIndicator direction="increase" percentageChange={20} compact />
      );
      expect(screen.queryByText(/vs last week/)).toBeNull();
    });
  });

  describe("full mode", () => {
    it('shows "vs last week" text', () => {
      renderWithTheme(<TrendIndicator direction="increase" percentageChange={20} />);
      expect(screen.getByText(/vs last week/)).toBeTruthy();
    });
  });
});
