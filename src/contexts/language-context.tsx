import React, { createContext, useContext, useEffect, useCallback, useMemo, useState } from "react";
import * as Localization from "expo-localization";
import i18n from "@/i18n";
import { LanguageStorageService, type LanguageCode } from "@/services/language-storage";
import { publishNativeLanguage } from "@/services/native-language-service";

export type { LanguageCode };

interface LanguageContextValue {
  language: LanguageCode;
  resolvedLanguage: "en" | "sr" | "es" | "es-ES" | "fr" | "pt-PT" | "pt-BR" | "de" | "it";
  isLoading: boolean;
  setLanguage: (language: LanguageCode) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getDeviceLanguage(): "en" | "sr" | "es" | "es-ES" | "fr" | "pt-PT" | "pt-BR" | "de" | "it" {
  const locales = Localization.getLocales()[0];
  const deviceLocale = locales?.languageCode ?? "en";
  const regionCode = locales?.regionCode;
  if (deviceLocale === "sr") return "sr";
  if (deviceLocale === "es" && regionCode === "ES") return "es-ES";
  if (deviceLocale === "es") return "es";
  if (deviceLocale === "fr") return "fr";
  if (deviceLocale === "pt" && regionCode === "BR") return "pt-BR";
  if (deviceLocale === "pt") return "pt-PT";
  if (deviceLocale === "de") return "de";
  if (deviceLocale === "it") return "it";
  return "en";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("system");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPreference = async () => {
      const storedLanguage = await LanguageStorageService.getLanguagePreference();
      setLanguageState(storedLanguage);

      const resolvedLang = storedLanguage === "system" ? getDeviceLanguage() : storedLanguage;
      await i18n.changeLanguage(resolvedLang);
      // The Watch and the widget cannot read "system"; they get the resolved code.
      await publishNativeLanguage(resolvedLang);

      setIsLoading(false);
    };
    loadPreference();
  }, []);

  const handleSetLanguage = useCallback(async (newLanguage: LanguageCode) => {
    await LanguageStorageService.setLanguagePreference(newLanguage);
    setLanguageState(newLanguage);

    const resolvedLang = newLanguage === "system" ? getDeviceLanguage() : newLanguage;
    await i18n.changeLanguage(resolvedLang);
    await publishNativeLanguage(resolvedLang);
  }, []);

  const resolvedLanguage = language === "system" ? getDeviceLanguage() : language;

  const value: LanguageContextValue = useMemo(() => ({
    language,
    resolvedLanguage,
    isLoading,
    setLanguage: handleSetLanguage,
  }), [language, resolvedLanguage, isLoading, handleSetLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
