import React, { createContext, useContext, useEffect, useCallback, useMemo, useRef, useState } from "react";
import * as Localization from "expo-localization";
import i18n from "@/i18n";
import { LanguageStorageService, type LanguageCode } from "@/services/language-storage";
import { publishNativeLanguage } from "@/services/native-language-service";

export type { LanguageCode };

/** A concrete shipped locale — never the stored "system" preference. */
type ResolvedLanguage = Exclude<LanguageCode, "system">;

interface LanguageContextValue {
  language: LanguageCode;
  resolvedLanguage: ResolvedLanguage;
  isLoading: boolean;
  setLanguage: (language: LanguageCode) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getDeviceLanguage(): ResolvedLanguage {
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
  // Nothing gates the UI on isLoading, so a caregiver can choose a language
  // while the stored preference is still being read. The slower startup read
  // must not then publish the old language over the newer choice.
  const latestRequest = useRef(0);

  const applyLanguage = useCallback(
    async (resolved: ResolvedLanguage, requestId: number) => {
      if (requestId !== latestRequest.current) return;
      await i18n.changeLanguage(resolved);
      if (requestId !== latestRequest.current) return;
      // The Watch and the widget cannot read "system"; they get the resolved code.
      await publishNativeLanguage(resolved);
    },
    []
  );

  useEffect(() => {
    const requestId = ++latestRequest.current;
    const loadPreference = async () => {
      const storedLanguage = await LanguageStorageService.getLanguagePreference();

      // A choice made while this read was in flight wins over the stored value.
      if (requestId !== latestRequest.current) {
        setIsLoading(false);
        return;
      }
      setLanguageState(storedLanguage);

      const resolvedLang = storedLanguage === "system" ? getDeviceLanguage() : storedLanguage;
      await applyLanguage(resolvedLang, requestId);

      setIsLoading(false);
    };
    loadPreference();
  }, [applyLanguage]);

  const handleSetLanguage = useCallback(
    async (newLanguage: LanguageCode) => {
      const requestId = ++latestRequest.current;
      await LanguageStorageService.setLanguagePreference(newLanguage);
      setLanguageState(newLanguage);

      const resolvedLang = newLanguage === "system" ? getDeviceLanguage() : newLanguage;
      await applyLanguage(resolvedLang, requestId);
    },
    [applyLanguage]
  );

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
