import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { ActivityRangeBoundary } from "./ActivityRangeBoundary";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("nativewind", () => ({
  useColorScheme: () => ({ colorScheme: "light" }),
}));

describe("ActivityRangeBoundary", () => {
  it("withholds unverified empty results and preserves cached results during loading or retry", () => {
    const retry = jest.fn();
    const content = <Text testID="statistics-content">cached statistics</Text>;
    const { rerender } = render(
      <ActivityRangeBoundary status="unverified" hasCachedData={false} onRetry={retry}>
        {content}
      </ActivityRangeBoundary>
    );

    expect(screen.getByTestId("statistics-range-loading")).toBeTruthy();
    expect(screen.queryByTestId("statistics-content")).toBeNull();

    rerender(
      <ActivityRangeBoundary status="loading" hasCachedData onRetry={retry}>
        {content}
      </ActivityRangeBoundary>
    );
    expect(screen.getByTestId("statistics-content")).toBeTruthy();
    expect(screen.getByTestId("statistics-range-refreshing")).toBeTruthy();

    rerender(
      <ActivityRangeBoundary status="error" hasCachedData onRetry={retry}>
        {content}
      </ActivityRangeBoundary>
    );
    expect(screen.getByTestId("statistics-content")).toBeTruthy();
    fireEvent.press(screen.getByTestId("statistics-range-retry"));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
