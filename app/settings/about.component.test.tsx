import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Linking } from "react-native";
import AboutSettingsScreen from "./about";

const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

jest.mock("expo-constants", () => ({
  expoConfig: {
    version: "0.1.0",
    ios: {
      buildNumber: "1",
    },
  },
}));

jest.spyOn(Linking, "openURL").mockImplementation(() => Promise.resolve(true));

describe("AboutSettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders the app name", () => {
      render(<AboutSettingsScreen />);

      expect(screen.getByText("Baby Tracker")).toBeTruthy();
    });

    it("renders the page title", () => {
      render(<AboutSettingsScreen />);

      expect(screen.getByText("About")).toBeTruthy();
    });

    it("renders the version number", () => {
      render(<AboutSettingsScreen />);

      expect(screen.getByText(/Version 0.1.0/)).toBeTruthy();
    });

    it("renders the app description", () => {
      render(<AboutSettingsScreen />);

      expect(screen.getByText(/privacy-first, ad-free baby tracking app/)).toBeTruthy();
    });

    it("renders the privacy policy option", () => {
      render(<AboutSettingsScreen />);

      expect(screen.getByText("Privacy Policy")).toBeTruthy();
    });

    it("renders the app icon emoji", () => {
      render(<AboutSettingsScreen />);

      expect(screen.getByText("👶")).toBeTruthy();
    });

    it("renders the footer message", () => {
      render(<AboutSettingsScreen />);

      expect(screen.getByText(/Made with/)).toBeTruthy();
    });
  });

  describe("interactions", () => {
    it("opens privacy policy URL when privacy policy is pressed", () => {
      render(<AboutSettingsScreen />);

      const privacyOption = screen.getByText("Privacy Policy").parent?.parent;
      fireEvent.press(privacyOption!);

      expect(Linking.openURL).toHaveBeenCalledWith("https://srdjancoric.github.io/sofibaby-privacy/");
    });
  });
});
