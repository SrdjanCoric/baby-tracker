import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import en from "./locales/en.json";
import sr from "./locales/sr.json";
import es from "./locales/es.json";

const resources = {
  en: { translation: en },
  sr: { translation: sr },
  es: { translation: es },
};

i18n.use(initReactI18next).init({
  resources,
  lng: Localization.getLocales()[0]?.languageCode ?? "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: "v4",
});

export default i18n;
