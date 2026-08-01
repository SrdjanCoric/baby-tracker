import React from "react";
import { Pressable, Text } from "react-native";
import { render, waitFor, fireEvent } from "@testing-library/react-native";
import { LanguageProvider, useLanguage } from "./language-context";
import { publishNativeLanguage } from "@/services/native-language-service";
import { LanguageStorageService } from "@/services/language-storage";
import * as Localization from "expo-localization";

jest.mock("@/services/native-language-service", () => ({
  publishNativeLanguage: jest.fn(async () => undefined),
}));

jest.mock("@/services/language-storage", () => ({
  LanguageStorageService: {
    getLanguagePreference: jest.fn(async () => "system"),
    setLanguagePreference: jest.fn(async () => undefined),
    clearLanguagePreference: jest.fn(async () => undefined),
  },
}));

jest.mock("expo-localization", () => ({ getLocales: jest.fn(() => [{ languageCode: "en" }]) }));

jest.mock("@/i18n", () => ({
  __esModule: true,
  default: { changeLanguage: jest.fn(async () => undefined) },
}));

const mockPublish = publishNativeLanguage as jest.Mock;
const mockGetPreference = LanguageStorageService.getLanguagePreference as jest.Mock;
const mockGetLocales = Localization.getLocales as jest.Mock;

function Probe() {
  const { setLanguage } = useLanguage();
  return (
    <>
      <Pressable testID="pick-german" onPress={() => void setLanguage("de")}>
        <Text>german</Text>
      </Pressable>
      <Pressable testID="pick-system" onPress={() => void setLanguage("system")}>
        <Text>system</Text>
      </Pressable>
    </>
  );
}

function renderProvider() {
  return render(
    <LanguageProvider>
      <Probe />
    </LanguageProvider>
  );
}

describe("language context native publishing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPreference.mockResolvedValue("system");
    mockGetLocales.mockReturnValue([{ languageCode: "en" }]);
  });

  it("publishes the caregiver's stored language to the native surfaces on startup", async () => {
    mockGetPreference.mockResolvedValue("pt-PT");

    renderProvider();

    await waitFor(() => expect(mockPublish).toHaveBeenCalledWith("pt-PT"));
  });

  it("resolves an unset preference to the device language instead of publishing 'system'", async () => {
    mockGetPreference.mockResolvedValue("system");
    mockGetLocales.mockReturnValue([{ languageCode: "pt", regionCode: "BR" }]);

    renderProvider();

    await waitFor(() => expect(mockPublish).toHaveBeenCalledWith("pt-BR"));
    expect(mockPublish).not.toHaveBeenCalledWith("system");
  });

  it("publishes the new language when the caregiver switches it", async () => {
    const { getByTestId } = renderProvider();
    await waitFor(() => expect(mockPublish).toHaveBeenCalled());
    mockPublish.mockClear();

    fireEvent.press(getByTestId("pick-german"));

    await waitFor(() => expect(mockPublish).toHaveBeenCalledWith("de"));
  });

  it("does not let the startup load revert a language the caregiver just chose", async () => {
    let releaseStoredPreference: (value: string) => void = () => {};
    mockGetPreference.mockReturnValue(
      new Promise<string>((resolve) => {
        releaseStoredPreference = resolve;
      })
    );

    const { getByTestId } = renderProvider();
    fireEvent.press(getByTestId("pick-german"));
    await waitFor(() => expect(mockPublish).toHaveBeenCalledWith("de"));

    // The slower startup read now finishes and must not undo the choice.
    releaseStoredPreference("en");

    await waitFor(() => expect(mockGetPreference).toHaveBeenCalled());
    expect(mockPublish).not.toHaveBeenCalledWith("en");
    expect(mockPublish.mock.calls.at(-1)?.[0]).toBe("de");
  });

  it("publishes the resolved device language when the caregiver switches back to system", async () => {
    mockGetPreference.mockResolvedValue("de");
    mockGetLocales.mockReturnValue([{ languageCode: "es", regionCode: "ES" }]);
    const { getByTestId } = renderProvider();
    await waitFor(() => expect(mockPublish).toHaveBeenCalledWith("de"));
    mockPublish.mockClear();

    fireEvent.press(getByTestId("pick-system"));

    await waitFor(() => expect(mockPublish).toHaveBeenCalledWith("es-ES"));
    expect(mockPublish).not.toHaveBeenCalledWith("system");
  });
});
