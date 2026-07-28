import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { MorningSleepConfirmation } from "./MorningSleepConfirmation";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      "sleep.morningConfirmationQuestion": "Was this the first nap or back to sleep?",
      "sleep.firstNap": "First nap",
      "sleep.backToSleep": "Back to sleep",
      "sleep.morningConfirmationAccessibility": "Classify morning sleep",
    }[key] ?? key),
  }),
}));

jest.mock("@/contexts/time-format-context", () => ({
  useTimeFormat: () => ({ timeFormat: "12h" }),
}));

jest.mock("nativewind", () => ({
  useColorScheme: () => ({ colorScheme: "light" }),
}));

describe("MorningSleepConfirmation", () => {
  it("shows date and time context and offers only the two classification answers", () => {
    const onFirstNap = jest.fn();
    const onBackToSleep = jest.fn();

    render(
      <MorningSleepConfirmation
        startedAt="2026-07-25T08:30:00.000Z"
        onFirstNap={onFirstNap}
        onBackToSleep={onBackToSleep}
      />
    );

    expect(screen.getByText("Was this the first nap or back to sleep?")).toBeTruthy();
    expect(screen.getByTestId("morning-confirmation-context")).toBeTruthy();
    expect(screen.queryByText(/decide later/i)).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "First nap" }));
    fireEvent.press(screen.getByRole("button", { name: "Back to sleep" }));

    expect(onFirstNap).toHaveBeenCalledTimes(1);
    expect(onBackToSleep).toHaveBeenCalledTimes(1);
  });
});
