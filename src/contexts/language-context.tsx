import React, { createContext, useContext, useEffect, useCallback, useMemo, useState } from "react";
import * as Localization from "expo-localization";
import i18n from "@/i18n";
import { LanguageStorageService, type LanguageCode } from "@/services/language-storage";

export type { LanguageCode };

interface LanguageContextValue {
  language: LanguageCode;
  resolvedLanguage: "en" | "sr" | "es";
  isLoading: boolean;
  setLanguage: (language: LanguageCode) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getDeviceLanguage(): "en" | "sr" | "es" {
  const deviceLocale = Localization.getLocales()[0]?.languageCode ?? "en";
  if (deviceLocale === "sr") return "sr";
  if (deviceLocale === "es") return "es";
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

      setIsLoading(false);
    };
    loadPreference();
  }, []);

  const handleSetLanguage = useCallback(async (newLanguage: LanguageCode) => {
    await LanguageStorageService.setLanguagePreference(newLanguage);
    setLanguageState(newLanguage);

    const resolvedLang = newLanguage === "system" ? getDeviceLanguage() : newLanguage;
    await i18n.changeLanguage(resolvedLang);
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
