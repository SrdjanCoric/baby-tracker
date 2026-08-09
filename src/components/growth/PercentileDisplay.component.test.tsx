import React from "react";
import { render, screen } from "@testing-library/react-native";
import { PercentileDisplay } from "./PercentileDisplay";

describe("PercentileDisplay notation", () => {
  it.each([1, 2, 3, 50, 97])(
    "renders P%s in compact and full presentations",
    (percentile) => {
      const compact = render(
        <PercentileDisplay
          compact
          percentile={percentile}
          measurementType="weight"
          value={4.25}
          unit="kg"
        />
      );
      expect(screen.getByText(`P${percentile}`)).toBeTruthy();
      compact.unmount();

      render(
        <PercentileDisplay
          percentile={percentile}
          measurementType="weight"
          value={4.25}
          unit="kg"
        />
      );
      expect(screen.getByText(`P${percentile}`)).toBeTruthy();
    }
  );
});
